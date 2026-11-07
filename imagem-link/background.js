// Right click on any image -> "Trocar link da imagem": points it to another file (keeps its size).
// Works on uploaded images too: that's how an uploaded map can be swapped for a linked one.
import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const ID = "com.imagem-link";
const VERSION = "1.0.1";
// full address of a file of this extension (Owlbear needs it absolute)
const asset = (path) => new URL(path, import.meta.url).href;

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
});
