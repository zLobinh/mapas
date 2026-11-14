// Tiny stand-in for the Owlbear SDK, to try the pages outside Owlbear (tools/preview*.html).
// window.__items: scene items; window.__local: local items; window.__tool: the active tool mode
// (call __tool.onToolMove / onToolClick to fake the mouse on the map).
const items = [];
const local = [];
const channels = {};
window.__items = items;
window.__local = local;
const modes = {};
const OBR = {
  onReady: (cb) => setTimeout(cb, 0),
  theme: { getTheme: async () => ({ mode: "DARK" }), onChange: () => {} },
  scene: {
    isReady: async () => true,
    grid: {
      getDpi: async () => 150,
      // centers of 150 px squares (or corners)
      snapPosition: async (p, s, corners, center) => {
        const f = (v) => (center ? Math.floor(v / 150) * 150 + 75 : Math.round(v / 150) * 150);
        return { x: f(p.x), y: f(p.y) };
      },
    },
    items: {
      getItems: async (ids) => items.filter((i) => !ids || ids.includes(i.id)),
      addItems: async (list) => { items.push(...list); console.log("[addItems]", JSON.stringify(list)); },
      updateItems: async (ids, fn) => { fn(items.filter((i) => ids.includes(i.id))); },
    },
    local: {
      addItems: async (list) => { local.push(...list); },
      updateItems: async (ids, fn) => { fn(local.filter((i) => ids.includes(i.id))); },
      deleteItems: async (ids) => { for (const id of ids) { const i = local.findIndex((x) => x.id === id); if (i >= 0) local.splice(i, 1); } },
    },
  },
  viewport: { getWidth: async () => 1200, getHeight: async () => 800, inverseTransformPoint: async (p) => ({ x: p.x * 2, y: p.y * 2 }) },
  player: { select: async (ids) => { window.__sel = ids; }, getSelection: async () => window.__sel ?? [] },
  notification: { show: async (m) => console.log("[notification]", m) },
  popover: { open: async () => {} },
  contextMenu: { create: (m) => { (window.__menus ??= {})[m.id] = m; } },
  broadcast: {
    sendMessage: async (ch, data) => { setTimeout(() => (channels[ch] ?? []).forEach((f) => f({ data: structuredClone(data) })), 0); },
    onMessage: (ch, f) => { (channels[ch] ??= []).push(f); return () => {}; },
  },
  // the room's data and the account's image storage (uploadImages keeps the files; downloadImages gives
  // back the ones whose name has the search, like Owlbear's picker after the player ticks them)
  room: (() => {
    let meta = {};
    const subs = [];
    return {
      getMetadata: async () => structuredClone(meta),
      setMetadata: async (m) => { meta = { ...meta, ...m }; subs.forEach((f) => f(structuredClone(meta))); },
      onMetadataChange: (f) => { subs.push(f); return () => {}; },
    };
  })(),
  assets: {
    uploadImages: async (list) => { (window.__uploaded ??= []).push(...list); console.log("[uploadImages]", list.map((u) => u.name)); },
    downloadImages: async (multiple, search = "") => (window.__uploaded ?? [])
      .filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()))
      .map((u, i) => ({ name: u.name, image: { url: `https://images.owlbear.rodeo/fake/${encodeURIComponent(u.name)}.png`, width: 512, height: 300, mime: "image/png" }, grid: { dpi: 150, offset: { x: 256, y: 150 } } }))
      .reverse(), // (the picker's order is not the angles' order)
  },
  tool: {
    active: "rodeo.owlbear.tool/move",
    create: async () => {},
    createMode: async (m) => { modes[m.id] = m; window.__tool = m; },
    activateTool: async (id) => { OBR.tool.active = id; },
    getActiveTool: async () => OBR.tool.active,
    remove: async () => {},
    removeMode: async (id) => { delete modes[id]; window.__tool = null; },
  },
};
export function buildImage(image, grid) {
  const item = { id: crypto.randomUUID(), type: "IMAGE", image, grid, metadata: {}, scale: { x: 1, y: 1 } };
  const b = new Proxy({}, { get: (_, k) => (k === "build" ? () => item : (v) => { item[k] = v; return b; }) });
  return b;
}
export function buildImageUpload(file) {
  const up = { file, name: file.name };
  const b = new Proxy({}, { get: (_, k) => (k === "build" ? () => up : (v) => { up[k] = v; return b; }) });
  return b;
}
export default OBR;
