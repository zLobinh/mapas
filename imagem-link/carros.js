// "Carros" tab: vehicles made with the "Pacote Owlbear" button of the Sketchfab viewer. Each one is a
// folder <repository>/carros/<name>/ with one transparent PNG per angle (clockwise) and carro.json.
// A click places the car (following the mouse, like the Pokémon); the token gets every angle as an
// image option in the format of the Changr extension ("Change Image"), and this extension's
// right-click "Girar" steps through them.
//
// "＋ Carro do PC": the folder the Sketchfab viewer saved goes straight to the repository through the GitHub
// API (one commit with the PNGs and carro.json), with a GitHub key (fine-grained token, "Contents: read and
// write" on this repository only) kept ONLY in this browser (localStorage). The new car shows up at once from
// that exact commit on raw.githubusercontent.com (no waiting for GitHub Pages); the other players see it too.
import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { HOST_OWNER, HOST_REPO, ready, sameAsHost, gh, base64, fold, slug, commitTree, listDir, listNow, blobEntry, removeEntry, rawUrl, rawBranchUrl, wireKeyBox, needKey } from "./gh.js?v=1.7.0";

const ROOM_CARS = "com.imagem-link/carros"; // (older version: cars kept in the room, still listed)
const META = "com.imagem-link/meta";
const CHANGR = "com.missing-link-dev.changr/metadata";
const PLACE = "com.imagem-link/place"; // handled by background.js
const BASE = new URL("../carros/", import.meta.url); // <repository>/carros/
const SIZE_KEY = "imagem-link/car-size";
const $ = (id) => document.getElementById(id);

const state = { cars: [], size: "2", ready: false };
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
// (a message stays until the next one: the list refreshing doesn't wipe it)
const say = (t) => { state.note = t || null; $("count").textContent = t || countText(); };

// keep Owlbear's connection parameters (?obrref=...) when switching tabs
for (const a of document.querySelectorAll(".tabs a")) {
  const params = new URLSearchParams(location.search);
  params.delete("id");
  a.href = `${a.getAttribute("href").split("?")[0]}?${params}`;
}

// the extension's own catalog (the repository it is published from: read-only for everyone)
async function catalogFolders() {
  const idx = await fetch(new URL("index.json", BASE), { cache: "no-cache" }).catch(() => null);
  if (idx?.ok) return (await idx.json()).map((x) => (typeof x === "string" ? x : x.pasta));
  const res = await fetch(`https://api.github.com/repos/${HOST_OWNER}/${HOST_REPO}/contents/carros`, { cache: "no-cache" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}${res.status === 403 ? " (limite de consultas; tente daqui a pouco)" : ""}`);
  return (await res.json()).filter((x) => x.type === "dir").map((x) => x.name);
}
// one car folder of the catalog: from GitHub Pages, or (Pages not updated yet) straight from the repository
async function readCatalogCar(f) {
  const bases = [new URL(`${encodeURIComponent(f)}/`, BASE), new URL(`https://raw.githubusercontent.com/${HOST_OWNER}/${HOST_REPO}/main/carros/${encodeURIComponent(f)}/`)];
  for (const base of bases) {
    const r = await fetch(new URL("carro.json", base), { cache: "no-cache" }).catch(() => null);
    if (!r?.ok) continue;
    const c = await r.json();
    return { ...c, base: new URL(c.base ?? base), key: fold(`${c.nome} ${f}`) };
  }
  return null;
}
// the cars in the person's own repository (⚙ GitHub): these can be deleted
async function myCars() {
  if (!ready()) return [];
  const dirs = (await listNow("carros")).filter((x) => x.type === "dir").map((x) => x.name);
  const cars = await Promise.all(dirs.map(async (f) => {
    const base = new URL(rawBranchUrl(`carros/${f}/`));
    const r = await fetch(new URL("carro.json", base), { cache: "no-cache" }).catch(() => null);
    if (!r?.ok) return null;
    const c = await r.json();
    return { ...c, pasta: c.pasta ?? f, base, mine: true, key: fold(`${c.nome} ${f} meu`) };
  }));
  return cars.filter(Boolean);
}

async function load() {
  $("count").textContent = "Carregando os carros…";
  $("grid").replaceChildren();
  const problems = [];
  const [mine, catalog] = await Promise.all([
    myCars().catch((err) => { problems.push(`do seu repositório: ${err.message}`); return []; }),
    // (when the person's repository IS the catalog, it's listed once, as theirs)
    sameAsHost() && ready() ? [] : catalogFolders().then((fs) => Promise.all(fs.map(readCatalogCar))).catch((err) => { problems.push(`do catálogo: ${err.message}`); return []; }),
  ]);
  // (a car just deleted may still be listed for a few minutes)
  let repo = [...mine, ...catalog.filter((c) => c && !mine.some((m) => m.pasta === c.pasta))]
    .filter((c) => c?.angulos?.length && !state.gone?.has(c.pasta));
  // a car just sent keeps its commit address (the listing may not have it yet)
  for (const c of state.fresh ?? []) { repo = repo.filter((r) => r.pasta !== c.pasta); repo.push(c); }
  state.repo = repo;
  if (problems.length) say(`Não consegui listar os carros ${problems.join("; ")}`);
  await loadRoomCars();
}// the cars kept in the room by an older version (full addresses, no base folder)
async function loadRoomCars() {
  let room = [];
  if (state.ready) room = ((await OBR.room.getMetadata().catch(() => ({})))[ROOM_CARS] ?? []);
  state.room = room.map((c) => ({ ...c, room: true, key: fold(`${c.nome} owlbear sala`) }));
  state.cars = [...state.room, ...(state.repo ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
  render();
}
const urlOf = (c, f) => (c.base ? new URL(f, c.base).href : f);

function render() {
  const words = fold($("q").value).split(/\s+/).filter(Boolean);
  const list = state.cars.filter((c) => words.every((w) => c.key.includes(w)));
  const frag = document.createDocumentFragment();
  for (const c of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pcard";
    b.title = `${c.nome}: ${c.angulos.length} ângulos. Clique e depois clique no mapa.`;
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = urlOf(c, c.angulos[0]);
    img.alt = c.nome;
    const cap = document.createElement("span");
    cap.textContent = c.nome;
    const n = document.createElement("i");
    n.textContent = `${c.angulos.length} âng.${c.room ? " · sala" : ""}`;
    b.append(img, cap, n);
    b.onclick = (ev) => place(c, b, ev);
    if (c.room) {
      const x = document.createElement("span");
      x.className = "del";
      x.textContent = "✕";
      x.title = "Tirar da lista desta sala";
      x.onclick = async (ev) => {
        ev.stopPropagation();
        if (x.dataset.sure !== "1") { x.dataset.sure = "1"; x.textContent = "tirar?"; setTimeout(() => { x.dataset.sure = ""; x.textContent = "✕"; }, 3000); return; }
        const rest = ((await OBR.room.getMetadata())[ROOM_CARS] ?? []).filter((r) => r.id !== c.id);
        await OBR.room.setMetadata({ [ROOM_CARS]: rest });
      };
      b.append(x);
    } else if (c.mine && ready()) {
      // a car in the repository: with the GitHub key, ✕ deletes it (a commit removing carros/<pasta>/)
      const x = document.createElement("span");
      x.className = "del";
      x.textContent = "✕";
      x.title = "Apagar este carro do GitHub";
      x.onclick = async (ev) => {
        ev.stopPropagation();
        if (x.dataset.sure !== "1") { x.dataset.sure = "1"; x.textContent = "apagar?"; setTimeout(() => { if (x.isConnected) { x.dataset.sure = ""; x.textContent = "✕"; } }, 3000); return; }
        x.textContent = "…";
        try { await deleteCar(c); } catch (err) { say(`Não consegui apagar: ${err.message}`); x.dataset.sure = ""; x.textContent = "✕"; }
      };
      b.append(x);
    }
    frag.append(b);
  }
  $("grid").replaceChildren(frag);
  $("count").textContent = state.note ?? countText(list);
}
function countText(list = state.cars) {
  return !state.cars.length
    ? "Nenhum carro ainda. Gere com o botão \"Pacote Owlbear\" do visualizador do Sketchfab e use \"＋ Carro do PC\"."
    : `${list.length} carro(s)`;
}

async function place(c, button) {
  if (!state.ready) {
    $("count").textContent = "Esta janela não está conectada ao Owlbear. Feche a extensão e abra de novo.";
    return;
  }
  button.disabled = true;
  try {
    const w = c.largura, h = c.altura;
    // the longer side of the picture = the chosen number of squares
    const grid = { dpi: Math.max(w, h) / Number(state.size), offset: { x: w / 2, y: h / 2 } };
    const urls = c.angulos.map((f) => urlOf(c, f));
    const mime = c.mime ?? "image/png";
    const imageOptions = urls.map((url, i) => ({
      id: crypto.randomUUID(), url, width: w, height: h, mime,
      name: c.nome, dpi: grid.dpi, offset: { ...grid.offset },
      // (the angle number is in the picture order; the token keeps the car's name)
      label: `${i + 1}/${urls.length}`,
    }));
    await OBR.broadcast.sendMessage(PLACE, {
      image: { url: urls[0], mime, width: w, height: h },
      grid, cells: Number(state.size), name: c.nome, layer: "CHARACTER",
      metadata: {
        [META]: { url: urls[0], carro: c.pasta ?? c.id },
        [CHANGR]: { imageOptions },
      },
    }, { destination: "LOCAL" });
  } catch (err) {
    await OBR.notification.show(`Erro: ${err.message}`, "ERROR");
  } finally {
    button.disabled = false;
  }
}

// ---------------------------------------------------------------- "＋ Carro do PC" -> GitHub

// ---- reading a folder: one car or many mixed together (the Downloads folder itself, subfolders, renamed files)
const isPic = (f) => /\.(png|webp)$/i.test(f.name);
const dirOf = (f) => (f.webkitRelativePath || f.name).split("/").slice(0, -1).join("/");
const lastDir = (d) => d.split("/").pop() || "";

async function readFolder(files) {
  const pics = [];
  for (const f of files.filter(isPic)) {
    try {
      const b = await createImageBitmap(f);
      pics.push({ file: f, dir: dirOf(f), w: b.width, h: b.height, t: f.lastModified, used: false });
      b.close?.();
    } catch { /* not a picture */ }
  }
  const metas = [];
  for (const f of files.filter((f) => /\.json$/i.test(f.name))) {
    const m = await f.text().then(JSON.parse).catch(() => null);
    if (m && Array.isArray(m.angulos) && m.angulos.length) metas.push({ m, dir: dirOf(f), t: f.lastModified });
  }
  metas.sort((a, b) => a.t - b.t);

  const cars = [];
  for (const { m, dir, t } of metas) {
    const free = pics.filter((p) => !p.used && p.dir === dir);
    const pick = (test) => { const p = free.find((q) => !q.used && test(q)); if (p) p.used = true; return p; };
    // 1. the file names the pack wrote
    let got = m.angulos.map((n) => pick((p) => p.file.name.toLowerCase() === String(n).toLowerCase())).filter(Boolean);
    // 2. renamed files (the browser sometimes saves them with random names): the byte sizes the pack wrote
    if (!got.length && Array.isArray(m.bytes)) got = m.bytes.map((s) => pick((p) => p.file.size === s)).filter(Boolean);
    // 3. older packs: same picture size, saved right before this carro.json, in the order they were saved
    if (!got.length) {
      got = free.filter((p) => !p.used && p.w === m.largura && p.h === m.altura && p.t <= t + 5000)
        .sort((a, b) => a.t - b.t).slice(-m.angulos.length);
      got.forEach((p) => (p.used = true));
    }
    if (!got.length) continue;
    const nome = String(m.nome || lastDir(dir) || "Carro").trim();
    cars.push({ nome, pasta: slug(m.pasta || nome), pics: got.map((p) => p.file), w: m.largura || got[0].w, h: m.altura || got[0].h, want: m.angulos.length, t });
  }
  // pictures with no carro.json: one car per folder and picture size, in the order they were saved
  const groups = new Map();
  for (const p of pics.filter((q) => !q.used)) {
    const k = `${p.dir}|${p.w}x${p.h}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.t - b.t || natural(a.file.name, b.file.name));
    const nome = lastDir(list[0].dir) || "Carro";
    cars.push({ nome, pasta: slug(nome), pics: list.map((p) => p.file), w: list[0].w, h: list[0].h, want: list.length, t: list.at(-1).t, loose: true });
  }

  // the same car twice (a pack made again): the complete one wins, then the newest
  const score = (c) => [c.pics.length >= c.want ? 1 : 0, c.t];
  const best = new Map();
  for (const c of cars) {
    const o = best.get(c.pasta);
    const [a1, a2] = score(c), [b1, b2] = o ? score(o) : [-1, -1];
    if (!o || a1 > b1 || (a1 === b1 && a2 > b2)) best.set(c.pasta, c);
  }
  const count = new Map();
  for (const c of cars) {
    c.dup = best.get(c.pasta) !== c && !c.loose;
    // pictures without a carro.json that ended with a repeated name get a number
    if (c.loose && best.get(c.pasta) !== c) {
      const n = (count.get(c.pasta) ?? 1) + 1;
      count.set(c.pasta, n);
      c.nome = `${c.nome} ${n}`;
      c.pasta = slug(c.nome);
    }
    c.on = !c.dup && c.pics.length >= c.want && c.pics.length > 0;
  }
  return cars.sort((a, b) => a.t - b.t);
}

// ---- the review: what was found, before anything is sent
let review = [];
function showReview(cars) {
  review = cars;
  for (const u of state.thumbs ?? []) URL.revokeObjectURL(u);
  state.thumbs = [];
  const box = $("rvList");
  box.replaceChildren();
  for (const c of cars) {
    const row = document.createElement("div");
    row.className = "rv";
    const head = document.createElement("label");
    head.className = "row";
    const on = document.createElement("input");
    on.type = "checkbox";
    on.checked = c.on;
    on.onchange = () => { c.on = on.checked; countReview(); };
    const name = document.createElement("input");
    name.type = "text";
    name.value = c.nome;
    name.oninput = () => { c.nome = name.value.trim() || c.nome; c.pasta = slug(c.nome); note.textContent = noteOf(c); };
    head.append(on, name);
    const strip = document.createElement("div");
    strip.className = "rv-pics";
    const drawPics = () => {
      strip.replaceChildren(...c.pics.map((f, i) => {
        const img = document.createElement("img");
        const u = URL.createObjectURL(f);
        state.thumbs.push(u);
        img.src = u;
        img.title = i ? `Ângulo ${i + 1}. Clique pra passar ele uma posição pra frente.` : "Ângulo 1 (o que entra no mapa)";
        img.onclick = () => { if (!i) return; [c.pics[i - 1], c.pics[i]] = [c.pics[i], c.pics[i - 1]]; drawPics(); };
        return img;
      }));
    };
    drawPics();
    const note = document.createElement("div");
    note.className = "small muted";
    note.textContent = noteOf(c);
    row.append(head, strip, note);
    box.append(row);
  }
  $("review").classList.remove("hidden");
  countReview();
}
function noteOf(c) {
  const parts = [`${c.pics.length} ângulo(s) · ${c.w}×${c.h}`];
  if (c.pics.length < c.want) parts.push(`⚠ faltam ${c.want - c.pics.length} ângulo(s) do pacote`);
  if (c.dup) parts.push("repetido (versão mais antiga ou incompleta)");
  if (c.loose) parts.push("sem carro.json: confira a ordem");
  if ((state.repo ?? []).some((r) => r.mine && r.pasta === c.pasta)) parts.push("substitui o que já está no seu GitHub");
  return parts.join(" · ");
}
function countReview() {
  const n = review.filter((c) => c.on).length;
  $("rvSend").textContent = n ? `Enviar ${n} carro(s) pro GitHub` : "Marque um carro";
  $("rvSend").disabled = !n;
}
function closeReview() {
  $("review").classList.add("hidden");
  $("rvList").replaceChildren();
  for (const u of state.thumbs ?? []) URL.revokeObjectURL(u);
  state.thumbs = [];
  review = [];
}

// ---- GitHub: one commit for everything (blobs -> tree on top of the current one -> commit -> move the branch)
// the files already in carros/<pasta>/ (to delete a car, or the leftovers when a car is sent again)
async function carFiles(rootSha, pastas) {
  const out = new Map();
  for (const p of pastas) out.set(p, (await listDir(rootSha, `carros/${p}`)).filter((x) => x.type === "blob").map((x) => x.path));
  return out;
}

async function sendCars(cars) {
  const made = [];
  const label = cars.length === 1 ? cars[0].nome : `${cars.length} carros`;
  const sha = await commitTree(cars.length === 1 ? `Carro: ${cars[0].nome}` : `Carros: ${cars.map((c) => c.nome).join(", ")}`, async (rootSha) => {
    const old = await carFiles(rootSha, cars.map((c) => c.pasta));
    const tree = [];
    for (const c of cars) {
      // clean names in the repository (the files may have come with random ones)
      const names = c.pics.map((f, i) => `${c.pasta}_${i + 1}.${(f.name.match(/\.(png|webp)$/i)?.[1] ?? "png").toLowerCase()}`);
      for (let i = 0; i < c.pics.length; i++) {
        say(`Enviando ${c.nome}: ângulo ${i + 1} de ${c.pics.length}…`);
        const blob = await gh("/git/blobs", { content: await base64(c.pics[i]), encoding: "base64" });
        tree.push(blobEntry(`carros/${c.pasta}/${names[i]}`, blob.sha));
      }
      const car = { nome: c.nome, pasta: c.pasta, largura: c.w, altura: c.h, angulos: names };
      const json = await gh("/git/blobs", { content: JSON.stringify(car, null, 2), encoding: "utf-8" });
      tree.push(blobEntry(`carros/${c.pasta}/carro.json`, json.sha));
      // a car sent again with fewer angles: the old extra pictures go away
      for (const f of old.get(c.pasta) ?? []) if (f !== "carro.json" && !names.includes(f)) tree.push(removeEntry(`carros/${c.pasta}/${f}`));
      made.push(car);
    }
    say(`Gravando ${label} no GitHub…`);
    return tree;
  }, say);
  // usable right away from that exact commit (raw.githubusercontent.com: right image type and CORS, which
  // Owlbear needs; jsDelivr refuses repositories this big), no waiting for GitHub Pages
  for (const car of made) {
    const fresh = { ...car, base: new URL(rawUrl(sha, `carros/${car.pasta}/`)), mine: true, key: fold(`${car.nome} ${car.pasta} meu`) };
    state.fresh = [...(state.fresh ?? []).filter((c) => c.pasta !== car.pasta), fresh];
    state.repo = [...(state.repo ?? []).filter((c) => c.pasta !== car.pasta), fresh];
    state.gone?.delete(car.pasta);
  }
  await loadRoomCars();
  say(`✓ ${label} no GitHub. Já dá pra usar: clique no carro e depois no mapa.`);
}

async function deleteCar(c) {
  say(`Apagando ${c.nome} do GitHub…`);
  await commitTree(`Remover carro: ${c.nome}`, async (rootSha) => {
    const files = (await carFiles(rootSha, [c.pasta])).get(c.pasta) ?? [];
    if (!files.length) throw new Error(`a pasta carros/${c.pasta} não está no repositório`);
    return files.map((f) => removeEntry(`carros/${c.pasta}/${f}`));
  }, say);
  (state.gone ??= new Set()).add(c.pasta);
  state.fresh = (state.fresh ?? []).filter((x) => x.pasta !== c.pasta);
  state.repo = (state.repo ?? []).filter((x) => x.pasta !== c.pasta);
  await loadRoomCars();
  say(`✓ ${c.nome} apagado do GitHub.`);
}

$("fromPC").onclick = () => {
  if (!needKey(say)) return;
  $("folder").value = "";
  $("folder").click();
};
$("folder").onchange = async (ev) => {
  const files = [...(ev.target.files ?? [])];
  if (!files.length) return;
  $("fromPC").disabled = true;
  try {
    say("Lendo a pasta…");
    const cars = await readFolder(files);
    if (!cars.length) { say("Não achei imagens de carro (PNG) nessa pasta."); return; }
    say(null);
    showReview(cars);
  } catch (err) { say(`Não deu certo: ${err.message}`); }
  finally { $("fromPC").disabled = false; }
};
$("rvCancel").onclick = closeReview;
$("rvSend").onclick = async () => {
  const cars = review.filter((c) => c.on && c.pics.length);
  // two cars with the same name would land in the same folder
  const seen = new Set();
  for (const c of cars) { if (seen.has(c.pasta)) { say(`Dois carros marcados com o nome "${c.nome}": mude um deles.`); return; } seen.add(c.pasta); }
  $("rvSend").disabled = $("rvCancel").disabled = $("fromPC").disabled = true;
  try { await sendCars(cars); closeReview(); }
  catch (err) { say(`Não deu certo: ${err.message}`); }
  finally { $("rvCancel").disabled = $("fromPC").disabled = false; countReview(); }
};

// the key: only in this browser (the ✕ that deletes from GitHub needs it)
wireKeyBox(say, (ok) => { if (ok !== state.wasReady) { state.wasReady = ok; load(); } });

function setSize(v) {
  state.size = v;
  for (const b of $("size").querySelectorAll("button")) b.classList.toggle("on", b.dataset.v === v);
  try { localStorage.setItem(SIZE_KEY, v); } catch {}
}

$("q").addEventListener("input", render);
$("reload").onclick = () => { state.note = null; load(); };
$("size").addEventListener("click", (ev) => { if (ev.target.dataset.v) setSize(ev.target.dataset.v); });
try { setSize(localStorage.getItem(SIZE_KEY) || "2"); } catch { setSize("2"); }

OBR.onReady(async () => {
  state.ready = true;
  await loadRoomCars();
  OBR.room.onMetadataChange(() => { loadRoomCars().catch(() => {}); });
  const theme = await OBR.theme.getTheme();
  document.body.classList.toggle("light", theme.mode === "LIGHT");
  OBR.theme.onChange((th) => document.body.classList.toggle("light", th.mode === "LIGHT"));
});
