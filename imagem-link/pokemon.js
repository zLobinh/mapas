// "Pokémon" tab: every sprite of the repository's pokemon/ folder, searchable. A click puts the
// token on the map (by link, so nothing counts against the Owlbear storage) or swaps the image of
// the selected token. The list comes from pokemon/index.json (tools/montar_pokemon.py builds it).
import OBR, { buildImage } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const META = "com.imagem-link/meta";
const PLACE = "com.imagem-link/place"; // handled by background.js
const BASE = new URL("../pokemon/", import.meta.url); // <repository>/pokemon/
const PAGE = 120; // thumbnails shown at a time
const REAL_PPC = 50; // "Sprite" size: 50 sprite pixels per square
const $ = (id) => document.getElementById(id);
const SIZE_KEY = "imagem-link/size";

const state = { all: [], list: [], shown: 0, size: "1", ready: false };

// the tabs must keep Owlbear's connection parameters (?obrref=...): without them this page loads
// but can't talk to the room, and clicking a Pokémon did nothing
for (const a of document.querySelectorAll(".tabs a")) {
  const params = new URLSearchParams(location.search);
  params.delete("id");
  a.href = `${a.getAttribute("href").split("?")[0]}?${params}`;
}
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const label = (e) => (e.v ? `${e.n} (${e.v})` : e.n);
const urlOf = (e) => new URL(encodeURIComponent(e.f), BASE).href;
const mimeOf = (f) => (f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/gif");

function search() {
  const words = fold($("q").value).split(/\s+/).filter(Boolean);
  state.list = !words.length ? state.all : state.all.filter((e) => {
    const hay = e._k;
    return words.every((w) => (/^\d+$/.test(w) ? e.d === Number(w) : hay.includes(w))); // a number = that dex number
  });
  state.shown = 0;
  $("grid").replaceChildren();
  more();
}

function more() {
  const slice = state.list.slice(state.shown, state.shown + PAGE);
  state.shown += slice.length;
  const frag = document.createDocumentFragment();
  for (const e of slice) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pcard";
    b.title = `#${e.d} ${label(e)} — clique e depois clique no mapa onde ele vai ficar (Ctrl+clique: centro da tela)`;
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = label(e);
    img.src = urlOf(e);
    const cap = document.createElement("span");
    cap.textContent = label(e);
    const num = document.createElement("i");
    num.textContent = `#${e.d}`;
    b.append(img, cap, num);
    b.onclick = (ev) => { state.center = ev.ctrlKey || ev.metaKey; place(e, b); };
    frag.append(b);
  }
  $("grid").append(frag);
  $("count").textContent = state.list.length
    ? `${state.list.length} encontrado(s)${state.list.length > state.shown ? `, mostrando ${state.shown}` : ""}`
    : "Nenhum Pokémon com esse nome.";
  $("more").classList.toggle("hidden", state.shown >= state.list.length);
}

// sprite pixels per square for the chosen size
function pixelsPerSquare(e) {
  if (state.size === "real") return REAL_PPC;
  return Math.max(e.w, e.h) / Number(state.size);
}

async function viewCenter() {
  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  return OBR.viewport.inverseTransformPoint({ x: w / 2, y: h / 2 });
}

async function place(e, button) {
  if (!state.ready) {
    $("count").textContent = "Esta janela não está conectada ao Owlbear. Feche a extensão e abra de novo (ou recarregue a página com F5).";
    $("count").className = "status small bad";
    return;
  }
  button.disabled = true;
  try {
    const image = { url: urlOf(e), mime: mimeOf(e.f), width: e.w, height: e.h };
    const grid = { dpi: pixelsPerSquare(e), offset: { x: e.w / 2, y: e.h / 2 } };
    if ($("swap").checked) {
      const sel = (await OBR.player.getSelection()) ?? [];
      const items = sel.length ? await OBR.scene.items.getItems(sel) : [];
      const target = items.find((i) => i.type === "IMAGE");
      if (!target) { await OBR.notification.show("Selecione no mapa o token que vai trocar de imagem.", "WARNING"); return; }
      // keep its size on the map (squares wide), just the new sprite
      const cells = (target.image.width / target.grid.dpi) * Math.abs(target.scale?.x ?? 1);
      await OBR.scene.items.updateItems([target.id], (drafts) => {
        for (const d of drafts) {
          d.image = image;
          d.grid = { dpi: Math.max(e.w, e.h) / cells, offset: { x: e.w / 2, y: e.h / 2 } };
          d.scale = { x: Math.sign(d.scale?.x || 1), y: Math.abs(d.scale?.y || 1) };
          d.metadata[META] = { url: image.url, pokemon: e.f };
        }
      });
      await OBR.notification.show(`${target.name} agora é ${label(e)}`);
    } else if (state.center) {
      // Ctrl+click: straight to the middle of the screen
      const item = buildImage(image, grid)
        .position(await viewCenter())
        .layer("CHARACTER")
        .name(label(e))
        .metadata({ [META]: { url: image.url, pokemon: e.f } })
        .build();
      await OBR.scene.items.addItems([item]);
      await OBR.player.select([item.id]);
    } else {
      // the token follows the mouse on the map; a click drops it (background.js)
      await OBR.broadcast.sendMessage(PLACE, {
        image, grid, cells: Math.max(e.w, e.h) / grid.dpi, name: label(e), layer: "CHARACTER",
        metadata: { [META]: { url: image.url, pokemon: e.f } },
      }, { destination: "LOCAL" });
    }
  } catch (err) {
    await OBR.notification.show(`Erro: ${err.message}`, "ERROR");
  } finally {
    button.disabled = false;
  }
}

function setSize(v) {
  state.size = v;
  for (const b of $("size").querySelectorAll("button")) b.classList.toggle("on", b.dataset.v === v);
  try { localStorage.setItem(SIZE_KEY, v); } catch {}
}

async function load() {
  $("count").textContent = "Carregando a lista…";
  try {
    const res = await fetch(new URL("index.json", BASE), { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.all = (await res.json()).map((e) => ({ ...e, _k: fold(`${e.d} ${String(e.d).padStart(4, "0")} ${e.n} ${e.v}`) }));
  } catch (err) {
    $("count").textContent = `Não achei a lista de Pokémon (pokemon/index.json): ${err.message}`;
    return;
  }
  search();
}

let t;
$("q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(search, 150); });
$("more").onclick = more;
$("size").addEventListener("click", (ev) => { if (ev.target.dataset.v) setSize(ev.target.dataset.v); });
try { setSize(localStorage.getItem(SIZE_KEY) || "1"); } catch { setSize("1"); }
load();

OBR.onReady(async () => {
  state.ready = true;
  const theme = await OBR.theme.getTheme();
  document.body.classList.toggle("light", theme.mode === "LIGHT");
  OBR.theme.onChange((th) => document.body.classList.toggle("light", th.mode === "LIGHT"));
  $("q").focus();
});
