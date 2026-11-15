// The drawings of the campaign panel, as SVG text: the trainer cards and the frame around the map.
// Two looks that meet at a lightning rift: the past (ink on paper) and the future (neon on carbon).
// Everything is in "design units" = scene pixels of the reference layout (map 10200 x 7205 at MAP.x/MAP.y).
const R = Math.round;
export const MAP = { x: -4590, y: -3312, w: 10200, h: 7205 };
export const CARD = { w: 1900, h: 3480, pad: 90, gap: 120, x0: -8850, y0: MAP.y + 60 };
export const FRAME = { x: -9150, y: -4750, w: 15150, h: 9250 };

export const ESTILOS = {
  "futuro-verde": { nome: "Futuro (verde)", era: "fut", bg: "#0d1411", panel: "#131d18", neon: "#63f59b", neon2: "#b6ffd0", grey: "#2a3a32" },
  "futuro-fenda": { nome: "Futuro (fenda dimensional)", era: "fut", rift: true, bg: "#0c1114", panel: "#111c1c", neon: "#63f59b", neon2: "#c9ffe0", grey: "#2a3a36" },
  "futuro-ciano": { nome: "Futuro (ciano)", era: "fut", bg: "#0b1216", panel: "#101b22", neon: "#4fd6ff", neon2: "#c2f1ff", grey: "#263842" },
  "passado": { nome: "Passado (papel claro)", era: "past", ink: "#1b2a41", paper: "#e9e2cf", paper2: "#d8cfb6", seal: "#b5362d", light: "#efe8d6", sub: "#1b2a41", line: "#1b2a41", stain: "#8d7d5c" },
  "passado-escuro": { nome: "Passado escuro (com brilho)", era: "past", dark: true, glow: true, ink: "#07080f", paper: "#252a3b", paper2: "#3a4159", seal: "#c79a3c", light: "#f1e7cc", sub: "#b9b3a0", line: "#8a8676", stain: "#0c0e16" },
  "passado-frio": { nome: "Passado frio (relógio)", era: "past", clock: true, ink: "#262b3a", paper: "#dcd8cf", paper2: "#c9c4b9", seal: "#5d5a78", light: "#ebe7dd", sub: "#2c3040", line: "#2c3040", stain: "#7f7f8c" },
};
const PAST = ESTILOS.passado, FUT = ESTILOS["futuro-verde"];

// ---- helpers
function rng(seedText) {
  let s = 7; for (const ch of String(seedText)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  s = s || 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hexPts = (cx, cy, r) => [0, 1, 2, 3, 4, 5].map((i) => `${R(cx + r * Math.cos(Math.PI / 3 * i + Math.PI / 6))},${R(cy + r * Math.sin(Math.PI / 3 * i + Math.PI / 6))}`).join(" ");
// a jagged closed line around a rectangle (the lightning rift)
function rift(rnd, x, y, w, h, step, amp) {
  const pts = [];
  const edge = (ax, ay, bx, by) => {
    const n = R(Math.hypot(bx - ax, by - ay) / step);
    for (let i = 0; i < n; i++) {
      const t = i / n, j = (rnd() - .5) * 2 * amp * (i % 5 === 0 ? 2.2 : 1), nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny);
      pts.push([ax + (bx - ax) * t + nx / L * j, ay + (by - ay) * t + ny / L * j]);
    }
  };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
  return "M" + pts.map((p) => p.map(R).join(",")).join("L") + "Z";
}
function bolt(rnd, x, y, ang, len, seg) {
  let d = `M${R(x)},${R(y)}`;
  for (let i = 0; i < seg; i++) { ang += (rnd() - .5) * 1.1; x += Math.cos(ang) * len / seg; y += Math.sin(ang) * len / seg; d += `L${R(x)},${R(y)}`; }
  return d;
}
// a dry brush stroke: a fat blob with ragged ends (the "ink" filter roughens it)
function brush(rnd, x, y, w, h, tilt = -0.04) {
  let top = "", bot = "";
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = x + w * t, sk = (t - .5) * w * tilt;
    const e = Math.sin(Math.PI / 2 * Math.min(1, t * 6)) * Math.sin(Math.PI / 2 * Math.min(1, (1 - t) * 3.2));
    top += `${i ? "L" : "M"}${R(px)},${R(y + sk - h / 2 * e * (.8 + rnd() * .4))}`;
    bot = `L${R(px)},${R(y + sk + h / 2 * e * (.8 + rnd() * .4))}` + bot;
  }
  return top + bot + "Z";
}
const star = (x, y, r) => `M${x},${y - r} L${x + r * .22},${y - r * .22} L${x + r},${y} L${x + r * .22},${y + r * .22} L${x},${y + r} L${x - r * .22},${y + r * .22} L${x - r},${y} L${x - r * .22},${y - r * .22}Z`;

// a dimensional tear: bright core, rings bending out of shape, and shards of crystal left behind
function wormhole(rnd, cx, cy) {
  const cols = ["#ffffff", "#9ff3ff", "#57b4ff", "#8f6bff", "#d264ff", "#ff6bd0"];
  let rings = "";
  for (let i = 0; i < 9; i++) {
    const r = 150 + i * 92, n = 28;
    let d = "";
    for (let j = 0; j <= n; j++) { const a = (j / n) * Math.PI * 2, w = 1 + Math.sin(a * 3 + i * .9) * .07 + (rnd() - .5) * .05; d += `${j ? "L" : "M"}${R(cx + Math.cos(a) * r * w * 1.02)},${R(cy + Math.sin(a) * r * w * .86)}`; }
    rings += `<path d="${d}Z" fill="none" stroke="${cols[Math.min(cols.length - 1, 1 + (i >> 1))]}" stroke-width="${R(26 - i * 2)}" opacity="${(.85 - i * .08).toFixed(2)}" transform="rotate(${-18 + i * 4} ${cx} ${cy})"/>`;
  }
  let shards = "";
  for (let i = 0; i < 11; i++) {
    const a = rnd() * Math.PI * 2, dist = 520 + rnd() * 420, x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist * .9, s = 46 + rnd() * 80, rot = R(rnd() * 360);
    shards += `<g transform="translate(${R(x)},${R(y)}) rotate(${rot})"><polygon points="0,${-R(s)} ${R(s * .42)},0 0,${R(s * .7)} ${-R(s * .42)},0" fill="#bff6ff" opacity=".9"/><polygon points="0,${-R(s)} ${R(s * .42)},0 0,${R(s * .7)}" fill="#8f6bff" opacity=".75"/><polygon points="0,${-R(s)} ${-R(s * .42)},0 0,${-R(s * .1)}" fill="#fff" opacity=".8"/></g>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="760" fill="#6a4bff" opacity=".28" filter="url(#soft)"/><circle cx="${cx}" cy="${cy}" r="330" fill="#9ff3ff" opacity=".5" filter="url(#soft)"/>
    <g filter="url(#ink2)">${rings}</g><g opacity=".55" filter="url(#glow)">${rings}</g>
    <ellipse cx="${cx}" cy="${cy}" rx="150" ry="128" fill="#fff" opacity=".92" filter="url(#glow)"/>${shards}`;
}

// the filters and patterns every drawing uses
function defsBase(neon = FUT.neon, stain = PAST.stain) {
  return `
  <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0016 .0022" numOctaves="4" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.5 .34" result="a"/><feFlood flood-color="${stain}"/><feComposite in2="a" operator="in" result="st"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="st"/></feMerge><feComposite in2="SourceGraphic" operator="in"/></filter>
  <filter id="ink" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".004 .02" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="90"/></filter>
  <filter id="ink2" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".01 .04" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="22"/></filter>
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="26"/></filter>
  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="140"/></filter>
  <pattern id="hex" width="210" height="364" patternUnits="userSpaceOnUse"><path d="M105,0 L210,61 V182 L105,243 L0,182 V61Z M105,243 V364" fill="none" stroke="${neon}" stroke-opacity=".28" stroke-width="5"/></pattern>`;
}
const wrap = (x, y, w, h, fontCss, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><style>${fontCss}</style>${body}</svg>`;

// ---- gym badges: the game's pictures when the panel has them (links), these stand-ins otherwise
export const INSIGNIAS = [["Inseto", "#9bbf2c", "M-22,-10 L0,-30 L22,-10 L14,26 L-14,26Z"], ["Planta", "#4fb357", "M0,-32 C30,-14 30,18 0,32 C-30,18 -30,-14 0,-32Z"], ["Elétrico", "#f4c531", "M6,-34 L-22,6 L-2,6 L-8,34 L22,-8 L2,-8Z"], ["Água", "#3f8fe0", "M0,-34 C26,0 24,30 0,32 C-24,30 -26,0 0,-34Z"], ["Normal", "#a9a48f", "M0,-28 A28,28 0 1,0 0.1,-28Z"], ["Fantasma", "#6a5aa8", "M-24,28 V-6 A24,24 0 0,1 24,-6 V28 L12,16 L0,28 L-12,16Z"], ["Psíquico", "#ee5f8b", "M-32,0 C-14,-26 14,-26 32,0 C14,26 -14,26 -32,0Z"], ["Gelo", "#63c9d9", "M0,-34 L10,-10 L34,0 L10,10 L0,34 L-10,10 L-34,0 L-10,-10Z"]];
function badge(i, cx, cy, r, on, dark, grey, pic) {
  if (pic) return `<image href="${pic}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" opacity="${on ? 1 : .22}" ${on ? "" : 'style="filter:grayscale(1)"'}/>`;
  return `<g transform="translate(${R(cx)},${R(cy)})" opacity="${on ? 1 : .32}"><polygon points="${hexPts(0, 0, r)}" fill="${on ? "#f3d27a" : (dark ? "#1c2a23" : "#cfc5a8")}" stroke="${on ? "#8a6a1c" : (dark ? grey : "#9a8f72")}" stroke-width="${r * .09}"/><polygon points="${hexPts(0, 0, r * .78)}" fill="${on ? INSIGNIAS[i][1] : "none"}" stroke="${on ? "#ffffff88" : "none"}" stroke-width="${r * .05}"/>${on ? `<path d="${INSIGNIAS[i][2]}" transform="scale(${r / 62})" fill="#fff" opacity=".92"/>` : ""}</g>`;
}

// where the team sprites go on a card (centers and size, in the card's own units from its top-left)
export function teamSlots() {
  const slot = (CARD.w - 260) / 6, ty = 110 + 1890 + 720;
  return [0, 1, 2, 3, 4, 5].map((j) => ({ x: 130 + slot * (j + .5), y: ty - slot * .04, size: slot * .92 }));
}

// ---- a trainer card. d: { name, sub, money, badges[8] }, portrait: { href, w, h } (transparent picture)
export function cardSVG(d, estilo, portrait, fontCss, opts = {}) {
  const S = ESTILOS[estilo] ?? FUT, past = S.era === "past";
  const rnd = rng(d.name + estilo);
  const { w: CW, h: CH, pad } = CARD;
  const x = 0, y = 0, pw = CW - 200, ph = 1890, px = 100, py = 110;
  const zoom = opts.zoom || 1;
  let pic = "";
  if (portrait?.href) {
    // fills the window from the top (head and chest), centered
    const sc = Math.max(pw / portrait.w, ph / portrait.h) * zoom, iw = portrait.w * sc, ih = portrait.h * sc;
    pic = `<image href="${portrait.href}" x="${R(px + pw / 2 - iw / 2 + (opts.dx || 0))}" y="${R(py + 40 + (opts.dy || 0))}" width="${R(iw)}" height="${R(ih)}" preserveAspectRatio="none"/>`;
  }
  const letter = esc((d.name || "?")[0]);
  let out = "", defs = "";
  if (past) {
    const cx = px + pw / 2;
    defs += `<clipPath id="win"><rect x="${x + 62}" y="${y + 62}" width="${CW - 124}" height="${py + ph - 62 + 150}"/></clipPath>`;
    // the backdrop: a sun (or moon, or clock) and a mountain, then the ink swash the trainer stands on
    let sky = "";
    if (S.clock) {
      const r = 430, ox = px + pw - 380, oy = py + 470;
      let ticks = ""; for (let i = 0; i < 12; i++) { const a = Math.PI / 6 * i; ticks += `<path d="M${R(ox + Math.cos(a) * r * .82)},${R(oy + Math.sin(a) * r * .82)} L${R(ox + Math.cos(a) * r * .95)},${R(oy + Math.sin(a) * r * .95)}"/>`; }
      sky = `<g fill="none" stroke="${S.ink}" stroke-width="14" opacity=".3" filter="url(#ink2)"><circle cx="${ox}" cy="${oy}" r="${r}"/>${ticks}<path d="M${ox},${oy} L${ox - 40},${oy - r * .62} M${ox},${oy} L${ox - r * .45},${oy + 60}" stroke-width="20" stroke-linecap="round"/></g>`;
    } else {
      sky = S.dark
        ? `<circle cx="${px + pw - 400}" cy="${py + 450}" r="520" fill="#ffcf7a" opacity=".16" filter="url(#soft)"/><circle cx="${px + pw - 400}" cy="${py + 450}" r="300" fill="#e9dfc2" opacity=".5" filter="url(#ink2)"/>`
        : `<circle cx="${px + pw - 400}" cy="${py + 450}" r="330" fill="${S.seal}" opacity=".88" filter="url(#ink2)"/>`;
    }
    const mount = `<g fill="${S.ink}" opacity="${S.dark ? .5 : .2}" filter="url(#ink)"><path d="M${px - 60},${py + ph * .7} L${px + 380},${py + ph * .36} L${px + 620},${py + ph * .52} L${px + 900},${py + ph * .3} L${px + pw + 60},${py + ph * .72}Z"/></g>`;
    const swash = `<g fill="${S.ink}" filter="url(#ink)" opacity="${S.dark ? .95 : .9}"><path d="${brush(rnd, px - 40, py + ph * .62, pw + 80, ph * .34, .06)}"/><path d="${brush(rnd, px - 70, py + ph * .86, pw + 140, ph * .36, -.05)}"/></g>`;
    out += `
      <rect x="${x}" y="${y}" width="${CW}" height="${CH}" fill="${S.paper}" filter="url(#paper)"/>
      <g clip-path="url(#win)">${sky}${mount}${swash}${pic}</g>
      <rect x="${x + 28}" y="${y + 28}" width="${CW - 56}" height="${CH - 56}" fill="none" stroke="${S.line}" stroke-width="12"/>
      <rect x="${x + 58}" y="${y + 58}" width="${CW - 116}" height="${CH - 116}" fill="none" stroke="${S.line}" stroke-width="4"/>
      <path d="${brush(rnd, x + 40, py + ph + 150, CW - 110, 340, -.03)}" fill="${S.ink}" filter="url(#ink)"/>
      <text x="${x + 170}" y="${py + ph + 205}" font-family="Cormorant Garamond" font-style="italic" font-weight="700" font-size="${R(200 * Math.min(1, 15 / Math.max(1, d.name.length)))}" fill="${S.light}">${esc(d.name)}</text>
      <circle cx="${x + 230}" cy="${y + 240}" r="112" fill="${S.seal}" filter="url(#ink2)" opacity=".95"/>
      <text x="${x + 230}" y="${y + 290}" text-anchor="middle" font-family="Cormorant Garamond" font-style="italic" font-weight="700" font-size="150" fill="${S.light}">${letter}</text>
      <text x="${x + 130}" y="${py + ph + 470}" font-family="Cormorant Garamond" font-weight="600" font-size="112" fill="${S.sub}" letter-spacing="6">${esc(d.sub)}</text>
      <text x="${x + CW - 130}" y="${py + ph + 470}" text-anchor="end" font-family="Cormorant Garamond" font-weight="600" font-size="120" fill="${S.dark ? S.seal : PAST.seal}">₽ ${esc(d.money)}</text>
      <path d="M${x + 130},${py + ph + 530} H${x + CW - 130}" stroke="${S.line}" stroke-width="6" stroke-dasharray="4 22" stroke-linecap="round"/>`;
    if (S.glow) {
      // a faint warm light: not given up yet
      let sp = ""; for (let j = 0; j < 10; j++) sp += `<path d="${star(R(x + 160 + rnd() * (CW - 320)), R(y + 260 + rnd() * (CH - 800)), R(16 + rnd() * 34))}" fill="#ffe3a0" opacity="${(.3 + rnd() * .5).toFixed(2)}"/>`;
      out += `<circle cx="${x + 420}" cy="${py + ph - 200}" r="520" fill="#ffcf7a" opacity=".18" filter="url(#soft)"/>${sp}`;
    }
    if (S.clock) {
      // barely there: a hairline from the corner and a few flecks drifting off
      const c = bolt(rnd, x + CW - 30, y + 30, 2.25, 760, 7);
      let bits = ""; for (let j = 0; j < 5; j++) { const bx = x + CW - 520 + rnd() * 380, by = y + 300 + rnd() * 520, s2 = 14 + rnd() * 26; bits += `<polygon points="${R(bx)},${R(by)} ${R(bx + s2)},${R(by + s2 * .3)} ${R(bx + s2 * .4)},${R(by + s2)}" fill="${S.ink}" opacity="${(.25 + rnd() * .3).toFixed(2)}"/>`; }
      out += `<path d="${c}" fill="none" stroke="${S.ink}" stroke-width="6" opacity=".55" stroke-linejoin="round"/>${bits}`;
    }
  } else {
    const cut = 170, fr = `M${px + cut},${py} H${px + pw} V${py + ph - cut} L${px + pw - cut},${py + ph} H${px} V${py + cut}Z`;
    const body = `M${x + 150},${y} H${x + CW} V${y + CH - 150} L${x + CW - 150},${y + CH} H${x} V${y + 150}Z`;
    defs += `<clipPath id="win"><path d="${fr}"/></clipPath><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.bg}" stop-opacity="0"/><stop offset="1" stop-color="${S.bg}"/></linearGradient><linearGradient id="skyf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.panel}"/><stop offset="1" stop-color="${S.bg}"/></linearGradient>`;
    const cx = px + pw / 2, cy = py + ph * .46;
    let lines = ""; for (let i = 0; i < 26; i++) lines += `<path d="M${px},${R(py + 40 + i * 72)} H${px + pw}" stroke="${S.neon}" stroke-width="3" opacity=".09"/>`;
    out += `
      <path d="${body}" fill="${S.panel}"/><path d="${body}" fill="url(#hex)" opacity=".5"/>
      <path d="${body}" fill="none" stroke="${S.neon}" stroke-width="40" opacity=".35" filter="url(#glow)"/><path d="${body}" fill="none" stroke="${S.neon}" stroke-width="10"/>
      <g clip-path="url(#win)"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#skyf)"/><rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#hex)" opacity=".7"/>${lines}
        <circle cx="${cx}" cy="${cy}" r="560" fill="${S.neon}" opacity=".16" filter="url(#soft)"/>
        ${S.rift ? wormhole(rnd, cx, cy - 40) : `<polygon points="${hexPts(cx, cy, 720)}" fill="none" stroke="${S.neon}" stroke-width="26" opacity=".85"/><polygon points="${hexPts(cx, cy, 820)}" fill="none" stroke="${S.neon2}" stroke-width="6" opacity=".6"/>`}
        <path d="M${px + 60},${py + ph - 520} l150,-150 M${px + 60},${py + ph - 400} l270,-270 M${px + pw - 60},${py + 520} l-150,150 M${px + pw - 60},${py + 400} l-270,270" stroke="${S.neon}" stroke-width="16" opacity=".5"/>
        ${pic}<rect x="${px}" y="${py + ph - 380}" width="${pw}" height="380" fill="url(#fade)"/></g>
      <path d="${fr}" fill="none" stroke="${S.neon2}" stroke-width="9"/>
      <path d="M${px},${py + cut + 40} V${R(py + ph * .45)}" stroke="${S.neon}" stroke-width="26"/>
      <polygon points="${hexPts(x + CW - 240, py + 200, 130)}" fill="${S.bg}" stroke="${S.neon}" stroke-width="10"/>
      <text x="${x + CW - 240}" y="${py + 250}" text-anchor="middle" font-family="Chakra Petch" font-weight="700" font-size="140" fill="${S.neon2}">${letter}</text>
      <path d="M${x + 60},${py + ph + 20} H${x + CW - 240} l110,110 l-110,110 H${x + 60}Z" fill="${S.neon}"/>
      <text x="${x + 130}" y="${py + ph + 190}" font-family="Chakra Petch" font-weight="700" font-size="${R(160 * Math.min(1, 12.5 / Math.max(1, d.name.length)))}" fill="${S.bg}" letter-spacing="4">${esc(d.name.toUpperCase())}</text>
      <text x="${x + 130}" y="${py + ph + 470}" font-family="Chakra Petch" font-weight="500" font-size="96" fill="${S.neon2}" letter-spacing="10">${esc(d.sub.toUpperCase())}</text>
      <text x="${x + CW - 130}" y="${py + ph + 470}" text-anchor="end" font-family="Chakra Petch" font-weight="700" font-size="106" fill="#fff">₽ ${esc(d.money)}</text>
      <path d="M${x + 130},${py + ph + 530} H${x + CW - 130}" stroke="${S.neon}" stroke-width="5" opacity=".6"/>`;
  }
  // the team's sockets (the sprites themselves are separate, animated tokens on top) and the 8 badges
  for (const s of teamSlots()) {
    const r = s.size / .92;
    out += past
      ? `<circle cx="${R(s.x)}" cy="${R(s.y + r * .04)}" r="${R(r * .44)}" fill="${S.paper2}" fill-opacity=".55" stroke="${S.line}" stroke-width="6" stroke-dasharray="14 16"/>`
      : `<polygon points="${hexPts(s.x, s.y + r * .04, r * .5)}" fill="${S.bg}" stroke="${S.grey}" stroke-width="8"/>`;
  }
  const by = teamSlots()[0].y + 430, bs = (CW - 260) / 8;
  for (let j = 0; j < 8; j++) out += badge(j, x + 130 + bs * (j + .5), by, bs * .46, !!d.badges?.[j], !past || S.dark, S.grey ?? "#2a3a32", opts.badgePics?.[j]);
  return { svg: wrap(-pad, -pad, CW + pad * 2, CH + pad * 2, fontCss, `<defs>${defsBase(S.neon ?? FUT.neon, S.stain ?? PAST.stain)}${defs}</defs>${out}`), w: CW + pad * 2, h: CH + pad * 2 };
}

// ---- small map pictures used by the legend
const pc = (x, y, sc = 1) => `<g transform="translate(${x},${y}) scale(${sc})"><ellipse cx="0" cy="118" rx="150" ry="34" fill="#000" opacity=".35"/><path d="M-120,110 V-20 H120 V110Z" fill="#f4efe6" stroke="#3a2a2a" stroke-width="10"/><path d="M-150,-20 L-95,-110 H95 L150,-20Z" fill="#d8402f" stroke="#3a2a2a" stroke-width="10"/><rect x="-36" y="30" width="72" height="80" fill="#5cc3e6" stroke="#3a2a2a" stroke-width="8"/><circle cx="0" cy="-64" r="34" fill="#fff" stroke="#3a2a2a" stroke-width="8"/><path d="M-34,-64 H34" stroke="#3a2a2a" stroke-width="8"/><circle cx="0" cy="-64" r="10" fill="#fff" stroke="#3a2a2a" stroke-width="7"/></g>`;
const gym = (x, y, i, sc = 1) => `<g transform="translate(${x},${y}) scale(${sc})"><ellipse cx="0" cy="128" rx="170" ry="36" fill="#000" opacity=".35"/><path d="M-135,120 V-30 L0,-130 L135,-30 V120Z" fill="#2b3147" stroke="#11131c" stroke-width="10"/><path d="M-160,-22 L0,-150 L160,-22" fill="none" stroke="${INSIGNIAS[i][1]}" stroke-width="26" stroke-linejoin="round"/><rect x="-40" y="40" width="80" height="80" fill="#11131c"/>${badge(i, 0, -30, 58, true, false, "#2a3a32")}</g>`;

// ---- the frame: the two eras around a transparent hole where the map shows through the rift,
// with the title above and the legend below. t: { title: [a, b, c] }
export function frameSVG(t, fontCss) {
  const rnd = rng("moldura");
  const { x: X0, y: Y0, w: W, h: H } = FRAME;
  const hole = rift(rnd, MAP.x, MAP.y, MAP.w, MAP.h, 230, 70);
  let bolts = ""; for (let i = 0; i < 18; i++) { const side = i % 4; const bx = side % 2 === 0 ? MAP.x + rnd() * MAP.w : (side === 1 ? MAP.x + MAP.w : MAP.x); const by = side === 0 ? MAP.y : side === 2 ? MAP.y + MAP.h : MAP.y + rnd() * MAP.h; bolts += `<path d="${bolt(rnd, bx, by, [-1.57, 0, 1.57, 3.14][side], 260 + rnd() * 420, 6)}"/>`; }
  let hexbg = ""; for (let i = 0; i < 70; i++) hexbg += `<polygon points="${hexPts(600 + rnd() * 5500, Y0 + rnd() * H, 60 + rnd() * 150)}" fill="${rnd() > .8 ? FUT.neon : "none"}" fill-opacity=".12" stroke="${FUT.neon}" stroke-opacity="${(.08 + rnd() * .25).toFixed(2)}" stroke-width="6"/>`;
  let splats = ""; for (let i = 0; i < 26; i++) splats += `<circle cx="${R(X0 + 300 + rnd() * 9500)}" cy="${R(Y0 + rnd() * H)}" r="${R(10 + rnd() * rnd() * 110)}" fill="${PAST.ink}" opacity="${(.08 + rnd() * .3).toFixed(2)}" filter="url(#ink)"/>`;
  const split = `M${X0},${Y0} H3300 L-900,${Y0 + H} H${X0}Z`;
  const [ta, tb, tc] = t?.title ?? ["POKÉMON", "Além do", "HORIZONTE"];
  const body = `<defs>${defsBase()}
    <mask id="hole" maskUnits="userSpaceOnUse" x="${X0}" y="${Y0}" width="${W}" height="${H}"><rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="#fff"/><path d="${hole}" fill="#000"/></mask>
    <clipPath id="pastclip"><path d="${split}"/></clipPath></defs>
  <g mask="url(#hole)">
    <rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="${FUT.bg}"/><rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="url(#hex)" opacity=".55"/>${hexbg}
    <ellipse cx="4600" cy="3000" rx="2600" ry="1900" fill="${FUT.neon}" opacity=".10" filter="url(#soft)"/>
    <g clip-path="url(#pastclip)"><rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="${PAST.paper}" filter="url(#paper)"/>
      <g fill="${PAST.ink}" filter="url(#ink)" opacity=".16"><path d="M-4700,${Y0 + 900} L-3300,${Y0 + 120} L-2500,${Y0 + 620} L-1700,${Y0 + 200} L-400,${Y0 + 900}Z"/><path d="${brush(rnd, X0 + 200, Y0 + H - 420, 5200, 520, .02)}"/><path d="${brush(rnd, -3000, Y0 + H - 230, 4200, 300, -.03)}"/></g>${splats}</g>
    <path d="M3300,${Y0} L-900,${Y0 + H}" stroke="#57b4ff" stroke-width="60" opacity=".5" filter="url(#glow)"/>
    <path d="${hole}" fill="none" stroke="#2f7bff" stroke-width="520" opacity=".4" filter="url(#soft)"/>
  </g>
  <g fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="${hole}" stroke="#2f7bff" stroke-width="150" opacity=".5" filter="url(#glow)"/><path d="${hole}" stroke="#57b4ff" stroke-width="56"/><path d="${hole}" stroke="#fff" stroke-width="18"/><g stroke="#9bd6ff" stroke-width="16">${bolts}</g><g stroke="#fff" stroke-width="5">${bolts}</g></g>
  <g transform="translate(510,-4060)">
    <path d="${brush(rnd, -2700, 0, 5400, 760, -.02)}" fill="${PAST.ink}" filter="url(#ink)"/>
    <path d="M1040,-330 L2920,-330 L2780,330 L780,330Z" fill="${FUT.bg}" stroke="${FUT.neon}" stroke-width="10"/><path d="M1040,-330 L2920,-330 L2780,330 L780,330Z" fill="url(#hex)" opacity=".6"/>
    <text x="-1150" y="150" text-anchor="middle" font-family="Bangers" font-size="560" fill="#ffcb05" stroke="#1d3f8f" stroke-width="46" paint-order="stroke" letter-spacing="30">${esc(ta)}</text>
    <text x="-70" y="110" font-family="Cormorant Garamond" font-style="italic" font-weight="700" font-size="270" fill="${PAST.paper}">${esc(tb)}</text>
    <text x="1840" y="110" text-anchor="middle" font-family="Chakra Petch" font-weight="700" font-size="${R(300 * Math.min(1, 9 / Math.max(1, tc.length)))}" fill="${FUT.neon2}" letter-spacing="26">${esc(tc)}</text>
  </g>
  <g transform="translate(${MAP.x},${MAP.y + MAP.h + 190})">
    <path d="M0,0 H${MAP.w * .36} L${MAP.w * .36 - 190},330 H0Z" fill="${PAST.paper}" stroke="${PAST.ink}" stroke-width="10"/>
    <path d="M${MAP.w * .36 + 40},0 H${MAP.w} V330 H${MAP.w * .36 - 150}Z" fill="${FUT.bg}" stroke="${FUT.neon}" stroke-width="10"/>
    <text x="130" y="225" font-family="Cormorant Garamond" font-style="italic" font-weight="700" font-size="190" fill="${PAST.ink}">${esc(t?.region ?? "Região de Paldea")}</text>
    <text x="1950" y="215" font-family="Cormorant Garamond" font-weight="600" font-size="110" fill="${PAST.seal}">${esc(t?.scale ?? "1 quadrado = 5 min")}</text>
    <g transform="translate(${MAP.w * .36 + 150},0)" font-family="Chakra Petch" font-weight="500" font-size="88" fill="#eafff1">
      ${gym(110, 150, 2, .62)}<text x="240" y="200">Cidade com ginásio</text>
      ${pc(1260, 150, .62)}<text x="1390" y="200">Cidade</text>
      <g stroke-width="10" stroke-dasharray="30 16" fill-opacity=".3"><rect x="1900" y="105" width="150" height="120" fill="#ff7433" stroke="#ff7433"/><rect x="2900" y="105" width="150" height="120" fill="#519E00" stroke="#7ed957"/><rect x="4330" y="105" width="150" height="120" fill="#44e0f1" stroke="#44e0f1"/></g>
      <text x="2090" y="200">Dunas e deserto</text><text x="3090" y="200">Campos e florestas</text><text x="4520" y="200">Neve</text>
      ${gym(5020, 150, 7, .62)}<text x="5150" y="200">Ginásio de Glaseado</text>
    </g>
  </g>`;
  return { svg: wrap(X0, Y0, W, H, fontCss, body), w: W, h: H };
}

// ---- the map's dressing: the GM's own texts and area outlines, redrawn in the campaign's look, with a
// building beside each place. One transparent picture the size of the map, in SCENE coordinates.
// rect: { x, y, w, h } of the map; labels: [{ x, y, text, kind, size }]; areas: [{ d, kind }];
// pics: { centro, ginasio } = { href, w, h }. Kinds: gym, glaseado, town, field, desert, snow, note.
const AREA = { field: "#7ed957", desert: "#ff9a4d", snow: "#6fe6f5", other: "#cfd6e6" };
export function labelsSVG(rect, labels, areas, pics, fontCss) {
  const rnd = rng("rotulos");
  let out = "";
  for (const a of areas) {
    const c = AREA[a.kind] ?? AREA.other;
    out += `<path d="${a.d}" fill="${c}" fill-opacity=".09" stroke="#0b1020" stroke-width="20" stroke-opacity=".45" stroke-linejoin="round"/><path d="${a.d}" fill="none" stroke="${c}" stroke-width="9" stroke-dasharray="44 24" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".95"/>`;
  }
  // areas' names first (under the places), then the places
  const order = { field: 0, desert: 0, snow: 0, note: 1, town: 2, gym: 3, glaseado: 3 };
  for (const l of [...labels].sort((a, b) => (order[a.kind] ?? 0) - (order[b.kind] ?? 0))) {
    const t = esc(l.text), fs = l.size, x = R(l.x), y = R(l.y);
    if (l.kind === "gym" || l.kind === "glaseado") {
      // no plate over the city's drawing: just the name, with a small neon gem in front
      const neon = l.kind === "glaseado" ? "#6fd8ff" : FUT.neon, f = fs * .6, g = f * .42;
      out += `<polygon points="${hexPts(x + g, y + f * .62, g)}" fill="${FUT.bg}" stroke="${neon}" stroke-width="${R(f * .12)}"/><polygon points="${hexPts(x + g, y + f * .62, g * .42)}" fill="${neon}"/>`
        + `<text x="${R(x + g * 2.5)}" y="${R(y + f * .98)}" font-family="Chakra Petch" font-weight="700" font-size="${R(f)}" fill="#f2fff6" stroke="#0b1512" stroke-width="${R(f * .24)}" stroke-linejoin="round" paint-order="stroke" letter-spacing="${R(f * .08)}">${t.toUpperCase()}</text>`;
    } else if (l.kind === "town") {
      const f = fs * .72;
      out += `<text x="${x}" y="${R(y + f * .9)}" font-family="Cormorant Garamond" font-style="italic" font-weight="700" font-size="${R(f)}" fill="${PAST.paper}" stroke="${PAST.ink}" stroke-width="${R(f * .22)}" stroke-linejoin="round" paint-order="stroke">${t}</text>`;
    } else if (l.kind === "note") {
      out += `<text x="${x}" y="${R(y + fs)}" font-family="Cormorant Garamond" font-style="italic" font-weight="700" font-size="${R(fs * 1.2)}" fill="#fff3c4" stroke="#0b1020" stroke-width="${R(fs * .22)}" paint-order="stroke">${t}</text>`;
    } else {
      const c = AREA[l.kind] ?? AREA.other, f = fs * .7;
      out += `<text x="${x}" y="${R(y + f)}" font-family="Chakra Petch" font-weight="700" font-size="${R(f)}" fill="${c}" stroke="#0b1020" stroke-width="${R(f * .2)}" paint-order="stroke" letter-spacing="${R(f * .1)}" opacity=".95">${t.toUpperCase()}</text>`;
    }
  }
  return { svg: wrap(rect.x, rect.y, rect.w, rect.h, fontCss, `<defs>${defsBase()}</defs>${out}`), w: rect.w, h: rect.h };
}
