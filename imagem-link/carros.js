// "Carros" tab: vehicles made with the "Pacote Owlbear" button of the Sketchfab viewer. Each one is a
// folder <repository>/carros/<name>/ with one transparent PNG per angle (clockwise) and carro.json.
// A click places the car (following the mouse, like the Pokémon); the token gets every angle as an
// image option in the format of the Changr extension ("Change Image"), and this extension's
// right-click "Girar" steps through them.
import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const META = "com.imagem-link/meta";
const CHANGR = "com.missing-link-dev.changr/metadata";
const PLACE = "com.imagem-link/place"; // handled by background.js
const BASE = new URL("../carros/", import.meta.url); // <repository>/carros/
const SIZE_KEY = "imagem-link/car-size";
const $ = (id) => document.getElementById(id);

const state = { cars: [], size: "2", ready: false };
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// keep Owlbear's connection parameters (?obrref=...) when switching tabs
for (const a of document.querySelectorAll(".tabs a")) {
  const params = new URLSearchParams(location.search);
  params.delete("id");
  a.href = `${a.getAttribute("href").split("?")[0]}?${params}`;
}

// the car folders: carros/index.json when there is one, otherwise the GitHub listing of carros/
// (the repository comes from the address: <owner>.github.io/<repository>/...)
async function carFolders() {
  const idx = await fetch(new URL("index.json", BASE), { cache: "no-cache" }).catch(() => null);
  if (idx?.ok) return (await idx.json()).map((x) => (typeof x === "string" ? x : x.pasta));
  const owner = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : null;
  const repo = location.pathname.split("/")[1];
  if (!owner || !repo) throw new Error("sem carros/index.json e fora do GitHub Pages");
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/carros`, { cache: "no-cache" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}${res.status === 403 ? " (limite de consultas; tente daqui a pouco)" : ""}`);
  return (await res.json()).filter((x) => x.type === "dir").map((x) => x.name);
}

async function load() {
  $("count").textContent = "Carregando os carros…";
  $("grid").replaceChildren();
  try {
    const folders = await carFolders();
    const cars = await Promise.all(folders.map(async (f) => {
      const base = new URL(`${encodeURIComponent(f)}/`, BASE);
      const r = await fetch(new URL("carro.json", base), { cache: "no-cache" }).catch(() => null);
      if (!r?.ok) return null;
      const c = await r.json();
      return { ...c, base, key: fold(`${c.nome} ${f}`) };
    }));
    state.cars = cars.filter((c) => c?.angulos?.length).sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (err) {
    $("count").textContent = `Não consegui listar os carros: ${err.message}`;
    return;
  }
  render();
}

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
    img.src = new URL(c.angulos[0], c.base).href;
    img.alt = c.nome;
    const cap = document.createElement("span");
    cap.textContent = c.nome;
    const n = document.createElement("i");
    n.textContent = `${c.angulos.length} âng.`;
    b.append(img, cap, n);
    b.onclick = (ev) => place(c, b, ev);
    frag.append(b);
  }
  $("grid").replaceChildren(frag);
  $("count").textContent = !state.cars.length
    ? "Nenhum carro ainda. Gere com o botão \"Pacote Owlbear\" do visualizador do Sketchfab e publique a pasta em carros/."
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
    const urls = c.angulos.map((f) => new URL(f, c.base).href);
    const imageOptions = urls.map((url, i) => ({
      id: crypto.randomUUID(), url, width: w, height: h, mime: "image/png",
      name: c.nome, dpi: grid.dpi, offset: { ...grid.offset },
      // (the angle number is in the picture order; the token keeps the car's name)
      label: `${i + 1}/${urls.length}`,
    }));
    await OBR.broadcast.sendMessage(PLACE, {
      image: { url: urls[0], mime: "image/png", width: w, height: h },
      grid, cells: Number(state.size), name: c.nome, layer: "CHARACTER",
      metadata: {
        [META]: { url: urls[0], carro: c.pasta },
        [CHANGR]: { imageOptions },
      },
    }, { destination: "LOCAL" });
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

$("q").addEventListener("input", render);
$("reload").onclick = load;
$("size").addEventListener("click", (ev) => { if (ev.target.dataset.v) setSize(ev.target.dataset.v); });
try { setSize(localStorage.getItem(SIZE_KEY) || "2"); } catch { setSize("2"); }
load();

OBR.onReady(async () => {
  state.ready = true;
  const theme = await OBR.theme.getTheme();
  document.body.classList.toggle("light", theme.mode === "LIGHT");
  OBR.theme.onChange((th) => document.body.classList.toggle("light", th.mode === "LIGHT"));
});
