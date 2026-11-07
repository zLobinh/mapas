// Tiny stand-in for the Owlbear SDK, to try the page outside Owlbear (tools/preview.html).
const items = [];
window.__items = items;
const OBR = {
  onReady: (cb) => setTimeout(cb, 0),
  theme: { getTheme: async () => ({ mode: "DARK" }), onChange: () => {} },
  scene: {
    isReady: async () => true,
    grid: { getDpi: async () => 150 },
    items: {
      getItems: async (ids) => items.filter((i) => !ids || ids.includes(i.id)),
      addItems: async (list) => { items.push(...list); console.log("[addItems]", JSON.stringify(list)); },
      updateItems: async (ids, fn) => { fn(items.filter((i) => ids.includes(i.id))); console.log("[updateItems]", JSON.stringify(items)); },
    },
  },
  viewport: { getWidth: async () => 1200, getHeight: async () => 800, inverseTransformPoint: async (p) => ({ x: p.x * 2, y: p.y * 2 }) },
  player: { select: async () => {} },
  notification: { show: async (m) => console.log("[notification]", m) },
  popover: { open: async () => {} },
  contextMenu: { create: () => {} },
};
export function buildImage(image, grid) {
  const item = { id: crypto.randomUUID(), type: "IMAGE", image, grid, metadata: {}, scale: { x: 1, y: 1 } };
  const b = new Proxy({}, { get: (_, k) => (k === "build" ? () => item : (v) => { item[k] = v; return b; }) });
  return b;
}
export default OBR;
