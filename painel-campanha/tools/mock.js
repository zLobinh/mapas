// Tiny stand-in for the Owlbear SDK, to try the panel outside Owlbear (tools/preview.html, tools/ver.html).
// window.__items: the scene items (starts with a map like the campaign's).
const items = [{
  id: "mapa", type: "IMAGE", name: "Mapa", layer: "MAP", zIndex: 1, position: { x: -4590, y: -3312 }, scale: { x: 4.0476190476, y: 4.0476190476 }, rotation: 0,
  image: { url: "about:blank", width: 2520, height: 1780, mime: "image/webp" }, grid: { dpi: 150, offset: { x: 0, y: 0 } }, metadata: {},
}];
window.__items = items;
let meta = {};
window.__meta = () => meta;

class Builder {
  constructor(image, grid) { this.i = { id: crypto.randomUUID(), type: "IMAGE", image, grid, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, zIndex: Date.now(), metadata: {}, layer: "CHARACTER" }; }
  position(p) { this.i.position = p; return this; }
  layer(l) { this.i.layer = l; return this; }
  zIndex(z) { this.i.zIndex = z; return this; }
  locked(v) { this.i.locked = v; return this; }
  disableHit(v) { this.i.disableHit = v; return this; }
  attachedTo(id) { this.i.attachedTo = id; return this; }
  name(n) { this.i.name = n; return this; }
  metadata(m) { this.i.metadata = m; return this; }
  build() { return this.i; }
}
export const buildImage = (image, grid) => new Builder(image, grid);

const OBR = {
  onReady: (cb) => setTimeout(cb, 0),
  theme: { getTheme: async () => ({ mode: "DARK" }), onChange: () => {} },
  player: { getRole: async () => "GM" },
  notification: { show: async (m) => console.log("[notification]", m) },
  room: (() => {
    const subs = [];
    return {
      getMetadata: async () => structuredClone(meta),
      setMetadata: async (m) => { meta = { ...meta, ...structuredClone(m) }; for (const f of subs) f(structuredClone(meta)); },
      onMetadataChange: (f) => { subs.push(f); return () => {}; },
    };
  })(),
  scene: {
    isReady: async () => true,
    grid: { getDpi: async () => 150 },
    items: {
      getItems: async () => structuredClone(items),
      addItems: async (list) => { items.push(...structuredClone(list)); },
      updateItems: async (ids, fn) => { fn(items.filter((i) => ids.includes(i.id))); },
      deleteItems: async (ids) => { for (const id of ids) { const k = items.findIndex((x) => x.id === id); if (k >= 0) items.splice(k, 1); } },
    },
  },
};
export default OBR;
