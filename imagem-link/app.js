// "Imagem por Link": puts an image (or video) item on the map that points to a link on another site.
// Owlbear only counts the files uploaded to it against the account's storage; an item that points
// somewhere else costs nothing. The page also edits the link of an image it placed (?id=...).
import OBR, { buildImage } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

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
  const raw = $("url").value;
  const url = directLink(raw);
  state.url = url;
  state.media = null;
  $("add").disabled = true;
  $("preview").classList.add("hidden");
  if (!url) { setStatus("Cole um link pra ver a prévia."); return syncSize(); }
  if (!/^https:\/\//i.test(url)) { setStatus("O link precisa começar com https://", "bad"); return syncSize(); }
  if (url !== raw.trim()) setStatus("Link convertido pro arquivo direto. Carregando…");
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
  if (!$("name").value) $("name").value = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "").slice(0, 60);
  // a fresh link starts at 1 image pixel = 1 scene pixel; when editing, keeps the size on the map
  if (state.editing) $("cells").value = r2(state.editing.cellsWide);
  else if (!$("ppc").value && !$("cells").value) $("ppc").value = state.sceneDpi;
  syncSize($("cells").value && state.editing ? "cells" : "ppc");
  setStatus(r.video ? "Vídeo OK (o Owlbear toca em loop)" : "Imagem OK", "ok");
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
  $("add").disabled = true;
  try {
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
  }
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
      state.editing = { id: it.id, cellsWide: (it.image.width / it.grid.dpi) * Math.abs(it.scale?.x ?? 1) };
      $("title").textContent = `Trocar link · ${it.name}`;
      $("url").value = it.image.url;
      $("name").value = it.name;
      $("locked").checked = !!it.locked;
      $("layerField").classList.add("hidden");
      $("add").textContent = "Trocar a imagem";
      check();
    }
  }

  $("url").addEventListener("input", () => { clearTimeout(state.t); state.t = setTimeout(check, 400); });
  $("paste").onclick = async () => {
    try { $("url").value = await navigator.clipboard.readText(); check(); }
    catch { $("url").focus(); setStatus("Use Ctrl+V no campo do link.", "warn"); }
  };
  $("cells").addEventListener("input", () => syncSize("cells"));
  $("ppc").addEventListener("input", () => syncSize("ppc"));
  $("layer").addEventListener("click", (e) => { if (e.target.dataset.v) selectedLayer(e.target.dataset.v); });
  $("add").onclick = add;
});
