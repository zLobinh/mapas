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

const ROOM_CARS = "com.imagem-link/carros"; // (older version: cars kept in the room, still listed)
const META = "com.imagem-link/meta";
const CHANGR = "com.missing-link-dev.changr/metadata";
const PLACE = "com.imagem-link/place"; // handled by background.js
const BASE = new URL("../carros/", import.meta.url); // <repository>/carros/
const SIZE_KEY = "imagem-link/car-size";
const TOKEN_KEY = "imagem-link/gh-token";
const $ = (id) => document.getElementById(id);

// the repository comes from the address: <owner>.github.io/<repository>/...
const OWNER = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "zlobinh";
const REPO = location.hostname.endsWith(".github.io") ? location.pathname.split("/")[1] : "mapas";

const state = { cars: [], size: "2", ready: false };
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
// (a message stays until the next one: the list refreshing doesn't wipe it)
const say = (t) => { state.note = t || null; $("count").textContent = t || countText(); };

// keep Owlbear's connection parameters (?obrref=...) when switching tabs
for (const a of document.querySelectorAll(".tabs a")) {
  const params = new URLSearchParams(location.search);
  params.delete("id");
  a.href = `${a.getAttribute("href").split("?")[0]}?${params}`;
}

// the car folders: carros/index.json when there is one, otherwise the GitHub listing of carros/
async function carFolders() {
  const idx = await fetch(new URL("index.json", BASE), { cache: "no-cache" }).catch(() => null);
  if (idx?.ok) return (await idx.json()).map((x) => (typeof x === "string" ? x : x.pasta));
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/carros`, { cache: "no-cache" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}${res.status === 403 ? " (limite de consultas; tente daqui a pouco)" : ""}`);
  return (await res.json()).filter((x) => x.type === "dir").map((x) => x.name);
}

// one car folder: from GitHub Pages, or (just sent, Pages not updated yet) straight from the repository
async function readCar(f) {
  const bases = [new URL(`${encodeURIComponent(f)}/`, BASE), new URL(`https://raw.githubusercontent.com/${OWNER}/${REPO}/main/carros/${encodeURIComponent(f)}/`)];
  for (const base of bases) {
    const r = await fetch(new URL("carro.json", base), { cache: "no-cache" }).catch(() => null);
    if (!r?.ok) continue;
    const c = await r.json();
    return { ...c, base: new URL(c.base ?? base), key: fold(`${c.nome} ${f}`) };
  }
  return null;
}

async function load() {
  $("count").textContent = "Carregando os carros…";
  $("grid").replaceChildren();
  let repo = [];
  try {
    const cars = await Promise.all((await carFolders()).map(readCar));
    repo = cars.filter((c) => c?.angulos?.length);
  } catch (err) {
    $("count").textContent = `Não consegui listar os carros do repositório: ${err.message}`;
  }
  // a car just sent keeps its commit address (the listing may not have it yet)
  for (const c of state.fresh ?? []) if (!repo.some((r) => r.pasta === c.pasta)) repo.push(c);
  state.repo = repo;
  await loadRoomCars();
}
// the cars kept in the room by an older version (full addresses, no base folder)
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
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };

async function gh(path, body = null, method = body ? "POST" : "GET") {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error("a chave do GitHub não funcionou (errada ou vencida): cole uma nova em ⚙ Chave do GitHub");
  if (res.status === 403 || res.status === 404) throw new Error(`a chave não tem permissão de escrever no repositório ${REPO} (precisa de "Contents: Read and write" nele)`);
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}
const base64 = (file) => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1]);
  r.onerror = () => no(r.error);
  r.readAsDataURL(file);
});
// folder name in the repository: "Carro da Tatu" -> "carro-da-tatu"
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "carro";

// a folder made by "Pacote Owlbear" (Downloads/carros/<name>/): carro.json + one PNG per angle
async function sendToGitHub(files) {
  const meta = await files.find((f) => f.name.toLowerCase() === "carro.json")?.text().then(JSON.parse).catch(() => null);
  let pics = files.filter((f) => /\.(png|webp)$/i.test(f.name));
  if (meta?.angulos?.length) {
    const order = meta.angulos.map((n) => n.toLowerCase());
    pics = pics.filter((f) => order.includes(f.name.toLowerCase())).sort((a, b) => order.indexOf(a.name.toLowerCase()) - order.indexOf(b.name.toLowerCase()));
  } else pics.sort((a, b) => natural(a.name, b.name));
  if (!pics.length) { say("Essa pasta não tem as imagens dos ângulos (PNG)."); return; }
  const folder = files[0].webkitRelativePath?.split("/")[0] || "";
  const nome = (meta?.nome || folder || "Carro").trim();
  const pasta = slug(meta?.pasta || folder || nome);
  // the size of the pictures (carro.json has it; otherwise read from the first one)
  let { largura, altura } = meta ?? {};
  if (!largura || !altura) { const bmp = await createImageBitmap(pics[0]); largura = bmp.width; altura = bmp.height; bmp.close?.(); }
  const car = { nome, pasta, largura, altura, angulos: pics.map((f) => f.name) };

  // one commit: blobs -> tree (on top of the current one) -> commit -> move the branch
  say(`Enviando ${nome} pro GitHub…`);
  const repoInfo = await gh("");
  const branch = repoInfo.default_branch || "main";
  const ref = await gh(`/git/ref/heads/${branch}`);
  const head = await gh(`/git/commits/${ref.object.sha}`);
  const tree = [];
  for (let i = 0; i < pics.length; i++) {
    say(`Enviando ${nome}: ângulo ${i + 1} de ${pics.length}…`);
    const blob = await gh("/git/blobs", { content: await base64(pics[i]), encoding: "base64" });
    tree.push({ path: `carros/${pasta}/${pics[i].name}`, mode: "100644", type: "blob", sha: blob.sha });
  }
  const json = await gh("/git/blobs", { content: JSON.stringify(car, null, 2), encoding: "utf-8" });
  tree.push({ path: `carros/${pasta}/carro.json`, mode: "100644", type: "blob", sha: json.sha });
  const newTree = await gh("/git/trees", { base_tree: head.tree.sha, tree });
  const commit = await gh("/git/commits", { message: `Carro: ${nome}`, tree: newTree.sha, parents: [ref.object.sha] });
  await gh(`/git/refs/heads/${branch}`, { sha: commit.sha }, "PATCH");

  // usable right away from that exact commit (raw.githubusercontent.com: right image type and CORS, which
  // Owlbear needs; jsDelivr refuses repositories this big), no waiting for GitHub Pages
  const fresh = { ...car, base: new URL(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${commit.sha}/carros/${pasta}/`), key: fold(`${nome} ${pasta}`) };
  state.fresh = [...(state.fresh ?? []).filter((c) => c.pasta !== pasta), fresh];
  state.repo = [...(state.repo ?? []).filter((c) => c.pasta !== pasta), fresh];
  await loadRoomCars();
  say(`✓ ${nome} enviado pro GitHub (${pics.length} ângulos). Já dá pra usar: clique nele e depois no mapa.`);
}

$("fromPC").onclick = () => {
  if (!token()) { $("ghBox").open = true; say("Primeiro cole a sua chave do GitHub em ⚙ Chave do GitHub (só uma vez)."); return; }
  $("folder").value = "";
  $("folder").click();
};
$("folder").onchange = async (ev) => {
  const files = [...(ev.target.files ?? [])];
  if (!files.length) return;
  $("fromPC").disabled = true;
  try { await sendToGitHub(files); } catch (err) { say(`Não deu certo: ${err.message}`); }
  finally { $("fromPC").disabled = false; }
};

// the key: only in this browser
function showKey() {
  const has = !!token();
  $("ghState").textContent = has ? `✓ chave salva neste navegador (repositório ${OWNER}/${REPO})` : "nenhuma chave salva";
  $("ghForget").hidden = !has;
}
$("ghSave").onclick = async () => {
  const t = $("ghToken").value.trim();
  if (!t) return;
  try { localStorage.setItem(TOKEN_KEY, t); } catch { say("Este navegador não deixou guardar a chave."); return; }
  $("ghToken").value = "";
  try { await gh(""); showKey(); say("✓ Chave do GitHub salva e funcionando."); $("ghBox").open = false; }
  catch (err) { try { localStorage.removeItem(TOKEN_KEY); } catch {} showKey(); say(`A chave não funcionou: ${err.message}`); }
};
$("ghForget").onclick = () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} showKey(); say("Chave apagada deste navegador."); };
showKey();

function setSize(v) {
  state.size = v;
  for (const b of $("size").querySelectorAll("button")) b.classList.toggle("on", b.dataset.v === v);
  try { localStorage.setItem(SIZE_KEY, v); } catch {}
}

$("q").addEventListener("input", render);
$("reload").onclick = () => { state.note = null; load(); };
$("size").addEventListener("click", (ev) => { if (ev.target.dataset.v) setSize(ev.target.dataset.v); });
try { setSize(localStorage.getItem(SIZE_KEY) || "2"); } catch { setSize("2"); }
load();

OBR.onReady(async () => {
  state.ready = true;
  await loadRoomCars();
  OBR.room.onMetadataChange(() => { loadRoomCars().catch(() => {}); });
  const theme = await OBR.theme.getTheme();
  document.body.classList.toggle("light", theme.mode === "LIGHT");
  OBR.theme.onChange((th) => document.body.classList.toggle("light", th.mode === "LIGHT"));
});
