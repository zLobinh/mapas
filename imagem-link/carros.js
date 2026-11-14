// "Carros" tab: vehicles made with the "Pacote Owlbear" button of the Sketchfab viewer. Each one is a
// folder <repository>/carros/<name>/ with one transparent PNG per angle (clockwise) and carro.json.
// A click places the car (following the mouse, like the Pokémon); the token gets every angle as an
// image option in the format of the Changr extension ("Change Image"), and this extension's
// right-click "Girar" steps through them.
import OBR, { buildImageUpload } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

// Cars straight from the PC (no GitHub): the angle PNGs go to the Owlbear account's own storage
// (OBR.assets.uploadImages), the player ticks them in Owlbear's image picker (OBR.assets.downloadImages,
// which gives back their addresses) and the car is saved in the ROOM metadata, so everyone in the room
// sees it in this list. Costs the account's storage (~200 KB per angle), unlike the GitHub ones.
const ROOM_CARS = "com.imagem-link/carros";
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
  let repo = [];
  try {
    const folders = await carFolders();
    const cars = await Promise.all(folders.map(async (f) => {
      const base = new URL(`${encodeURIComponent(f)}/`, BASE);
      const r = await fetch(new URL("carro.json", base), { cache: "no-cache" }).catch(() => null);
      if (!r?.ok) return null;
      const c = await r.json();
      return { ...c, base, key: fold(`${c.nome} ${f}`) };
    }));
    repo = cars.filter((c) => c?.angulos?.length);
  } catch (err) {
    $("count").textContent = `Não consegui listar os carros do repositório: ${err.message}`;
  }
  state.repo = repo;
  await loadRoomCars();
}
// the cars of this room (sent from the PC / built from Owlbear images): full addresses, no base folder
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
    // a room car can be taken off the list (its images stay in the Owlbear storage)
    if (c.room) {
      const x = document.createElement("span");
      x.className = "del";
      x.textContent = "✕";
      x.title = "Tirar da lista desta sala (as imagens continuam no armazenamento do Owlbear)";
      x.onclick = async (ev) => {
        ev.stopPropagation();
        if (x.dataset.sure !== "1") { x.dataset.sure = "1"; x.textContent = "tirar?"; setTimeout(() => { x.dataset.sure = ""; x.textContent = "✕"; }, 3000); return; }
        const list = ((await OBR.room.getMetadata())[ROOM_CARS] ?? []).filter((r) => r.id !== c.id);
        await OBR.room.setMetadata({ [ROOM_CARS]: list });
      };
      b.append(x);
    }
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
    const urls = c.angulos.map((f) => urlOf(c, f));
    const imageOptions = urls.map((url, i) => ({
      id: crypto.randomUUID(), url, width: w, height: h, mime: "image/png",
      name: c.nome, dpi: grid.dpi, offset: { ...grid.offset },
      // (the angle number is in the picture order; the token keeps the car's name)
      label: `${i + 1}/${urls.length}`,
    }));
    const mime = c.mime ?? "image/png";
    for (const o of imageOptions) o.mime = mime;
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

// ---------------------------------------------------------------- cars from the PC / from Owlbear images
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const say = (t) => { $("count").textContent = t; };

// the car's angles, ticked in Owlbear's image picker (search = the car's name): saved in this room
async function pickFromOwlbear(search = "", expected = 0) {
  const got = await OBR.assets.downloadImages(true, search, "CHARACTER");
  if (!got?.length) { say("Nenhuma imagem escolhida."); return; }
  got.sort((a, b) => natural(a.name ?? "", b.name ?? ""));
  // the name: the search (the folder's name), or what the pictures' names have in common
  let nome = search;
  if (!nome) {
    const names = got.map((g) => g.name ?? "");
    nome = names.reduce((p, n) => { let i = 0; while (i < p.length && p[i] === n[i]) i++; return p.slice(0, i); }, names[0]).replace(/[\s_\-0-9]+$/, "").trim() || names[0] || "Carro";
  }
  const first = got[0].image;
  const car = {
    id: crypto.randomUUID(), nome, largura: first.width, altura: first.height, mime: first.mime,
    angulos: got.map((g) => g.image.url),
  };
  const list = (await OBR.room.getMetadata())[ROOM_CARS] ?? [];
  const next = [...list.filter((c) => c.nome !== nome), car];
  // the room's data has a size limit (16 KB for everything): keep room for the other extensions
  if (JSON.stringify(next).length > 12000) throw new Error("A lista de carros da sala está cheia: tire algum (✕) antes de adicionar outro.");
  await OBR.room.setMetadata({ [ROOM_CARS]: next });
  say(`${nome}: ${car.angulos.length} ângulo(s) salvo(s) nesta sala${expected && expected !== car.angulos.length ? ` (a pasta tinha ${expected}; confira se marcou todos)` : ""}.`);
}

// a folder made by "Pacote Owlbear" (Downloads/carros/<name>/): carro.json + one PNG per angle
async function fromPC(files) {
  const meta = await files.find((f) => f.name.toLowerCase() === "carro.json")?.text().then(JSON.parse).catch(() => null);
  let pics = files.filter((f) => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g)$/i.test(f.name));
  if (meta?.angulos?.length) {
    const order = meta.angulos.map((n) => n.toLowerCase());
    pics = pics.filter((f) => order.includes(f.name.toLowerCase())).sort((a, b) => order.indexOf(a.name.toLowerCase()) - order.indexOf(b.name.toLowerCase()));
  } else pics.sort((a, b) => natural(a.name, b.name));
  if (!pics.length) { say("Essa pasta não tem imagens de ângulos (PNG)."); return; }
  const folder = files[0].webkitRelativePath?.split("/")[0] || "";
  const nome = (meta?.nome || folder || "Carro").trim();
  say(`Enviando ${pics.length} ângulo(s) de ${nome} pro seu Owlbear…`);
  // numbered names keep the angle order in the picker: "Nome 01", "Nome 02"...
  const uploads = pics.map((f, i) => buildImageUpload(f).name(`${nome} ${String(i + 1).padStart(2, "0")}`).build());
  await OBR.assets.uploadImages(uploads, "CHARACTER");
  say(`Enviado. Agora, na janela do Owlbear, marque os ${pics.length} ângulos de "${nome}" e confirme.`);
  await pickFromOwlbear(nome, pics.length);
}

$("fromPC").onclick = () => {
  if (!state.ready) { say("Esta janela não está conectada ao Owlbear. Feche a extensão e abra de novo."); return; }
  $("folder").value = "";
  $("folder").click();
};
$("folder").onchange = async (ev) => {
  const files = [...(ev.target.files ?? [])];
  if (!files.length) return;
  try { await fromPC(files); } catch (err) { say(`Não deu certo: ${err.message}`); }
};
$("fromOwlbear").onclick = async () => {
  if (!state.ready) { say("Esta janela não está conectada ao Owlbear. Feche a extensão e abra de novo."); return; }
  try { await pickFromOwlbear("", 0); } catch (err) { say(`Não deu certo: ${err.message}`); }
};

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
  // the room's cars (and whenever someone adds or takes one off)
  await loadRoomCars();
  OBR.room.onMetadataChange(() => { loadRoomCars().catch(() => {}); });
  const theme = await OBR.theme.getTheme();
  document.body.classList.toggle("light", theme.mode === "LIGHT");
  OBR.theme.onChange((th) => document.body.classList.toggle("light", th.mode === "LIGHT"));
});
