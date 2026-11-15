// Runs while the room is open: on the GM's side, checks the sheets every 5 minutes and redraws the cards
// whose data changed (nothing is sent when nothing changed).
import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { ready } from "../imagem-link/gh.js?v=1.7.0";
import { getConfig, syncCards } from "./motor.js?v=0.1.0";

const EVERY = 5 * 60 * 1000;
let busy = false;
async function tick() {
  if (busy || !ready()) return;
  busy = true;
  try {
    if ((await OBR.player.getRole()) !== "GM" || !(await OBR.scene.isReady())) return;
    const cfg = await getConfig();
    if (!cfg.auto || !cfg.sheet || !cfg.players.length) return;
    const r = await syncCards();
    if (r.done.length) await OBR.notification.show(`Painel: cartão atualizado (${r.done.join(", ")})`);
  } catch (err) { console.warn("[painel]", err.message); }
  finally { busy = false; }
}
OBR.onReady(() => { setInterval(tick, EVERY); setTimeout(tick, 20000); });
