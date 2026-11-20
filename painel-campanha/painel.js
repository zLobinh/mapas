// The panel's page: the GM sets the sheet and the players (tab, look, portrait) and presses the buttons.
import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { wireKeyBox, needKey } from "../imagem-link/gh.js?v=1.7.0";
import { ESTILOS } from "./desenho.js?v=0.3.3";
import { getConfig, setConfig, syncCards, syncFrame, syncLabels, editLabels, clearScene, isHud, setHud, strayHere } from "./motor.js?v=0.3.3";

const $ = (id) => document.getElementById(id);
const say = (t, kind = "") => { $("status").textContent = t || ""; $("status").className = `status small ${kind || "muted"}`; };
let cfg = null, missing = [];

let saveT = 0, pending = false;
const save = () => { clearTimeout(saveT); return setConfig(cfg).catch((e) => say(`Não consegui salvar: ${e.message}`, "bad")).finally(() => { pending = false; }); };
const saveSoon = () => { pending = true; clearTimeout(saveT); saveT = setTimeout(save, 400); };

function field(label, value, on, opts = {}) {
  const l = document.createElement("label");
  if (opts.wide) l.className = "wide";
  l.append(label);
  let el;
  if (opts.options) {
    el = document.createElement("select");
    for (const [v, t] of opts.options) { const o = document.createElement("option"); o.value = v; o.textContent = t; el.append(o); }
  } else { el = document.createElement("input"); el.type = opts.type ?? "text"; if (opts.placeholder) el.placeholder = opts.placeholder; if (opts.step) el.step = opts.step; }
  el.value = value ?? "";
  el.oninput = () => { on(el.value); saveSoon(); };
  l.append(el);
  return l;
}

function drawPlayers() {
  const box = $("players");
  box.replaceChildren(...cfg.players.map((p, i) => {
    const d = document.createElement("div");
    d.className = "pl";
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "rm wide"; rm.textContent = "✕ tirar";
    rm.onclick = () => { cfg.players.splice(i, 1); save(); drawPlayers(); };
    d.append(
      field("Aba na planilha", p.tab, (v) => (p.tab = v.trim()), { placeholder: "Noah" }),
      field("Visual", p.estilo, (v) => (p.estilo = v), { options: Object.entries(ESTILOS).map(([k, s]) => [k, s.nome]) }),
      field("Retrato (link ou arquivo da extensão)", p.retrato, (v) => (p.retrato = v.trim()), { wide: true, placeholder: "https://... (imagem sem fundo)" }),
      field("Nome na PA Liga (se for diferente)", p.paliga ?? "", (v) => (p.paliga = v.trim()), { wide: true, placeholder: "igual ao da ficha" }),
      field("Zoom do retrato", p.zoom ?? 1, (v) => (p.zoom = Number(v) || 1), { type: "number", step: "0.05" }),
      field("Subir/descer o retrato", p.dy ?? 0, (v) => (p.dy = Number(v) || 0), { type: "number", step: "20" }),
      rm,
    );
    return d;
  }));
}
function drawAliases() {
  $("aliasBox").classList.toggle("hidden", !missing.length);
  $("alias").replaceChildren(...missing.map((n) => {
    const r = document.createElement("div");
    r.className = "row";
    const b = document.createElement("b");
    b.textContent = n;
    const inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = "espécie ou link da imagem"; inp.value = cfg.aliases[n] ?? "";
    inp.oninput = () => { const v = inp.value.trim(); if (v) cfg.aliases[n] = v; else delete cfg.aliases[n]; saveSoon(); };
    r.append(b, inp);
    return r;
  }));
}

async function run(button, fn) {
  if (!needKey((t) => say(t, "warn"))) return;
  if (pending) await save(); // (only the GM's own unsaved edits: never an old copy over a newer config)
  for (const b of document.querySelectorAll(".btns button")) b.disabled = true;
  try { await fn(); } catch (err) { say(`Não deu certo: ${err.message}`, "bad"); }
  finally { for (const b of document.querySelectorAll(".btns button")) b.disabled = false; drawScene(); }
}

$("addPlayer").onclick = () => { cfg.players.push({ tab: "", estilo: "futuro-verde", retrato: "", zoom: 1, dy: 0 }); drawPlayers(); };
$("cards").onclick = () => run($("cards"), async () => {
  const r = await syncCards({ say: (t) => say(t), force: false });
  missing = r.missing; drawAliases();
  say(r.done.length ? `✓ Cartões atualizados: ${r.done.join(", ")}.` : (r.teams ? "✓ Equipes atualizadas nos cartões." : "✓ Tudo igual às fichas: nada pra atualizar."), "ok");
  if (missing.length) say(`✓ Cartões prontos. Faltou o sprite de: ${missing.join(", ")} (preencha abaixo e atualize de novo).`, "warn");
  if (r.notes?.length) say(`${$("status").textContent} ${r.notes.join("; ")}.`, "warn");
});
$("frame").onclick = () => run($("frame"), async () => { await syncFrame({ say: (t) => say(t) }); say("✓ Moldura do mapa na cena.", "ok"); });
$("labels").onclick = () => run($("labels"), async () => { const r = await syncLabels({ say: (t) => say(t) }); say(`✓ ${r.labels} nomes e ${r.areas} áreas no visual da campanha.`, "ok"); });
$("editLabels").onclick = async () => {
  try { const n = await editLabels(); say(n ? `${n} textos e áreas originais de volta pra editar. Quando terminar, estilize de novo.` : "Não há nada estilizado pra voltar."); }
  catch (err) { say(`Não deu certo: ${err.message}`, "bad"); }
};
$("clear").onclick = async () => {
  const b = $("clear");
  if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Tirar mesmo? (clique de novo)"; setTimeout(() => { b.dataset.sure = ""; b.textContent = "Tirar o painel da cena"; }, 3000); return; }
  b.dataset.sure = ""; b.textContent = "Tirar o painel da cena";
  const n = await clearScene();
  say(`${n} item(ns) do painel tirado(s) da cena.`);
  drawScene();
};
// which scene this is: the panel only adds and updates things in the HUD scene
async function drawScene() {
  if (!(await OBR.scene.isReady())) { $("hudState").textContent = "Abra uma cena."; $("hudBtn").hidden = true; return; }
  const hud = await isHud(), stray = hud ? 0 : await strayHere();
  $("hudState").textContent = hud ? "✓ Esta cena é a HUD da campanha: o painel atualiza aqui."
    : stray ? `Esta cena não é a HUD, mas tem ${stray} item(ns) do painel que ficaram aqui. Use "Tirar o painel da cena" pra limpar.`
    : "Esta cena não é a HUD: o painel não mexe nela.";
  $("hudState").className = `small ${hud ? "ok" : stray ? "warn" : "muted"}`;
  $("hudBtn").hidden = false;
  $("hudBtn").textContent = hud ? "Deixar de usar esta cena como HUD" : "Usar esta cena como HUD";
  $("hudBtn").dataset.on = hud ? "1" : "";
  for (const id of ["cards", "frame", "labels"]) $(id).disabled = !hud;
}
$("hudBtn").onclick = async () => { await setHud(!$("hudBtn").dataset.on); await drawScene(); };
$("sheet").oninput = () => { cfg.sheet = $("sheet").value.trim(); saveSoon(); };
$("paliga").oninput = () => { cfg.paliga = $("paliga").value.trim(); saveSoon(); };
$("auto").onchange = () => { cfg.auto = $("auto").checked; save(); };

OBR.onReady(async () => {
  const theme = await OBR.theme.getTheme();
  document.body.classList.toggle("light", theme.mode === "LIGHT");
  OBR.theme.onChange((t) => document.body.classList.toggle("light", t.mode === "LIGHT"));
  if ((await OBR.player.getRole()) !== "GM") { $("gm").classList.add("hidden"); say("Só o mestre configura o painel."); return; }
  cfg = await getConfig();
  $("sheet").value = cfg.sheet;
  $("paliga").value = cfg.paliga ?? "";
  $("auto").checked = !!cfg.auto;
  drawPlayers();
  wireKeyBox((t) => say(t, /^✓/.test(t) ? "ok" : "warn"));
  drawScene();
  OBR.scene.onReadyChange(() => drawScene());
  OBR.scene.onMetadataChange(() => drawScene());
  // the config changed somewhere else (another window, a tool): this page takes it, instead of saving its
  // old copy over it later. (Not while the GM is typing here: their edit is about to be saved.)
  OBR.room.onMetadataChange(async () => {
    if (pending) return;
    const fresh = await getConfig();
    if (JSON.stringify(fresh) === JSON.stringify(cfg)) return;
    cfg = fresh;
    $("sheet").value = cfg.sheet;
    $("paliga").value = cfg.paliga ?? "";
    $("auto").checked = !!cfg.auto;
    drawPlayers();
  });
});
