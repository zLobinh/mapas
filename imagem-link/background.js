// Background page of "Imagem por Link":
//   - right click on any image -> "Trocar link da imagem": points it to another file (keeps its size);
//   - placing a token by hand: the popover sends PLACE with the image; a temporary tool makes a
//     preview follow the mouse on the map, a click drops it on the grid square (Esc cancels).
//     (A real drag from the popover to the map isn't possible: the map gets no mouse events while
//     the button is held inside the popover.)
import OBR, { buildImage } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const ID = "com.imagem-link";
const VERSION = "1.2.1";
export const PLACE = `${ID}/place`;
const TOOL = `${ID}/place-tool`;
const MODE = `${ID}/place-mode`;
// full address of a file of this extension (Owlbear needs it absolute)
const asset = (path) => new URL(path, import.meta.url).href;

let placing = null; // { req, ghostId, previousTool, last }

// the token's center on the grid: odd sizes on a square's center, even sizes on a corner
async function snap(pos, cells) {
  const even = Math.round(cells) % 2 === 0;
  try { return await OBR.scene.grid.snapPosition(pos, 1, even, !even); } catch { return pos; }
}

async function moveGhost(pos) {
  if (!placing) return;
  const p = await snap(pos, placing.req.cells);
  if (placing.last && placing.last.x === p.x && placing.last.y === p.y) return;
  placing.last = p;
  await OBR.scene.local.updateItems([placing.ghostId], (items) => { for (const it of items) it.position = p; }).catch(() => {});
}

async function finish() {
  const p = placing;
  placing = null;
  if (!p) return;
  await OBR.scene.local.deleteItems([p.ghostId]).catch(() => {});
  await OBR.tool.activateTool(p.previousTool || "rodeo.owlbear.tool/move").catch(() => {});
  await OBR.tool.remove(TOOL).catch(() => {});
  await OBR.tool.removeMode(MODE).catch(() => {});
}

async function drop(pos) {
  if (!placing) return;
  const { req } = placing;
  const item = buildImage(req.image, req.grid)
    .position(await snap(pos, req.cells))
    .layer(req.layer || "CHARACTER")
    .name(req.name)
    .metadata(req.metadata || {})
    .build();
  await OBR.scene.items.addItems([item]);
  // Shift held: keep placing copies (a whole wild group); otherwise done
  if (!placing.shift) {
    await finish();
    await OBR.player.select([item.id]).catch(() => {});
  }
}

async function startPlacing(req) {
  await finish(); // a previous one still going
  const previousTool = await OBR.tool.getActiveTool().catch(() => null);
  const ghost = buildImage(req.image, req.grid)
    .position({ x: -1e6, y: -1e6 }) // off screen until the mouse moves on the map
    .layer("CHARACTER")
    .name(`${req.name} (posicionando)`)
    .disableHit(true)
    .build();
  await OBR.scene.local.addItems([ghost]);
  placing = { req, ghostId: ghost.id, previousTool, last: null, shift: false };
  await OBR.tool.create({
    id: TOOL,
    icons: [{ icon: asset("icon.svg"), label: "Colocar token" }],
    defaultMode: MODE,
  });
  await OBR.tool.createMode({
    id: MODE,
    icons: [{ icon: asset("icon.svg"), label: "Clique no mapa pra colocar (Shift: vários, Esc: cancela)", filter: { activeTools: [TOOL] } }],
    cursors: [{ cursor: "copy" }],
    onToolMove: (_ctx, ev) => { if (placing) { placing.shift = !!ev.shiftKey; moveGhost(ev.pointerPosition); } },
    onToolClick: (_ctx, ev) => { if (placing) { placing.shift = !!ev.shiftKey; drop(ev.pointerPosition); } return false; },
    onKeyDown: (_ctx, ev) => { if (ev.key === "Escape") finish(); },
    onDeactivate: () => { if (placing) finish(); },
  });
  await OBR.tool.activateTool(TOOL);
  await OBR.notification.show(`Clique no mapa pra colocar ${req.name}. Segure Shift pra colocar vários; Esc cancela.`);
}

OBR.onReady(() => {
  OBR.contextMenu.create({
    id: `${ID}/swap`,
    icons: [{
      icon: asset("icon.svg"),
      label: "Trocar link da imagem",
      filter: { max: 1, roles: ["GM"], every: [{ key: "type", value: "IMAGE" }] },
    }],
    onClick: (context, elementId) => OBR.popover.open({
      id: `${ID}/swap`,
      url: `${asset("index.html")}?v=${VERSION}&id=${encodeURIComponent(context.items[0].id)}`,
      width: 380,
      height: 560,
      anchorElementId: elementId,
    }),
  });

  OBR.broadcast.onMessage(PLACE, ({ data }) => {
    startPlacing(data).catch(async (e) => {
      await finish();
      OBR.notification.show(`Não deu pra posicionar: ${e.message}`, "ERROR");
    });
  });
});
