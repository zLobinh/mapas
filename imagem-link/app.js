// "Imagem por Link": puts an image (or video) item on the map that points to a link on another site.
// Owlbear only counts the files uploaded to it against the account's storage; an item that points
// somewhere else costs nothing. The page also edits the link of an image it placed (?id=...).
//
// "Enviar do PC" (or drag / paste a picture): the file goes to this repository through the GitHub API, in
// imagens/<mapas|objetos|tokens>/, and the item points to it (see gh.js; the key stays in this browser).
import OBR, { buildImage } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { ready, gh, base64, slug, fold, commitTree, listDir, listNow, blobEntry, removeEntry, rawUrl, rawBranchUrl, wireKeyBox, needKey } from "./gh.js?v=1.7.0";

export const ID = "com.imagem-link";
const META = `${ID}/meta`;
const $ = (id) => document.getElementById(id);
const editId = new URLSearchParams(location.search).get("id");

// the tabs open the other page in this same popover: they must keep Owlbear's connection
// parameters (?obrref=...), or the other page loads but can't talk to the room
for (const a of document.querySelectorAll(".tabs a")) {
  const params = new URLSearchParams(location.search);
  params.delete("id"); // "Trocar link" edits one image; the tabs open the normal pages
  a.href = `${a.getAttribute("href").split("?")[0]}?${params}`;
}

const state = { url: "", media: null, layer: "MAP", sceneDpi: 150, editing: null };

// share links -> direct file links
export function directLink(raw) {
  let url = raw.trim();
  if (!url) return "";
  try {
    const u = new URL(url);
    // github.com/user/repo/blob/branch/path -> raw.githubusercontent.com/user/repo/branch/path
    let m = u.hostname === "github.com" && u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
    // drive.google.com/file/d/ID/view, open?id=ID, uc?id=ID -> lh3.googleusercontent.com/d/ID
    if (u.hostname === "drive.google.com") {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
      if (id) return `https://lh3.googleusercontent.com/d/${id}`;
    }
    // dropbox share links: dl=0 -> raw=1
    if (/(^|\.)dropbox\.com$/.test(u.hostname)) {
      u.searchParams.delete("dl");
      u.searchParams.set("raw", "1");
      return u.toString();
    }
    // imgur page (imgur.com/abc) -> i.imgur.com/abc.png
    m = u.hostname === "imgur.com" && u.pathname.match(/^\/([A-Za-z0-9]{5,8})$/);
    if (m) return `https://i.imgur.com/${m[1]}.png`;
  } catch { /* not a URL: the check below says so */ }
  return url;
}

const VIDEO = /\.(webm|mp4|m4v|mov)(\?|#|$)/i;
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", svg: "image/svg+xml", webm: "video/webm", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime" };
export const mimeOf = (url) => MIME[(url.split(/[?#]/)[0].split(".").pop() || "").toLowerCase()] ?? (VIDEO.test(url) ? "video/mp4" : "image/png");

// loads the file the way Owlbear will (cross-origin). Owlbear draws images with WebGL, so the site
// has to allow other sites to use them (CORS). -> { ok, width, height, video } or { ok:false, reason }
function probe(url) {
  const video = VIDEO.test(url);
  const load = (cors) => new Promise((resolve) => {
    const el = document.createElement(video ? "video" : "img");
    if (cors) el.crossOrigin = "anonymous";
    const done = (ok) => resolve({ ok, el, width: video ? el.videoWidth : el.naturalWidth, height: video ? el.videoHeight : el.naturalHeight, video });
    const timer = setTimeout(() => done(false), 20000);
    if (video) {
      el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true;
      el.onloadedmetadata = () => { clearTimeout(timer); done(true); };
    } else el.onload = () => { clearTimeout(timer); done(true); };
    el.onerror = () => { clearTimeout(timer); done(false); };
    el.src = url;
  });
  return load(true).then(async (r) => {
    if (r.ok) return r;
    const plain = await load(false);
    if (plain.ok) return { ok: false, el: plain.el, reason: "cors", width: plain.width, height: plain.height, video };
    return { ok: false, reason: "load" };
  });
}

function setStatus(text, kind = "") {
  const s = $("status");
  s.textContent = text;
  s.className = `status small ${kind || "muted"}`;
}

const r2 = (n) => Math.round(n * 100) / 100;

// size inputs: "squares wide" and "image pixels per square" move together
function syncSize(from) {
  const m = state.media;
  if (!m) { $("sizeInfo").textContent = ""; return; }
  if (from === "cells") {
    const cells = Number($("cells").value);
    if (cells > 0) $("ppc").value = r2(m.width / cells);
  } else {
    const ppc = Number($("ppc").value);
    if (ppc > 0) $("cells").value = r2(m.width / ppc);
  }
  const ppc = Number($("ppc").value) || m.width;
  const big = Math.max(m.width, m.height);
  const warn = big > 16384 ? " · mais de 16384 px: muitas placas de vídeo não mostram"
    : big > 8192 ? " · mais de 8192 px: pode não aparecer em PC fraco/celular" : "";
  $("sizeInfo").textContent = `Imagem ${m.width} × ${m.height} px → ${r2(m.width / ppc)} × ${r2(m.height / ppc)} quadrados${warn}`;
}

let probeToken = 0;
async function check() {
  const raw = state.file ? state.fileUrl : $("url").value;
  const url = state.file ? raw : directLink(raw);
  state.url = url;
  state.media = null;
  $("add").disabled = true;
  $("preview").classList.add("hidden");
  if (!url) { setStatus("Cole um link ou envie do PC pra ver a prévia."); return syncSize(); }
  if (!state.file && !/^https:\/\//i.test(url)) { setStatus("O link precisa começar com https://", "bad"); return syncSize(); }
  if (!state.file && url !== raw.trim()) setStatus("Link convertido pro arquivo direto. Carregando…");
  else setStatus("Carregando…");
  const token = ++probeToken;
  const r = await probe(url);
  if (token !== probeToken) return; // another link was pasted meanwhile
  const box = $("preview");
  box.replaceChildren();
  if (r.el) { box.append(r.el); box.classList.remove("hidden"); }
  if (!r.ok) {
    setStatus(r.reason === "cors"
      ? "Esse site não deixa outros sites usarem a imagem (CORS): o Owlbear não vai conseguir mostrar. Hospede em outro lugar (veja as dicas abaixo)."
      : "Não consegui abrir esse link. Confira se é o link direto do arquivo e se está público.", "bad");
    return syncSize();
  }
  state.media = { width: r.width, height: r.height, video: r.video };
  if (!$("name").value) $("name").value = decodeURIComponent((state.file?.name ?? url.split(/[?#]/)[0].split("/").pop()) || "").replace(/\.[a-z0-9]+$/i, "").slice(0, 60);
  // a fresh link starts at 1 image pixel = 1 scene pixel; when editing, keeps the size on the map
  if (state.editing) $("cells").value = r2(state.editing.cellsWide);
  else if (!$("ppc").value && !$("cells").value) $("ppc").value = state.sceneDpi;
  syncSize($("cells").value && state.editing ? "cells" : "ppc");
  setStatus(state.file ? `${r.video ? "Vídeo" : "Imagem"} do PC: vai pro GitHub quando você colocar no mapa`
    : r.video ? "Vídeo OK (o Owlbear toca em loop)" : "Imagem OK", "ok");
  $("add").disabled = false;
}

function selectedLayer(v) {
  state.layer = v;
  for (const b of $("layer").querySelectorAll("button")) b.classList.toggle("on", b.dataset.v === v);
  $("locked").checked = v === "MAP";
}

// the visible center of the map
async function viewCenter() {
  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  return OBR.viewport.inverseTransformPoint({ x: w / 2, y: h / 2 });
}

async function add() {
  const m = state.media;
  if (!m) return;
  const ppc = Number($("ppc").value);
  if (!(ppc > 0)) return setStatus("Defina o tamanho.", "bad");
  if (state.file && !needKey((t) => setStatus(t, "warn"))) return;
  $("add").disabled = true;
  try {
    // a file from the PC goes to GitHub first; the item points to it
    if (state.file) {
      const up = await uploadFile();
      clearFile(false);
      $("url").value = state.url = up.url;
    }
    const image = { url: state.url, mime: mimeOf(state.url), width: m.width, height: m.height };
    // grid.dpi = image pixels per square; offset = the image's center goes on the position
    const grid = { dpi: ppc, offset: { x: m.width / 2, y: m.height / 2 } };
    if (state.editing) {
      await OBR.scene.items.updateItems([state.editing.id], (items) => {
        for (const it of items) {
          it.image = image;
          it.grid = grid;
          it.name = $("name").value || it.name;
          it.locked = $("locked").checked;
          it.metadata[META] = { url: state.url };
        }
      });
      setStatus("Link trocado", "ok");
      await OBR.notification.show("Imagem atualizada pelo link");
    } else {
      const item = buildImage(image, grid)
        .position(await viewCenter())
        .layer(state.layer)
        .name($("name").value || "Imagem por link")
        .locked($("locked").checked)
        .metadata({ [META]: { url: state.url } })
        .build();
      await OBR.scene.items.addItems([item]);
      await OBR.player.select([item.id]);
      setStatus("Colocado no mapa (no centro da tela)", "ok");
    }
  } catch (e) {
    setStatus(`Erro: ${e.message}`, "bad");
  } finally {
    $("add").disabled = false;
    addLabel();
  }
}

// ---------------------------------------------------------------- files from the PC -> GitHub
const TIPOS = { MAP: "mapas", PROP: "objetos", CHARACTER: "tokens" };
const LAYER_OF = { mapas: "MAP", objetos: "PROP", tokens: "CHARACTER" };
const TIPO_NOME = { mapas: "Mapa", objetos: "Objeto", tokens: "Token" };
const mb = (n) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`);
const extOf = (name) => (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
const CONVERTIBLE = /^image\/(png|jpeg|bmp)$/;
const MAX_UPLOAD = 95 * 1048576; // (GitHub refuses files over 100 MB)

function addLabel() {
  $("add").textContent = state.editing ? (state.file ? "Enviar pro GitHub e trocar a imagem" : "Trocar a imagem")
    : state.file ? "Enviar pro GitHub e colocar no centro" : "Colocar no centro da tela";
}

function setFile(file) {
  if (!file) return;
  if (!/^(image|video)\//.test(file.type)) { setStatus("Esse arquivo não é imagem nem vídeo.", "bad"); return; }
  clearFile(false);
  state.file = file;
  state.fileUrl = URL.createObjectURL(file);
  $("url").value = "";
  $("name").value = "";
  if (!state.editing) $("cells").value = $("ppc").value = "";
  const convertible = CONVERTIBLE.test(file.type);
  $("webpRow").classList.toggle("hidden", !convertible);
  $("webp").checked = convertible && file.size > 1048576;
  $("fileInfo").textContent = `${file.name} · ${mb(file.size)}`;
  $("fileBox").classList.remove("hidden");
  addLabel();
  check();
}
function clearFile(recheck = true) {
  if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
  state.file = state.fileUrl = null;
  $("fileBox").classList.add("hidden");
  addLabel();
  if (recheck) check();
}

// a lighter copy (WEBP keeps transparency); null when it can't or isn't lighter
async function toWebp(file) {
  try {
    const bmp = await createImageBitmap(file);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext("2d").drawImage(bmp, 0, 0);
    bmp.close?.();
    const out = await c.convertToBlob({ type: "image/webp", quality: 0.9 });
    return out.type === "image/webp" && out.size < file.size ? out : null;
  } catch { return null; }
}

// -> { url, path }: one commit with the file in imagens/<tipo>/<name>.<ext> (a number when the name exists)
async function uploadFile() {
  let blob = state.file, ext = extOf(state.file.name) || (state.file.type.split("/")[1] ?? "png");
  if ($("webp").checked && !$("webpRow").classList.contains("hidden")) {
    setStatus("Convertendo pra WEBP…");
    const w = await toWebp(blob);
    if (w) { setStatus(`WEBP: ${mb(blob.size)} → ${mb(w.size)}`); blob = w; ext = "webp"; }
  }
  if (blob.size > MAX_UPLOAD) throw new Error(`o arquivo tem ${mb(blob.size)}; o GitHub aceita até 100 MB (tente o WEBP ou JPG)`);
  const tipo = TIPOS[state.editing?.layer ?? state.layer] ?? "objetos";
  const nome = $("name").value.trim() || state.file.name.replace(/\.[a-z0-9]+$/i, "");
  const base = slug(nome);
  setStatus(`Enviando ${mb(blob.size)} pro GitHub…`);
  const content = await base64(blob);
  let path;
  const sha = await commitTree(`${TIPO_NOME[tipo]}: ${nome}`, async (rootSha) => {
    const have = new Set((await listDir(rootSha, `imagens/${tipo}`)).map((x) => x.path.toLowerCase()));
    let f = `${base}.${ext}`;
    for (let n = 2; have.has(f); n++) f = `${base}-${n}.${ext}`;
    path = `imagens/${tipo}/${f}`;
    const b = await gh("/git/blobs", { content, encoding: "base64" });
    return [blobEntry(path, b.sha)];
  }, (t) => setStatus(t, "warn"));
  // usable right away from that exact commit; GitHub Pages takes a minute or two
  const url = rawUrl(sha, path);
  lib.fresh.set(path, { url, size: blob.size });
  lib.gone.delete(path);
  if ($("libBox").open) loadLibrary();
  return { url, path };
}

// ---------------------------------------------------------------- the files already sent (imagens/...)
const lib = { items: [], fresh: new Map(), gone: new Set(), loaded: false };
const urlOfLib = (it) => lib.fresh.get(it.path)?.url ?? rawBranchUrl(it.path);

async function loadLibrary() {
  $("libInfo").textContent = "Carregando…";
  const items = [];
  if (!ready()) {
    lib.items = []; lib.loaded = false;
    $("lib").replaceChildren();
    $("libInfo").textContent = "Configure o seu repositório em ⚙ GitHub pra ver e enviar arquivos.";
    return;
  }
  try {
    for (const tipo of Object.values(TIPOS)) {
      for (const x of await listNow(`imagens/${tipo}`)) if (x.type === "file") items.push({ name: x.name, path: x.path, size: x.size, tipo });
    }
  } catch (err) {
    $("libInfo").textContent = `Não consegui listar: ${err.message}`;
    return;
  }
  // just sent (the listing may not have it yet) / just deleted (may still be listed)
  for (const [path, f] of lib.fresh) {
    if (!items.some((i) => i.path === path)) items.push({ name: path.split("/").pop(), path, size: f.size, tipo: path.split("/")[1] });
  }
  lib.items = items.filter((i) => !lib.gone.has(i.path)).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.name.localeCompare(b.name));
  lib.loaded = true;
  renderLibrary();
}

function renderLibrary() {
  const words = fold($("libQ").value).split(/\s+/).filter(Boolean);
  const list = lib.items.filter((i) => words.every((w) => fold(`${i.name} ${TIPO_NOME[i.tipo]}`).includes(w)));
  $("libInfo").textContent = lib.items.length ? `${list.length} arquivo(s)` : "Nada enviado ainda. Use \"Enviar do PC\".";
  const rows = list.map((it) => {
    const row = document.createElement("div");
    row.className = "librow";
    const pic = document.createElement("div");
    pic.className = "libpic";
    // (thumbnails only for light files: a 50 MB map isn't downloaded just to show a tiny picture)
    if (it.size < 1.5 * 1048576 && !/\.(webm|mp4|m4v|mov)$/i.test(it.name)) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = urlOfLib(it);
      pic.append(img);
    } else pic.textContent = extOf(it.name).toUpperCase();
    const txt = document.createElement("div");
    txt.className = "libtxt";
    const b = document.createElement("b");
    b.textContent = it.name;
    const s = document.createElement("span");
    s.className = "muted";
    s.textContent = `${TIPO_NOME[it.tipo] ?? it.tipo} · ${mb(it.size)}`;
    txt.append(b, s);
    const use = document.createElement("button");
    use.type = "button";
    use.textContent = "Usar";
    use.title = "Põe o link no campo acima (depois é só colocar no mapa)";
    use.onclick = () => {
      clearFile(false);
      if (!state.editing && LAYER_OF[it.tipo]) selectedLayer(LAYER_OF[it.tipo]);
      $("url").value = urlOfLib(it);
      $("name").value = it.name.replace(/\.[a-z0-9]+$/i, "");
      if (!state.editing) $("cells").value = $("ppc").value = "";
      check();
      $("app").scrollIntoView({ behavior: "smooth" });
    };
    row.append(pic, txt, use);
    if (ready()) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "libdel";
      del.textContent = "✕";
      del.title = "Apagar do GitHub (some de todos os mapas que usam essa imagem)";
      del.onclick = async () => {
        if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "apagar?"; setTimeout(() => { if (del.isConnected) { del.dataset.sure = ""; del.textContent = "✕"; } }, 3000); return; }
        del.disabled = true;
        try {
          $("libInfo").textContent = `Apagando ${it.name}…`;
          await commitTree(`Remover ${TIPO_NOME[it.tipo]?.toLowerCase() ?? "imagem"}: ${it.name}`, async () => [removeEntry(it.path)], (t) => ($("libInfo").textContent = t));
          lib.gone.add(it.path);
          lib.fresh.delete(it.path);
          lib.items = lib.items.filter((i) => i.path !== it.path);
          renderLibrary();
          $("libInfo").textContent = `✓ ${it.name} apagado do GitHub.`;
        } catch (err) {
          $("libInfo").textContent = `Não consegui apagar: ${err.message}`;
          del.disabled = false; del.dataset.sure = ""; del.textContent = "✕";
        }
      };
      row.append(del);
    }
    return row;
  });
  $("lib").replaceChildren(...rows);
}

OBR.onReady(async () => {
  const theme = await OBR.theme.getTheme();
  document.body.classList.toggle("light", theme.mode === "LIGHT");
  OBR.theme.onChange((t) => document.body.classList.toggle("light", t.mode === "LIGHT"));
  if (await OBR.scene.isReady()) state.sceneDpi = await OBR.scene.grid.getDpi();

  if (editId) {
    // "Trocar link": same item, new file, same size on the map
    const [it] = await OBR.scene.items.getItems([editId]);
    if (it?.image) {
      state.editing = { id: it.id, layer: it.layer, cellsWide: (it.image.width / it.grid.dpi) * Math.abs(it.scale?.x ?? 1) };
      $("title").textContent = `Trocar link · ${it.name}`;
      $("url").value = it.image.url;
      $("name").value = it.name;
      $("locked").checked = !!it.locked;
      $("layerField").classList.add("hidden");
      addLabel();
      check();
    }
  }

  $("url").addEventListener("input", () => { if (state.file) clearFile(false); clearTimeout(state.t); state.t = setTimeout(check, 400); });
  $("paste").onclick = async () => {
    try { $("url").value = await navigator.clipboard.readText(); check(); }
    catch { $("url").focus(); setStatus("Use Ctrl+V no campo do link.", "warn"); }
  };
  $("cells").addEventListener("input", () => syncSize("cells"));
  $("ppc").addEventListener("input", () => syncSize("ppc"));
  $("layer").addEventListener("click", (e) => { if (e.target.dataset.v) selectedLayer(e.target.dataset.v); });
  $("add").onclick = add;
});

// (these work even before Owlbear connects: choosing a file only needs the page)
$("fromPC").onclick = () => { $("file").value = ""; $("file").click(); };
$("file").onchange = (ev) => setFile(ev.target.files?.[0]);
$("fileClear").onclick = () => clearFile();
// paste a picture (a print, a copied image) anywhere outside the text fields; drop a file on the page
document.addEventListener("paste", (ev) => {
  const f = [...(ev.clipboardData?.files ?? [])].find((x) => /^(image|video)\//.test(x.type));
  if (!f) return;
  ev.preventDefault();
  // (a pasted print comes as "image.png": a name with the date is easier to find later)
  setFile(f.name === "image.png" ? new File([f], `imagem-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.png`, { type: f.type }) : f);
});
document.addEventListener("dragover", (ev) => { if ([...ev.dataTransfer.types].includes("Files")) { ev.preventDefault(); document.body.classList.add("drop"); } });
document.addEventListener("dragleave", (ev) => { if (!ev.relatedTarget) document.body.classList.remove("drop"); });
document.addEventListener("drop", (ev) => {
  document.body.classList.remove("drop");
  const f = ev.dataTransfer?.files?.[0];
  if (!f) return;
  ev.preventDefault();
  setFile(f);
});
$("libBox").addEventListener("toggle", () => { if ($("libBox").open && !lib.loaded) loadLibrary(); });
$("libQ").addEventListener("input", renderLibrary);
wireKeyBox((t) => setStatus(t, /^✓/.test(t) ? "ok" : "warn"), () => { lib.loaded = false; if ($("libBox").open) loadLibrary(); });
