import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as W from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 400;

// ---- the model: a 28,800 vph Swiss lever movement ----
// 4 Hz balance = 8 beats a second. A 15-tooth escape wheel moves half a tooth (12°) a beat,
// so it turns once in 30 beats = 3.75 s (16 rpm); the fourth wheel turns once a minute.
const HZ = 4;
const AMP = (270 * Math.PI) / 180;
const LIFT = (26 * Math.PI) / 180;
const BANK = (6 * Math.PI) / 180;
const RATIO = { escape: 16, fourth: 7.5, third: 8, center: 8 }; // 80/5, 75/10, 80/10, 96/12

// ---- the world ----
const MOVE_R = 62;
const BASE_TOP = -9;
const PAD_R = 70;

const BARREL = { at: [26, -26], r: 22, teeth: 96, z: 2.4, h: 1.0 };
const CENTER = { at: [4, -14], r: 17, teeth: 80, z: 1.0, h: 0.8, hub: 2.4, arms: 4, leaves: 12, pr: 3.2, pz: 2.2, ph: 1.5 };
const THIRD = { at: [-14, -6], r: 13.5, teeth: 75, z: 3.2, h: 0.8, hub: 2, arms: 4, leaves: 10, pr: 2.6, pz: 1.0, ph: 1.6 };
const FOURTH = { at: [-18, 10], r: 12.5, teeth: 80, z: 1.0, h: 0.8, hub: 2, arms: 4, leaves: 10, pr: 2.6, pz: 2.6, ph: 1.6 };
const ESC = { at: [-6, 18], r: 9, teeth: 15, z: 3.2, h: 0.7, leaves: 5, pr: 1.8, pz: 1.0, ph: 1.6 };
const PIVOT = [4, 25];
const BAL = [21.2, 37];
const angleOf = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
const FORK = { at: PIVOT, a: angleOf(PIVOT, ESC.at), z: 3.3, h: 0.6, reach: 5.1, spread: 5.4, lever: Math.hypot(BAL[0] - PIVOT[0], BAL[1] - PIVOT[1]) - 3 };
const BALANCE = { at: BAL, r: 16, rin: 14.6, z: 5, h: 1.6, a: angleOf(BAL, PIVOT), jewel: 3 };
const BRIDGE_Z = 9;
const BRIDGE_H = 1.6;
const BRIDGE_TOP = BRIDGE_Z + BRIDGE_H;
const COCK_Z = 10;
const COCK_TOP = 12.2;
const COCK_FOOT = [47, 17];
const SPRING = { at: BAL, r0: 3.4, r1: 9.4, turns: 8, z: 7.6, a0: angleOf(BAL, COCK_FOOT) - 8 * W.TAU };
const STEM_DIR = [Math.cos(0.24), Math.sin(0.24)];
const CROWN_WHEEL = [BARREL.at[0] + 17 * STEM_DIR[0], BARREL.at[1] + 17 * STEM_DIR[1]];
const HAND = { at: FOURTH.at, len: 11, tail: 3, z: BRIDGE_TOP + 1.4 };

const P = k.fitProjection(
  [...Array.from({ length: 36 }, (_, i) => [86 * Math.cos(i / 5.73), 86 * Math.sin(i / 5.73), -24]), ...Array.from({ length: 36 }, (_, i) => [86 * Math.cos(i / 5.73), 86 * Math.sin(i / 5.73), -9]), [0, 0, COCK_TOP + 2]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 40, elevation: 40 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y], z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));
const hullBar = (circles, steps = 24) => {
  const pts = circles.flatMap(([c, r]) => k.circleRing(c[0], c[1], r, steps));
  return hull(pts);
};
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const screw = ([x, y], z, r = 1.6, slot = 0.6) => [
  S(k.cylinder(x, y, r, z, 0.5, P, 20), { tone: "mid", crease: "lo" }),
  L(k.lineOnTop(W.around([x, y], [[-r * 0.97, 0]], slot)[0], W.around([x, y], [[r * 0.97, 0]], slot)[0], z + 0.5, P), { tone: "lo" }),
].join("");
const jewel = ([x, y], z) => [
  L(k.ring(x, y, 2.3, z, P, 28), { tone: "lo" }),
  S(k.cylinder(x, y, 1.3, z, 0.25, P, 18), { tone: "hi", crease: "none" }),
  D([at([x, y, z + 0.25])], { size: 0.45, tone: "hi" }),
].join("");

// ---- static art, bottom to top ----
const BASE_R = 86;
function base() {
  const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, BASE_R, BASE_TOP - 15, 10, P, 96).fill}"/>`];
  const feet = [0, 1, 2].map((i) => W.around([0, 0], [[BASE_R - 18, 0]], Math.PI / 2 + (i * W.TAU) / 3)[0]);
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 8, BASE_TOP - 15, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, BASE_TOP - 13.4, 3.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.cylinder(0, 0, BASE_R, BASE_TOP - 10, 10, P, 128, 1.4), { tone: "mid", inner: L(k.sideArc(0, 0, BASE_R, BASE_TOP - 3, P, 96), { tone: "faint" }) }));
  out.push(L(k.ring(0, 0, BASE_R - 4, BASE_TOP, P, 128), { tone: "lo" }));
  const screws = [0, 1, 2, 3, 4, 5].map((i) => W.around([0, 0], [[BASE_R - 9, 0]], (i * W.TAU) / 6 + 0.2)[0]).filter(([x, y]) => Math.abs(Math.atan2(y, x) - Math.PI / 4) > 0.35);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, BASE_TOP, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, BASE_TOP])), { size: 0.5 }));
  // a label plate on the near rim, square to the radius
  const c = W.around([0, 0], [[BASE_R - 9.5, 0]], Math.PI / 4)[0];
  const lab = W.around(c, [[-3.6, -13], [3.6, -13], [3.6, 13], [-3.6, 13]], Math.PI / 4);
  out.push(S(k.extrude(lab, BASE_TOP, 0.8, P), { tone: "lo", crease: "none" }));
  out.push(L(k.onTop(W.around(c, [[-2.4, -11.8], [2.4, -11.8], [2.4, 11.8], [-2.4, 11.8]], Math.PI / 4), BASE_TOP + 0.8, P, true), { tone: "faint" }));
  [[-1.2, 8], [0.2, 5], [1.4, 6.5]].forEach(([u, half]) => out.push(L(k.onTop(W.around(c, [[u, -9.5], [u, -9.5 + half * 2]], Math.PI / 4), BASE_TOP + 0.8, P), { tone: "lo", free: true })));
  // the holder: a round pad the movement sits in
  out.push(S(k.cylinder(0, 0, PAD_R, BASE_TOP, 4, P, 96, 0.8), { tone: "mid", crease: "lo" }));
  out.push(L(k.ring(0, 0, PAD_R - 3, BASE_TOP + 4, P, 96), { tone: "faint" }));
  return out.join("");
}

const JAWS = [74, 194, 314].map((deg) => (deg * Math.PI) / 180);
function jaw(a) {
  const out = [];
  const ring = W.around([0, 0], [[MOVE_R - 2, -5], [PAD_R - 1, -6], [PAD_R - 1, 6], [MOVE_R - 2, 5]], a);
  out.push(S(k.extrude(ring, BASE_TOP + 4, -BASE_TOP - 4 + 0.8, P), { tone: "mid", crease: "lo" }));
  const [sx, sy] = W.around([0, 0], [[PAD_R - 5, 0]], a)[0];
  out.push(screw([sx, sy], 0.8, 1.8, a + 0.5));
  return out.join("");
}

function movementPlate() {
  const out = [];
  out.push(S(k.cylinder(0, 0, MOVE_R, -5, 5, P, 128, 0.8), { tone: "mid", crease: "lo" }));
  out.push(L(k.sideArc(0, 0, MOVE_R, -2.5, P, 96), { tone: "faint" }));
  for (let r = 8; r <= 56; r += 6) out.push(L(k.ring(0, 0, r, 0, P, 96), { tone: "faint" }));
  return out.join("");
}

const BRIDGES = {
  barrel: [[BARREL.at, 13], [CENTER.at, 4.6], [[50, -4], 5.5], [[2, -44], 5.5], [CROWN_WHEEL, 7]],
  third: [[THIRD.at, 3.8], [[-40, -14], 5]],
  fourth: [[FOURTH.at, 3.8], [[-41, 9], 5]],
};
const FEET = { barrel: [[50, -4], [2, -44]], third: [[-40, -14]], fourth: [[-41, 9]] };

function pillars() {
  const feet = byDepth(Object.values(FEET).flat());
  return feet.map(([x, y]) => S(k.cylinder(x, y, 2.6, 0, BRIDGE_Z, P, 20), { tone: "mid", crease: "none" })).join("")
    + S(k.cylinder(COCK_FOOT[0], COCK_FOOT[1], 3, 0, COCK_Z, P, 20), { tone: "mid", crease: "none" });
}

function bridge(name) {
  const ring = hullBar(BRIDGES[name]);
  const out = [S(k.extrude(ring, BRIDGE_Z, BRIDGE_H, P, { bevel: 0.5 }), { tone: "mid", crease: "lo" })];
  for (const foot of FEET[name]) out.push(screw(foot, BRIDGE_TOP, 2, 0.4 + foot[0] * 0.05));
  const pivots = { barrel: [CENTER.at], third: [THIRD.at], fourth: [] }[name];
  for (const p of pivots) out.push(jewel(p, BRIDGE_TOP));
  if (name === "fourth") out.push(jewel(FOURTH.at, BRIDGE_TOP));
  return out.join("");
}

function barrelDrum() {
  const out = [];
  const [x, y] = BARREL.at;
  out.push(S(k.extrude(W.around(BARREL.at, W.teethRing(BARREL.teeth, BARREL.r, 1.0), 0), BARREL.z, BARREL.h, P, { convex: false }), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x, y, BARREL.r - 1.4, BARREL.z + BARREL.h, 4.2, P, 80, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideArc(x, y, BARREL.r - 1.4, BARREL.z + BARREL.h + 1.6, P, 60), { tone: "faint" }));
  out.push(L(k.ring(x, y, BARREL.r - 3.4, BARREL.z + BARREL.h + 4.2, P, 80), { tone: "lo" }));
  return out.join("");
}

function crownAndStem() {
  const out = [];
  const o = [STEM_DIR[0] * (MOVE_R - 1), STEM_DIR[1] * (MOVE_R - 1), -2.5];
  const F = G.frameAlong(o, [STEM_DIR[0], STEM_DIR[1], 0]);
  out.push(S(G.disc(0, 6, 1.1, F, P), { tone: "mid" }));
  out.push(S(G.disc(6, 7.4, 2.4, F, P), { tone: "mid" }));
  out.push(S(G.solidOf([[7.4, 4.2], [12.4, 4.2], [13.2, 3.4, 1], [13.6, 2.2]], F, P), { tone: "hi", crease: "lo", inner: k.fadedSvg(G.ribsOf(F, 7.6, 12.2, 4.2, 30, P, { fade: [0.04, 0.4] }), { tone: "lo" }) }));
  return out.join("");
}

function ratchet(a) {
  const [x, y] = BARREL.at;
  return [
    S(k.extrude(W.around(BARREL.at, W.teethRing(40, 11, 1.2, 0), a), BRIDGE_TOP, 1.2, P, { convex: false }), { tone: "hi", crease: "lo" }),
    L(k.ring(x, y, 8.6, BRIDGE_TOP + 1.2, P, 64), { tone: "faint" }),
    L(k.ring(x, y, 5.8, BRIDGE_TOP + 1.2, P, 48), { tone: "faint" }),
    screw([x, y], BRIDGE_TOP + 1.2, 3.2, a + 0.9),
  ].join("");
}

function crownWheel() {
  const [x, y] = CROWN_WHEEL;
  return [
    S(k.extrude(W.around(CROWN_WHEEL, W.teethRing(28, 5.6, 0.8, 0), 0.1), BRIDGE_TOP, 1, P, { convex: false }), { tone: "hi", crease: "lo" }),
    screw([x, y], BRIDGE_TOP + 1, 1.8, 2.1),
  ].join("");
}

function click() {
  // the click: a pawl on its screw, its tip in the ratchet teeth, held by a small wire spring
  const tip = W.around(BARREL.at, [[11.4, 0]], -1.9)[0];
  const pivot = W.around(BARREL.at, [[17, 0]], -1.55)[0];
  const ring = hullBar([[pivot, 2], [tip, 0.8]], 16);
  return S(k.extrude(ring, BRIDGE_TOP, 1, P), { tone: "mid", crease: "lo" }) + screw(pivot, BRIDGE_TOP + 1, 1.3, 0.3);
}

function balanceRim() {
  // a C-shaped ring: outer anticlockwise, inner clockwise, joined by a zero-width cut
  const back = angleOf(BAL, COCK_FOOT); // the cut hides under the balance cock
  const outer = W.around(BAL, k.circleRing(0, 0, BALANCE.r, 96), back);
  const inner = W.around(BAL, k.circleRing(0, 0, BALANCE.rin, 96), back);
  const innerCW = [inner[0], ...inner.slice(1).reverse()];
  const paths = k.extrude([...outer, outer[0], ...innerCW, innerCW[0]], BALANCE.z, BALANCE.h, P, { convex: false });
  return S(paths, { tone: "hi", crease: "lo", lit: true });
}

function cock() {
  const ring = hullBar([[BAL, 3.4], [COCK_FOOT, 5.2]]);
  const out = [S(k.extrude(ring, COCK_Z, COCK_TOP - COCK_Z, P, { bevel: 0.6 }), { tone: "mid", crease: "lo" })];
  // regulator: an index lever turning about the balance pivot over a short +/- scale on the cock
  const toward = angleOf(BAL, COCK_FOOT);
  const ticks = k.radialTicks(BAL[0], BAL[1], 13.6, 9, 4, COCK_TOP, [0.9, 1.6], P, Math.PI / 2 + toward - 0.32, 0.64);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const idx = hullBar([[BAL, 2.6], [W.around(BAL, [[12.6, 0]], toward + 0.06)[0], 0.7]], 16);
  out.push(S(k.extrude(idx, COCK_TOP, 0.5, P), { tone: "hi", crease: "lo" }));
  out.push(jewel(BAL, COCK_TOP + 0.5));
  out.push(screw(COCK_FOOT, COCK_TOP, 2.2, 1.2));
  return out.join("");
}

// ---- assemble in painter's order ----
const live = (name, svg) => `<g data-part="${name}">${svg}</g>`;
const lowLayer = [
  [CENTER.at, live("center-wheel", W.wheelSvg(k, CENTER, 0, P))],
  [FOURTH.at, live("fourth-wheel", W.wheelSvg(k, FOURTH, 0, P))],
  [THIRD.at, live("third-pinion", W.pinionSvg(k, THIRD, 0, P))],
  [ESC.at, live("escape-pinion", W.pinionSvg(k, ESC, 0, P))],
];
const midLayer = [
  [CENTER.at, live("center-pinion", W.pinionSvg(k, CENTER, 0, P))],
  [FOURTH.at, live("fourth-pinion", W.pinionSvg(k, FOURTH, 0, P))],
  [BARREL.at, live("barrel", barrelDrum())],
  [THIRD.at, live("third-wheel", W.wheelSvg(k, THIRD, 0, P))],
  [ESC.at, live("escape-wheel", W.escapeSvg(k, ESC, 0, P))],
  [PIVOT, live("fork", W.forkSvg(k, FORK, BANK, P))],
];
const sorted = (list) => [...list].sort((a, b) => depth(a[0]) - depth(b[0])).map(([, svg]) => svg).join("");
const bridgeOrder = ["barrel", "third", "fourth"].sort((a, b) => depth(BRIDGES[a][0][0]) - depth(BRIDGES[b][0][0]));

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A mechanical watch movement seen from the back, held in a round holder on a bench block. The mainspring barrel drives a train of wheels: centre, third, fourth and a 15-tooth escape wheel. A pallet fork rocks between the escape wheel and the balance wheel; each time the balance swings through its centre it flips the fork, which lets the escape wheel advance half a tooth and gives the balance a push. Eight such beats make one second.",
  body: [
    base(),
    ...JAWS.filter((a) => depth([Math.cos(a), Math.sin(a)]) < 0).map(jaw),
    movementPlate(),
    ...JAWS.filter((a) => depth([Math.cos(a), Math.sin(a)]) >= 0).map(jaw),
    crownAndStem(),
    sorted(lowLayer),
    sorted(midLayer),
    balanceRim(),
    live("balance", W.balanceMoving(k, BALANCE, 0, P)),
    pillars(),
    `<path data-part="spring" class="iso-line" data-tone="mid" d="${W.hairspring(k, SPRING, 0, P)}"/>`,
    bridgeOrder.map(bridge).join(""),
    live("ratchet", ratchet(0)),
    click(),
    crownWheel(),
    `<path data-part="hand" class="iso-line" data-tone="hi" data-free="" d="${W.handPath(k, HAND, 0, P)}" style="stroke-width:0.9"/>`,
    D([at([FOURTH.at[0], FOURTH.at[1], HAND.z])], { size: 0.9, tone: "hi" }),
    cock(),
  ],
});

const partsSource = readFileSync(join(HERE, "parts.mjs"), "utf8").replace(/^export /gm, "");
const script = `
${partsSource}
const k = { extrude, solidSvg, lineSvg, cylinder, onTop, ring, lineOnTop, depthOf };
const P = ${JSON.stringify(P)};
const HZ = ${HZ}, AMP = ${AMP}, LIFT = ${LIFT}, BANK = ${BANK};
const RATIO = ${JSON.stringify(RATIO)};
const CENTER = ${JSON.stringify(CENTER)}, THIRD = ${JSON.stringify(THIRD)}, FOURTH = ${JSON.stringify(FOURTH)}, ESC = ${JSON.stringify(ESC)};
const FORK = ${JSON.stringify(FORK)}, BALANCE = ${JSON.stringify(BALANCE)}, SPRING = ${JSON.stringify(SPRING)}, HAND = ${JSON.stringify(HAND)};
const BARREL_AT = ${JSON.stringify(BARREL.at)}, BRIDGE_TOP = ${BRIDGE_TOP};
${ratchetLive()}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const el = {};
for (const name of ["center-wheel", "fourth-wheel", "third-pinion", "escape-pinion", "center-pinion", "fourth-pinion", "third-wheel", "escape-wheel", "fork", "balance", "spring", "hand", "ratchet"]) el[name] = part(name);
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SPEEDS = [1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => t * t * (3 - 2 * t);
const DELTA = Math.asin(LIFT / AMP) / Math.PI;
// Watch time t (s): balance angle, fork angle and the escape wheel's progress in half teeth.
function stateAt(t) {
  const p = 2 * HZ * t;                            // half-swings; the balance crosses its centre at whole p
  const theta = AMP * Math.sin(Math.PI * p);
  const fork = BANK * clamp(theta / LIFT, -1, 1);
  const n = Math.floor(p + DELTA);
  const half = n + ease(clamp((p + DELTA - n) / (2 * DELTA), 0, 1));
  return { theta, fork, half, beats: n };
}
let t = 0.07, speed = 1 / 16, want = speed, frame = 0, last = 0, visible = false;
const cache = {};
function put(name, key, make) { if (cache[name] === key) return; cache[name] = key; el[name].innerHTML = make(); }
function draw() {
  const s = stateAt(t);
  const esc = -s.half * (Math.PI * 2 / 30);
  const fourth = -esc / RATIO.escape, third = -fourth / RATIO.fourth, center = -third / RATIO.third, barrel = -center / RATIO.center;
  const q = (a) => a.toFixed(4);
  put("escape-wheel", q(esc), () => escapeSvg(k, ESC, esc, P));
  put("escape-pinion", q(esc), () => pinionSvg(k, ESC, esc, P));
  put("fourth-wheel", q(fourth), () => wheelSvg(k, FOURTH, fourth, P));
  put("fourth-pinion", q(fourth), () => pinionSvg(k, FOURTH, fourth, P));
  put("third-wheel", q(third), () => wheelSvg(k, THIRD, third, P));
  put("third-pinion", q(third), () => pinionSvg(k, THIRD, third, P));
  put("center-wheel", q(center), () => wheelSvg(k, CENTER, center, P));
  put("center-pinion", q(center), () => pinionSvg(k, CENTER, center, P));
  put("ratchet", q(barrel), () => ratchetSvg(barrel));
  put("fork", q(s.fork), () => forkSvg(k, FORK, s.fork, P));
  put("balance", q(s.theta), () => balanceMoving(k, BALANCE, s.theta, P));
  el.spring.setAttribute("d", hairspring(k, SPRING, s.theta, P));
  el.hand.setAttribute("d", handPath(k, HAND, fourth, P));
  const deg = Math.round((s.theta * 180) / Math.PI);
  const label = want >= 1 ? "×1" : "×1/" + Math.round(1 / want);
  const text = label + " · balance " + (deg >= 0 ? "+" : "−") + Math.abs(deg) + "° · beat " + s.beats + " · " + (s.beats / (2 * HZ)).toFixed(3) + " s";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  speed += (want - speed) * (1 - Math.exp(-dt / 0.35));
  if (Math.abs(want - speed) < want * 0.01) speed = want;
  t += dt * speed;
  draw();
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); else { cancelAnimationFrame(frame); frame = 0; } }, { rootMargin: "120px 0px" }).observe(stage);
const pick = (share) => SPEEDS[clamp(Math.round(share * (SPEEDS.length - 1)), 0, SPEEDS.length - 1)];
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  want = pick(clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1));
  run();
});
stage.addEventListener("pointerleave", () => { want = 1 / 16; });
stage.addEventListener("keydown", (event) => {
  const here = SPEEDS.reduce((best, s, i) => (Math.abs(s - want) < Math.abs(SPEEDS[best] - want) ? i : best), 0);
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = Math.min(SPEEDS.length - 1, here + 1);
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = Math.max(0, here - 1);
  if (event.key === " ") { event.preventDefault(); t += 1 / (2 * HZ); draw(); return; }
  if (to === null) return;
  event.preventDefault();
  want = SPEEDS[to];
  run();
});
draw();
`;

function ratchetLive() {
  return `
const ratchetSvg = (a) => [
  solidSvg(extrude(around(BARREL_AT, teethRing(40, 11, 1.2, 0), a), BRIDGE_TOP, 1.2, P, { convex: false }), { tone: "hi", crease: "lo" }),
  lineSvg(ring(BARREL_AT[0], BARREL_AT[1], 8.6, BRIDGE_TOP + 1.2, P, 64), { tone: "faint" }),
  lineSvg(ring(BARREL_AT[0], BARREL_AT[1], 5.8, BRIDGE_TOP + 1.2, P, 48), { tone: "faint" }),
  solidSvg(cylinder(BARREL_AT[0], BARREL_AT[1], 3.2, BRIDGE_TOP + 1.2, 0.5, P, 20), { tone: "mid", crease: "lo" }),
  lineSvg(lineOnTop(around(BARREL_AT, [[-3.1, 0]], a + 0.9)[0], around(BARREL_AT, [[3.1, 0]], a + 0.9)[0], BRIDGE_TOP + 1.7, P), { tone: "lo" }),
].join("");`;
}

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Lever escapement",
  hint: "Hover left to slow time",
  readout: "×1/16 · balance +0° · beat 0 · 0.000 s",
  keys: [
    { mark: "lit", label: "Balance wheel: swings at 4 Hz, 270° each way, and sets the rate" },
    { mark: "raised", label: "Train: barrel → centre → third → fourth → escape wheel" },
    { mark: "edge", label: "Pallet fork: flips once per beat and lets the escape wheel through half a tooth" },
  ],
  caption:
    "A 28,800 vph movement, seen from the back. The mainspring in the barrel pushes the train, but the escape wheel is locked by a pallet stone. Each time the balance swings through its centre its roller jewel kicks the fork over: one stone lifts, the wheel runs half a tooth (12°) and pushes the fork, and the fork pushes the balance back. That is 8 beats a second; the escape wheel turns once in 3.75 s, and the fourth wheel, 16 times slower, once a minute. The hand on its pivot is the seconds hand. The escape and pallet cocks are off, so the escapement shows.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Watch escapement: arrow keys change the speed, space steps one beat" aria-valuemin="0" aria-valuemax="5">${svg}</div>`,
});

const out = theme === "light" ? "watch-escapement-light.html" : "watch-escapement.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Lever escapement", theme, body, script: kitScript() + script }));
console.log("wrote", out);
