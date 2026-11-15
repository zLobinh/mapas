// The engine of the campaign panel: reads the sheets, draws the cards and the frame (SVG -> picture), sends
// the pictures to the GM's own GitHub repository (the same key as "Imagem por Link") and keeps the items of
// the scene pointing to them. The team's sprites are separate animated tokens placed on the card's sockets.
import OBR, { buildImage } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { ready, gh, base64, slug, fold, commitTree, blobEntry, removeEntry, rawUrl } from "../imagem-link/gh.js?v=1.7.0";
import { MAP, CARD, FRAME, cardSVG, frameSVG, teamSlots } from "./desenho.js?v=0.2.0";
import { sheetId, readTrainer } from "./planilha.js?v=0.2.0";
import { readPaliga } from "./paliga.js?v=0.2.0";

export const ID = "com.painel-campanha";
const CONFIG = `${ID}/config`, STATE = `${ID}/estado`, ITEM = `${ID}/item`;
const DRAW_VERSION = 1; // (bump to redraw everything after the drawings change)
const CARD_SCALE = 0.5, FRAME_SCALE = 0.26; // design units -> picture pixels
const HERE = new URL(".", import.meta.url);

// ---- config (room metadata, so it follows the room): { sheet, players: [{ tab, estilo, retrato, zoom }],
// aliases: { "Snow": "Ninetales" | "https://..." }, title: [a, b, c], auto }
export async function getConfig() {
  const m = await OBR.room.getMetadata();
  return { sheet: "", paliga: "", players: [], aliases: {}, title: ["POKÉMON", "Além do", "HORIZONTE"], auto: true, ...(m[CONFIG] ?? {}) };
}
export const setConfig = (c) => OBR.room.setMetadata({ [CONFIG]: c });
const getState = async () => ({ cards: {}, frame: null, ...((await OBR.room.getMetadata())[STATE] ?? {}) });
const setState = (s) => OBR.room.setMetadata({ [STATE]: s });

// ---- pictures
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
let fontsCache = null;
export async function fontCss() {
  if (fontsCache) return fontsCache;
  const list = [["Bangers", 400, "normal", "Bangers-400"], ["Chakra Petch", 500, "normal", "ChakraPetch-500"], ["Chakra Petch", 700, "normal", "ChakraPetch-700"], ["Cormorant Garamond", 600, "normal", "CormorantGaramond-600"], ["Cormorant Garamond", 700, "italic", "CormorantGaramond-700i"]];
  const rules = await Promise.all(list.map(async ([fam, wt, st, file]) => {
    const b = await (await fetch(new URL(`fonts/${file}.woff2`, HERE))).blob();
    return `@font-face{font-family:"${fam}";font-weight:${wt};font-style:${st};src:url(data:font/woff2;base64,${await base64(b)}) format("woff2")}`;
  }));
  return (fontsCache = rules.join(""));
}
// a picture as a data: address (an SVG drawn to a canvas can only use pictures that are inside it)
const pics = new Map();
export async function embed(url) {
  if (!url) return null;
  if (pics.has(url)) return pics.get(url);
  const p = (async () => {
    const res = await fetch(new URL(url, HERE), { mode: "cors" });
    if (!res.ok) throw new Error(`não consegui abrir a imagem ${url} (${res.status})`);
    let blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    blob = (await cutWhite(bmp)) ?? blob;
    bmp.close?.();
    return { href: `data:${blob.type || "image/png"};base64,${await base64(blob)}`, w, h };
  })();
  pics.set(url, p);
  return p;
}
// A portrait saved with a white background instead of a transparent one: the white that touches the top
// and the sides is taken out (the white inside the drawing, closed by its outline, stays). -> blob, or
// null when the picture already has transparency or no white border.
async function cutWhite(bmp) {
  const w = bmp.width, h = bmp.height;
  if (w * h > 6e6) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const im = g.getImageData(0, 0, w, h), px = im.data;
  const white = (i) => px[i + 3] > 250 && px[i] > 236 && px[i + 1] > 236 && px[i + 2] > 236;
  if (![0, w - 1, (w >> 1)].every((x) => white(x * 4))) return null; // (top edge isn't white: nothing to do)
  const seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { const k = y * w + x; if (!seen[k] && white(k * 4)) { seen[k] = 1; stack.push(k); } };
  for (let x = 0; x < w; x++) push(x, 0);
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop(), x = k % w, y = (k - x) / w;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  for (let k = 0; k < seen.length; k++) {
    if (seen[k]) px[k * 4 + 3] = 0;
    else {
      // the outline pixels next to the removed white: half transparent, so the edge isn't jagged or haloed
      const x = k % w, y = (k - x) / w;
      const near = (x > 0 && seen[k - 1]) || (x < w - 1 && seen[k + 1]) || (y > 0 && seen[k - w]) || (y < h - 1 && seen[k + w]);
      if (near && px[k * 4] > 200 && px[k * 4 + 1] > 200 && px[k * 4 + 2] > 200) px[k * 4 + 3] = 110;
    }
  }
  g.putImageData(im, 0, 0);
  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

// SVG text -> picture (WEBP keeps the transparency)
export async function render({ svg, w, h }, scale) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error("o desenho não abriu")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/webp", 0.92));
    return { blob, width: c.width, height: c.height };
  } finally { URL.revokeObjectURL(url); }
}

// ---- the scene: where the map is, and the design -> scene transform
const mine = (it, kind) => it.metadata?.[ITEM] && (!kind || it.metadata[ITEM].kind === kind);
async function findMap(items) {
  const marked = items.find((i) => i.metadata?.[`${ID}/mapa`]);
  if (marked) return marked;
  const maps = items.filter((i) => i.type === "IMAGE" && i.layer === "MAP" && !mine(i));
  const area = (i) => (i.image.width / i.grid.dpi) * Math.abs(i.scale.x) * (i.image.height / i.grid.dpi) * Math.abs(i.scale.y);
  return maps.sort((a, b) => area(b) - area(a))[0] ?? null;
}
async function layout() {
  const items = await OBR.scene.items.getItems();
  const dpi = await OBR.scene.grid.getDpi();
  const map = await findMap(items);
  if (!map) throw new Error("não achei o mapa na cena (uma imagem grande na camada Mapa)");
  const k = dpi / map.grid.dpi;
  const w = map.image.width * k * Math.abs(map.scale.x), h = map.image.height * k * Math.abs(map.scale.y);
  const left = map.position.x - map.grid.offset.x * k * Math.abs(map.scale.x), top = map.position.y - map.grid.offset.y * k * Math.abs(map.scale.y);
  const L = w / MAP.w;
  return { items, dpi, map, L, at: (dx, dy) => ({ x: left + (dx - MAP.x) * L, y: top + (dy - MAP.y) * (h / MAP.h) }) };
}
// an item for a rendered picture: `size` is its width in design units
function pictureItem(url, pic, designW, L, dpi) {
  return buildImage({ url, mime: "image/webp", width: pic.width, height: pic.height }, { dpi: pic.width * dpi / (designW * L), offset: { x: pic.width / 2, y: pic.height / 2 } });
}

// ---- the team's sprites: a species of the "Imagem por Link" library, or a link the GM gave for a nickname
let indexCache = null;
async function spriteIndex() {
  indexCache ??= fetch(new URL("../pokemon/index.json", HERE)).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return indexCache;
}
async function spriteOf(name, aliases) {
  const alias = aliases?.[name];
  const key = alias || name;
  if (/^https:\/\//i.test(key)) {
    const size = await new Promise((ok) => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok(null); i.src = key; });
    return size ? { url: key, ...size } : null;
  }
  const idx = await spriteIndex(), k = fold(key).trim();
  let hits = idx.filter((e) => fold(e.n) === k);
  let e = hits.find((x) => !x.v) ?? hits[0];
  if (!e) {
    // regional forms: "Vulpix de Alola", "Zorua Hisui", "Alolan Vulpix"
    const m = k.match(/^(.+?)\s+(?:de\s+|d[eo]\s+)?(alola|galar|hisui|paldea)$/) ?? k.match(/^(alola|galar|hisui|paldea)n?(?:ian)?\s+(.+)$/);
    if (m) {
      const [base, region] = /^(alola|galar|hisui|paldea)$/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
      hits = idx.filter((x) => fold(x.n) === base && fold(x.v).includes(region));
      e = hits[0];
    }
  }
  return e ? { url: new URL(`../pokemon/${e.f}`, HERE).href, w: e.w, h: e.h } : null;
}

// ---- cards: one per player of the config. -> { done: [names], missing: [nicknames without a sprite] }
export async function syncCards({ say = () => {}, force = false } = {}) {
  if (!ready()) throw new Error("configure o seu repositório e a chave em ⚙ GitHub");
  const cfg = await getConfig();
  const id = sheetId(cfg.sheet);
  if (!id) throw new Error("cole o link da planilha das fichas");
  if (!cfg.players.length) throw new Error("adicione pelo menos um jogador (o nome da aba dele na planilha)");
  const state = await getState();
  const lay = await layout();
  const css = await fontCss();
  const jobs = [], missing = new Set(), datas = {}, notes = [];
  // the PA Liga, when its site is set: the team on the card is the trainer's current one there
  let liga = null;
  if (cfg.paliga) {
    say("Lendo os times da PA Liga…");
    liga = await readPaliga(cfg.paliga).catch((err) => { notes.push(`PA Liga: ${err.message} (usei a equipe da planilha)`); return null; });
  }
  for (const p of cfg.players) {
    say(`Lendo a ficha de ${p.tab}…`);
    const d = await readTrainer(id, p.tab);
    datas[p.tab] = d;
    if (liga) {
      const tr = liga.find(p.paliga || d.name) ?? liga.find(p.tab);
      if (tr) d.team = tr.team.slice(0, 6).map((m) => ({ name: m.name, role: m.role }));
      else notes.push(`PA Liga: não achei o treinador de ${d.name} (usei a equipe da planilha)`);
    }
    const sig = hash(JSON.stringify([DRAW_VERSION, d.name, d.sub, d.money, d.badges, p.estilo, p.retrato, p.zoom, p.dx, p.dy, cfg.badges]));
    const item = lay.items.find((i) => mine(i, "card") && i.metadata[ITEM].tab === p.tab);
    if (!force && item && state.cards[p.tab]?.sig === sig) continue;
    say(`Desenhando o cartão de ${d.name}…`);
    // no link given: the extension's own retratos/<aba>.png, when there is one
    const portrait = p.retrato ? await embed(p.retrato) : await embed(`retratos/${slug(p.tab)}.png`).catch(() => null);
    const badgePics = cfg.badges?.length === 8 ? await Promise.all(cfg.badges.map((u) => embed(u).then((x) => x.href))) : null;
    const pic = await render(cardSVG(d, p.estilo, portrait, css, { zoom: Number(p.zoom) || 1, dx: Number(p.dx) || 0, dy: Number(p.dy) || 0, badgePics }), CARD_SCALE);
    jobs.push({ p, d, sig, pic, path: `painel/cartao-${slug(p.tab)}-${sig}.webp` });
  }
  if (jobs.length) {
    say(`Enviando ${jobs.length} cartão(ões) pro GitHub…`);
    const sha = await commitTree(`Painel: ${jobs.map((j) => j.d.name).join(", ")}`, async () => {
      const tree = [];
      for (const j of jobs) {
        const b = await gh("/git/blobs", { content: await base64(j.pic.blob), encoding: "base64" });
        tree.push(blobEntry(j.path, b.sha));
        const old = state.cards[j.p.tab]?.path;
        if (old && old !== j.path) tree.push(removeEntry(old));
      }
      return tree;
    }, say);
    for (const j of jobs) state.cards[j.p.tab] = { sig: j.sig, path: j.path, url: rawUrl(sha, j.path), width: j.pic.width, height: j.pic.height };
    await setState(state);
  }
  // the items: a new card goes to its place beside the map; an existing one keeps where the GM left it
  say("Arrumando a cena…");
  const add = [];
  for (const [i, p] of cfg.players.entries()) {
    const st = state.cards[p.tab];
    if (!st) continue;
    const item = lay.items.find((it) => mine(it, "card") && it.metadata[ITEM].tab === p.tab);
    const total = CARD.w + CARD.pad * 2;
    if (item) {
      if (item.image.url !== st.url) {
        await OBR.scene.items.updateItems([item.id], (list) => { for (const it of list) { it.image = { url: st.url, mime: "image/webp", width: st.width, height: st.height }; it.name = datas[p.tab]?.name ?? it.name; } });
      }
    } else {
      const cx = CARD.x0 + (i % 2) * (CARD.w + CARD.gap) + CARD.w / 2, cy = CARD.y0 + Math.floor(i / 2) * (CARD.h + CARD.gap) + CARD.h / 2;
      add.push(pictureItem(st.url, st, total, lay.L, lay.dpi).position(lay.at(cx, cy)).layer("PROP").locked(true).name(datas[p.tab]?.name ?? p.tab)
        .metadata({ [ITEM]: { kind: "card", tab: p.tab } }).build());
    }
  }
  if (add.length) await OBR.scene.items.addItems(add);
  // the team: sprites on the sockets of each card (a card whose team didn't change keeps its sprites)
  const now = await OBR.scene.items.getItems();
  const oldSprites = [];
  const sprites = [];
  for (const p of cfg.players) {
    const card = now.find((i) => mine(i, "card") && i.metadata[ITEM].tab === p.tab), d = datas[p.tab];
    if (!card || !d) continue;
    const unit = (card.image.width / card.grid.dpi) * lay.dpi * Math.abs(card.scale.x) / (CARD.w + CARD.pad * 2); // scene px per design unit
    const slots = teamSlots();
    const found = [];
    for (const [j, mon] of d.team.entries()) {
      const sp = await spriteOf(mon.name, cfg.aliases);
      if (!sp) missing.add(mon.name); else found.push({ j, mon, sp });
    }
    const have = now.filter((i) => mine(i, "poke") && i.metadata[ITEM].tab === p.tab).sort((a, b) => a.metadata[ITEM].slot - b.metadata[ITEM].slot);
    if (have.length === found.length && have.every((it, n) => it.image.url === found[n].sp.url && it.metadata[ITEM].slot === found[n].j)) continue;
    oldSprites.push(...have.map((i) => i.id));
    for (const { j, mon, sp } of found) {
      const s = slots[j], side = s.size * unit;
      sprites.push(buildImage({ url: sp.url, mime: /\.gif($|\?)/i.test(sp.url) ? "image/gif" : "image/png", width: sp.w, height: sp.h }, { dpi: Math.max(sp.w, sp.h) * lay.dpi / side, offset: { x: sp.w / 2, y: sp.h / 2 } })
        .position({ x: card.position.x + (s.x - CARD.w / 2) * unit, y: card.position.y + (s.y - CARD.h / 2) * unit })
        .layer("PROP").zIndex(card.zIndex + 1 + j).attachedTo(card.id).locked(true).disableHit(true).name(mon.name)
        .metadata({ [ITEM]: { kind: "poke", tab: p.tab, slot: j } }).build());
    }
  }
  oldSprites.push(...now.filter((i) => mine(i, "poke") && !cfg.players.some((p) => p.tab === i.metadata[ITEM].tab)).map((i) => i.id));
  if (oldSprites.length) await OBR.scene.items.deleteItems(oldSprites);
  if (sprites.length) await OBR.scene.items.addItems(sprites);
  return { done: jobs.map((j) => j.d.name), missing: [...missing], players: cfg.players.length, notes, teams: sprites.length > 0 };
}

// ---- the frame around the map (title, the two eras, the legend), with the map showing through the rift
export async function syncFrame({ say = () => {} } = {}) {
  if (!ready()) throw new Error("configure o seu repositório e a chave em ⚙ GitHub");
  const cfg = await getConfig(), state = await getState(), lay = await layout();
  const sig = hash(JSON.stringify([DRAW_VERSION, cfg.title, cfg.region, cfg.scale]));
  let item = lay.items.find((i) => mine(i, "frame"));
  if (!state.frame || state.frame.sig !== sig) {
    say("Desenhando a moldura do mapa…");
    const pic = await render(frameSVG({ title: cfg.title, region: cfg.region, scale: cfg.scale }, await fontCss()), FRAME_SCALE);
    say(`Enviando a moldura pro GitHub (${(pic.blob.size / 1048576).toFixed(1)} MB)…`);
    const path = `painel/moldura-${sig}.webp`;
    const sha = await commitTree("Painel: moldura do mapa", async () => {
      const b = await gh("/git/blobs", { content: await base64(pic.blob), encoding: "base64" });
      const tree = [blobEntry(path, b.sha)];
      if (state.frame?.path && state.frame.path !== path) tree.push(removeEntry(state.frame.path));
      return tree;
    }, say);
    state.frame = { sig, path, url: rawUrl(sha, path), width: pic.width, height: pic.height };
    await setState(state);
  }
  const st = state.frame;
  if (item) {
    if (item.image.url !== st.url) await OBR.scene.items.updateItems([item.id], (list) => { for (const it of list) it.image = { url: st.url, mime: "image/webp", width: st.width, height: st.height }; });
  } else {
    item = pictureItem(st.url, st, FRAME.w, lay.L, lay.dpi).position(lay.at(FRAME.x + FRAME.w / 2, FRAME.y + FRAME.h / 2))
      .layer("MAP").zIndex(lay.map.zIndex + 1).locked(true).disableHit(true).name("Moldura do mapa").metadata({ [ITEM]: { kind: "frame" } }).build();
    await OBR.scene.items.addItems([item]);
  }
  return true;
}

// takes everything this extension placed out of the scene (the pictures stay in the repository)
export async function clearScene() {
  const ids = (await OBR.scene.items.getItems()).filter((i) => mine(i)).map((i) => i.id);
  if (ids.length) await OBR.scene.items.deleteItems(ids);
  return ids.length;
}
