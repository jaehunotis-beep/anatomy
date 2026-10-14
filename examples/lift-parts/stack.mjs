// Shared by the build and the page. An axial stack is a row of parts on one axis along y
// (a shaft, a sheave on an axle). Parts slide along the axis when the stack comes apart;
// the shaft is cut at every part face, and each piece is drawn just before the part that
// wraps it, or in the gap it lies in, so nothing is ever drawn through a bore.
// `kit` supplies iso, pathOf and cameraOf (imported in Node, inlined in the page).

const ROD_STEPS = 28;

function rodHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// A round bar along y from y0 to y1 at (x, z), shaded in the kit's four tones by the kit's light.
export function rodY(kit, x, z, r, y0, y1, P, tone = "mid") {
  if (y1 - y0 < 0.05) return "";
  const { sinA, cosA, sinE, cosE } = kit.cameraOf(P);
  const V = [cosA * cosE, sinA * cosE, sinE];
  const l = [-sinA, cosA, 1.2];
  const ln = Math.hypot(l[0], l[1], l[2]);
  const L = [l[0] / ln, l[1] / ln, l[2] / ln];
  const band = (s) => (s >= 0.62 ? 4 : s >= 0.42 ? 3 : s >= 0.2 ? 2 : s >= 0 ? 1 : 0);
  const ring = (y) => Array.from({ length: ROD_STEPS }, (_, j) => { const t = (j / ROD_STEPS) * Math.PI * 2; return kit.iso([x + r * Math.cos(t), y, z + r * Math.sin(t)], P); });
  const lo = ring(y0), hi = ring(y1);
  const buckets = [[], [], [], [], []];
  for (let j = 0; j < ROD_STEPS; j++) {
    const t = ((j + 0.5) / ROD_STEPS) * Math.PI * 2;
    const n = [Math.cos(t), 0, Math.sin(t)];
    if (n[0] * V[0] + n[2] * V[2] <= 1e-6) continue;
    const k = (j + 1) % ROD_STEPS;
    buckets[band(n[0] * L[0] + n[2] * L[2])].push(kit.pathOf([lo[j], lo[k], hi[k], hi[j]], true));
  }
  const cap = V[1] > 0 ? hi : lo;
  buckets[band(V[1] > 0 ? L[1] : -L[1])].push(kit.pathOf(cap, true));
  const outline = kit.pathOf(rodHull([...lo, ...hi]), true);
  const shades = buckets.slice(0, 4).map((list, i) => (list.length ? `<path class="iso-shade" data-shade="${i}" d="${list.join("")}"/>` : "")).join("");
  return `<g class="iso-solid"><path class="iso-fill" d="${outline}"/>${shades}<path class="iso-top" d="${buckets[4].join("")}"/><path class="iso-line iso-crease" data-tone="faint" d="${kit.pathOf(cap, true)}"/><path class="iso-line iso-edge" data-tone="${tone}" d="${outline}"/></g>`;
}

// Where each part sits at explode share e: its own span plus its offset along the axis.
export const spanOf = (part, e) => [part.y0 + part.out * e, part.y1 + part.out * e];

// Cut the shaft (a list of [y0, y1, r] sections, moved by shaft.out * e) at every part face.
// Returns, for each slot, the pieces to draw there: "in:i" before part i, "gap:i" after part i
// (and before part i + 1), "gap:-1" before everything.
export function shaftSlots(stack, e) {
  const spans = stack.parts.map((p) => spanOf(p, e));
  const shift = (stack.shaft.out || 0) * e;
  const faces = new Set();
  spans.forEach(([a, b]) => { faces.add(a); faces.add(b); });
  const slots = {};
  const put = (key, piece) => (slots[key] = slots[key] || []).push(piece);
  for (const [s0, s1, r] of stack.shaft.sections) {
    const a = s0 + shift, b = s1 + shift;
    const cuts = [a, ...[...faces].filter((f) => f > a && f < b).sort((p, q) => p - q), b];
    for (let i = 0; i < cuts.length - 1; i++) {
      const lo = cuts[i], hi = cuts[i + 1], mid = (lo + hi) / 2;
      const host = spans.findIndex(([p, q], index) => mid > p && mid < q && stack.parts[index].bore >= r - 1e-6);
      if (host >= 0) { put("in:" + host, [lo, hi, r]); continue; }
      let after = -1;
      spans.forEach(([, q], index) => { if (q <= mid + 1e-9) after = index; });
      put("gap:" + after, [lo, hi, r]);
    }
  }
  return slots;
}

export function slotSvg(kit, stack, pieces, P) {
  return (pieces || []).map(([a, b, r]) => rodY(kit, stack.x, stack.z, r, a, b, P, stack.shaft.tone || "mid")).join("");
}
