import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 520;

// ---- the model: a 1:1 roped traction lift ----
// 1 world unit = 8 cm. Four stops 3.2 m apart; rated speed 1.6 m/s, acceleration 0.8 m/s².
// The car hangs from ropes over a traction sheave; the ropes run on over a deflector sheave
// down to a counterweight equal to the car plus 45% of its 630 kg rated load.
const UNIT = 0.08;
const FLOOR = 40;
const FLOORS = 4;
const V_MAX = 1.6;
const ACCEL = 0.8;
const CAR_KG = 900;
const LOAD_KG = 630;
const CW_KG = CAR_KG + 0.45 * LOAD_KG;

// ---- the world ----
const POSTS = { x0: -20, x1: 24, y0: -16, y1: 16 };
const TOP = 172; // underside of the machine beams
const BED_Z = 172;
const BED_TOP = 176;
const CAR = { x: -4, y: -12, w: 24, d: 24, r: 0.8 };
const CAB_Z = 2;
const CAB_H = 30;
const HITCH_UP = 38; // platform underside to rope hitch
const HITCH = [8, 0];
const TRACTION = { x: 3.5, z: 182, r: 4.5 };
const DEFLECT = { x: -10.5, z: 166, r: 3.5 };
const CW = { x: -17, y: -10, w: 6, d: 20, r: 0.6 };
const CW_H = 30;
const CW_X = -14;
const ROPE_SUM = 152; // car rope + counterweight rope, sheave centre to hitch
const ROPES = [-2.25, -0.75, 0.75, 2.25];
const LANDING = { x: 25.6, y: -18, w: 62, d: 36, r: 0.6 };
const SLAB = 3;

const P = k.fitProjection(
  [...k.boxCorners({ x: -30, y: -26, w: 124, d: 52 }, -14, 0), [POSTS.x0, POSTS.y0, BED_TOP + 16], [TRACTION.x, 16, TRACTION.z + 6], [90, 18, 3 * FLOOR + SLAB + 8]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 54, elevation: 36 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y], z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));
const box = (x0, y0, x1, y1, z, h, tone = "mid", bevel = 0) => S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.3 }, z, h, P, 2, bevel), { tone, crease: "lo" });
const LEVELS = [FLOOR, 2 * FLOOR, 3 * FLOOR, TOP - 4];

// ---- base, back wall and the back half of the shaft frame ----
function base() {
  const plan = { x: -30, y: -26, w: 124, d: 52, r: 4 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -14, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(plan, 9))) {
    out.push(S(k.cylinder(x, y, 5, -14, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 3.8, -12.6, 2.6, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(plan, -10, 10, P, 6, 1.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 3.5), 0, P), { tone: "lo" }));
  const screws = k.corners(plan, 6.5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.6, 0, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  // the pit: a recess under the shaft with its buffers
  out.push(L(k.planOutline({ x: POSTS.x0 + 2, y: POSTS.y0 + 2, w: POSTS.x1 - POSTS.x0 - 4, d: POSTS.y1 - POSTS.y0 - 4, r: 0.6 }, 0, P, 2), { tone: "faint" }));
  // a ruler strip along the near edge of the landings
  const strip = { x: LANDING.x + 4, y: plan.y + plan.d - 6.4, w: 48, d: 4.4, r: 0.6 };
  out.push(S(k.slabOf(strip, 0, 0.5, P, 2), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2.5, 4, strip.y + 0.4, 0.5, [1.4, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function wall() {
  const out = [S(k.slabOf({ x: LANDING.x, y: LANDING.y - 2.4, w: LANDING.w + 2, d: 2.4, r: 0.4 }, 0, 3 * FLOOR + SLAB + 8, P, 2), { tone: "lo", crease: "lo" })];
  return out.join("");
}

const post = ([x, y]) => S(k.slabOf({ x: x - 1.5, y: y - 1.5, w: 3, d: 3, r: 0.3 }, 0, TOP, P, 2), { tone: "mid", crease: "lo" })
  + D([at([x, y, TOP])], { size: 0.4, tone: "lo" });

// a tie between two posts at height z, along x or y
function tie(from, to, z) {
  const [x0, y0] = from, [x1, y1] = to;
  if (y0 === y1) return box(Math.min(x0, x1) + 1.5, y0 - 0.8, Math.max(x0, x1) - 1.5, y0 + 0.8, z - 1.2, 2.4);
  return box(x0 - 0.8, Math.min(y0, y1) + 1.5, x0 + 0.8, Math.max(y0, y1) - 1.5, z - 1.2, 2.4);
}

// a coil spring standing on end: the halves facing away and toward the viewer, for painter's order
function upright(x, y, z0, z1, r, turns) {
  const back = [], front = [];
  let run = [], near = null;
  const n = turns * 20;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * turns * Math.PI * 2;
    const flat = at([x + r * Math.cos(t), y + r * Math.sin(t), z0 + ((z1 - z0) * i) / n]);
    const facing = depth([Math.cos(t), Math.sin(t)]) > 0;
    if (near === null) near = facing;
    if (facing !== near) { run.push(flat); (near ? front : back).push(k.pathOf(run)); run = [flat]; near = facing; continue; }
    run.push(flat);
  }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

function buffer(x, y, top) {
  const out = [S(k.cylinder(x, y, 3.2, 0, 1.4, P, 24), { tone: "lo" })];
  const c = upright(x, y, 1.4, top - 1.6, 2.2, 5);
  out.push(L(c.back, { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 0.9, 1.4, top - 3, P, 12), { tone: "mid", crease: "none" }));
  out.push(L(c.front, { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 2.8, top - 1.6, 1.6, P, 24), { tone: "mid" }));
  return out.join("");
}

// a T guide rail standing on the pit floor, with a bracket at every tie
function rail(x, y, side) {
  const out = [box(x - 1.2, y - 0.5, x + 1.2, y + 0.5, 0, TOP, "mid")];
  out.push(box(x - 0.35, side > 0 ? y - 1.6 : y + 0.5, x + 0.35, side > 0 ? y - 0.5 : y + 1.6, 0, TOP, "hi"));
  for (const z of LEVELS) out.push(box(x - 1.6, side > 0 ? y + 0.5 : y - 1.5, x + 1.6, side > 0 ? y + 1.5 : y - 0.5, z - 2, 3, "lo"));
  return out.join("");
}

// ---- the counterweight: a frame of two stiles with a stack of filler weights ----
function counterweight() {
  const out = [];
  const { x, y, w, d } = CW;
  out.push(box(x - 0.4, y - 1.4, x + w + 0.4, y, 0, CW_H, "mid"));
  for (let i = 0; i < 9; i++) out.push(box(x + 0.4, y, x + w - 0.4, y + d, 1.6 + i * 3, 2.8, "hi"));
  out.push(box(x - 0.4, y + d, x + w + 0.4, y + d + 1.4, 0, CW_H, "mid"));
  out.push(box(x - 0.4, y - 1.4, x + w + 0.4, y + d + 1.4, CW_H - 1.6, 1.6, "mid", 0.3));
  out.push(box(x - 0.4, y - 1.4, x + w + 0.4, y + d + 1.4, 0, 1.6, "mid"));
  // guide shoes on the rails at top and bottom, the rope hitch on top
  for (const z of [0.4, CW_H - 2]) for (const yy of [y - 2.4, y + d + 1.4]) out.push(box(CW_X - 1, yy, CW_X + 1, yy + 1, z, 1.6, "lo"));
  out.push(box(CW_X - 1.4, -3, CW_X + 1.4, 3, CW_H, 1.6, "mid"));
  out.push(D(ROPES.map((ry) => at([CW_X, ry, CW_H + 1.6])), { size: 0.55, tone: "hi" }));
  return out.join("");
}

// ---- the car: platform, cab, door, sling with crosshead, shoes and hitch ----
function car() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CAR, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  const { x, y, w, d } = CAR;
  out.push(S(k.slabOf({ x: x - 0.6, y: y - 0.6, w: w + 1.2, d: d + 1.2, r: 0.6 }, 0, CAB_Z, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  const cab = k.slabOf(CAR, CAB_Z, CAB_H, P, 2, 0.5);
  // the door on the +x face: two panels meeting in the middle, under a header line
  const fx = x + w;
  const door = [
    k.segment([fx, -6, CAB_Z], [fx, -6, CAB_Z + 22], P),
    k.segment([fx, 6, CAB_Z], [fx, 6, CAB_Z + 22], P),
    k.segment([fx, -6, CAB_Z + 22], [fx, 6, CAB_Z + 22], P),
    k.segment([fx, 0, CAB_Z], [fx, 0, CAB_Z + 22], P),
    k.sideSeam(CAR, CAB_Z + 25, P, 2),
  ].join("");
  // a ventilation grille and the car light on the +y side
  const vents = [0, 1, 2, 3, 4].map((i) => k.segment([x + 6 + i * 3, y + d, CAB_Z + 26.5], [x + 6 + i * 3, y + d, CAB_Z + 28.5], P)).join("");
  out.push(S(cab, { tone: "hi", crease: "lo", lit: true, inner: L(door, { tone: "lo" }) + L(vents, { tone: "faint" }) }));
  // car operating panel beside the door
  out.push(S(k.slabOf({ x: fx, y: 7.6, w: 0.5, d: 2.6, r: 0.2 }, CAB_Z + 9, 7, P, 2), { tone: "mid", crease: "none" }));
  out.push(D([CAB_Z + 14.4, CAB_Z + 12.8, CAB_Z + 11.2, CAB_Z + 9.6].map((z) => at([fx + 0.5, 8.9, z + 0.4])), { size: 0.4, tone: "lo" }));
  // sling: two stiles outside the cab, a crosshead across the top, a plank beneath
  for (const side of [-1, 1]) {
    const y0 = side < 0 ? y - 1.4 : y + d;
    out.push(box(HITCH[0] - 1.2, y0, HITCH[0] + 1.2, y0 + 1.4, 0, HITCH_UP - 3, "mid"));
    for (const z of [0.6, HITCH_UP - 6]) out.push(box(HITCH[0] - 1, side < 0 ? y - 2.6 : y + d + 1.4, HITCH[0] + 1, side < 0 ? y - 1.4 : y + d + 2.6, z, 2.4, "lo"));
  }
  out.push(box(HITCH[0] - 1.6, y - 1.6, HITCH[0] + 1.6, y + d + 1.6, HITCH_UP - 4, 2.4, "mid", 0.3));
  out.push(box(HITCH[0] - 2, -3.4, HITCH[0] + 2, 3.4, HITCH_UP - 1.6, 1.6, "mid"));
  out.push(D(ROPES.map((ry) => at([HITCH[0], ry, HITCH_UP])), { size: 0.55, tone: "hi" }));
  return out.join("");
}

// ---- landings: floor slabs on the back wall, a sill and a call panel at each ----
function landing(level) {
  const z = level * FLOOR;
  const out = [];
  if (level > 0) out.push(S(k.slabOf(LANDING, z - SLAB, SLAB, P, 2, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(LANDING, z - 1, P, 2), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: LANDING.x, y: -9, w: 2.2, d: 18, r: 0.3 }, z, 0.4, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: LANDING.x + 0.4, y: 10.4, w: 0.6, d: 3, r: 0.2 }, z + 10, 5, P, 2), { tone: "mid", crease: "none" }));
  out.push(D([at([LANDING.x + 1, 11.9, z + 13.4]), at([LANDING.x + 1, 11.9, z + 11.6])], { size: 0.5, tone: "lo" }));
  // columns up to the next floor, standing on this one
  if (level < FLOORS - 1) {
    const top = (level + 1) * FLOOR - SLAB;
    for (const [cx, cy] of byDepth([[LANDING.x + LANDING.w - 3, LANDING.y + LANDING.d - 3], [LANDING.x + LANDING.w - 3, LANDING.y + 3]])) {
      out.push(S(k.slabOf({ x: cx - 1.6, y: cy - 1.6, w: 3.2, d: 3.2, r: 0.3 }, z, top - z, P, 2), { tone: "mid", crease: "lo" }));
    }
  }
  return out.join("");
}

// ---- the machine: beams, bedplate, traction sheave, brake, motor and the deflector below ----
const SHEAVE = G.frameAlong([TRACTION.x, -4, TRACTION.z], [0, 1, 0]);
const DEFL = G.frameAlong([DEFLECT.x, -3.2, DEFLECT.z], [0, 1, 0]);
function deflector() {
  const out = [];
  for (const y of [-5.6, 4.4]) out.push(box(DEFLECT.x - 1, y, DEFLECT.x + 1, y + 1.2, DEFLECT.z - 1, TOP - DEFLECT.z + 1, "mid"));
  out.push(S(G.disc(0, 6.4, DEFLECT.r, DEFL, P), { tone: "mid", inner: L(ROPES.map((ry) => G.arcOf(DEFL, ry + 3.2, DEFLECT.r, P)).join(""), { tone: "faint" }) }));
  out.push(S(G.disc(6.4, 7.6, 0.9, DEFL, P), { tone: "mid" }));
  return out.join("");
}
function bedplate() {
  const out = [];
  for (const y of [POSTS.y0, POSTS.y1]) out.push(box(POSTS.x0 - 2, y - 2, POSTS.x1 + 2, y + 2, BED_Z - 4, 4, "mid"));
  const plan = { x: POSTS.x0 - 2, y: POSTS.y0 - 2, w: POSTS.x1 - POSTS.x0 + 4, d: POSTS.y1 - POSTS.y0 + 4, r: 1 };
  const holes = [
    k.planOutline({ x: HITCH[0] - 1.7, y: -3.4, w: 2.0, d: 6.8, r: 0.9 }, BED_TOP, P, 4),
    k.planOutline({ x: crossing(BED_Z)[0] - 1.2, y: -3.4, w: crossing(BED_TOP)[0] - crossing(BED_Z)[0] + 2.4, d: 6.8, r: 1.1 }, BED_TOP, P, 4),
  ].join("");
  out.push(S(k.slabOf(plan, BED_Z, BED_TOP - BED_Z, P, 3, 0.6), { tone: "mid", crease: "lo", inner: "" }));
  out.push(L(holes, { tone: "lo" }));
  const screws = k.corners(plan, 3);
  out.push(D(screws.map(([x, y]) => at([x, y, BED_TOP])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
function machine() {
  const out = [];
  // motor at the back on its feet, brake drum between motor and sheave
  const MOTOR = G.frameAlong([TRACTION.x, -18, TRACTION.z], [0, 1, 0]);
  out.push(box(TRACTION.x - 5, -18, TRACTION.x + 5, -7, BED_TOP, 2.2, "lo"));
  out.push(S(G.solidOf([[0, 4.6], [0.8, 5.4, 1], [8.6, 5.4, 1], [9.4, 4.6]], MOTOR, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(MOTOR, 1.2, 8.2, 5.4, 28, P, { fade: [0.04, 0.4], seams: true }), { tone: "lo" }) }));
  out.push(S(G.disc(9.4, 10.6, 4.2, MOTOR, P), { tone: "mid" }));
  out.push(S(G.disc(10.6, 13.6, 4.8, MOTOR, P), { tone: "hi", inner: L(G.arcOf(MOTOR, 12.1, 4.8, P), { tone: "faint" }) }));
  for (const side of [-1, 1]) {
    const bx = TRACTION.x + side * 5.6;
    out.push(box(bx - 0.7, -7.6, bx + 0.7, -5.2, BED_TOP, TRACTION.z - BED_TOP + 3, "mid"));
  }
  out.push(box(TRACTION.x - 6.3, -7.4, TRACTION.x + 6.3, -5.4, TRACTION.z + 3, 1.2, "mid"));
  // the traction sheave with four rope grooves
  out.push(S(G.disc(0, 8, TRACTION.r, SHEAVE, P), { tone: "hi", inner: L(ROPES.map((ry) => G.arcOf(SHEAVE, ry + 4 - 0.6, TRACTION.r, P) + G.arcOf(SHEAVE, ry + 4 + 0.6, TRACTION.r, P)).join(""), { tone: "faint" }) }));
  out.push(`<path data-part="spokes" class="iso-line" data-tone="lo" d="${spokes(0)}"/>`);
  // shaft out to an outboard bearing
  out.push(S(G.disc(8, 12, 1.2, SHEAVE, P), { tone: "mid" }));
  out.push(box(TRACTION.x - 3, 7.6, TRACTION.x + 3, 10.6, BED_TOP, TRACTION.z - BED_TOP - 0.5, "mid"));
  out.push(S(G.disc(11.6, 14.4, 2.4, SHEAVE, P), { tone: "mid" }));
  out.push(S(G.disc(14.4, 15.2, 1.4, SHEAVE, P), { tone: "mid" }));
  out.push(D(G.dotsOf(SHEAVE, 15.2, 0.9, 4, P, { all: true }), { size: 0.35, tone: "lo" }));
  out.push(D([[TRACTION.x - 2.2, 9.1], [TRACTION.x + 2.2, 9.1]].map(([x, y]) => at([x, y, BED_TOP + 0.4])), { size: 0.4, tone: "lo" }));
  return out.join("");
}
function spokes(angle) {
  const face = 8;
  const pts = (r, t) => at([TRACTION.x + r * Math.cos(t), -4 + face, TRACTION.z + r * Math.sin(t)]);
  const out = [];
  for (let i = 0; i < 6; i++) {
    const t = angle + (i * Math.PI) / 3;
    const a = pts(1.6, t), b = pts(TRACTION.r - 0.6, t);
    out.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  }
  return out.join("");
}

// ropes: car side straight up into the traction sheave, counterweight side down from the deflector;
// between them they wrap the traction sheave and cross to the deflector along the shared tangent
function tangent() {
  const dx = DEFLECT.x - TRACTION.x, dz = DEFLECT.z - TRACTION.z;
  const dist = Math.hypot(dx, dz);
  const base = Math.atan2(dz, dx);
  const off = Math.acos((TRACTION.r - DEFLECT.r) / dist);
  const t = base - off; // the normal on the upper-left side, shared by both sheaves
  const n = [Math.cos(t), Math.sin(t)];
  return { t, a: [TRACTION.x + TRACTION.r * n[0], TRACTION.z + TRACTION.r * n[1]], b: [DEFLECT.x + DEFLECT.r * n[0], DEFLECT.z + DEFLECT.r * n[1]] };
}
const TAN = tangent();
const ropeSeg = (a, b) => ROPES.map((ry) => k.segment([a[0], ry, a[1]], [b[0], ry, b[1]], P)).join("");
const arc = (c, r, t0, t1, ry) => {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = t0 + ((t1 - t0) * i) / 16; pts.push(at([c.x + (r + 0.3) * Math.cos(t), ry, c.z + (r + 0.3) * Math.sin(t)])); }
  return k.pathOf(pts);
};
function crossing(zCut) {
  // where the tangent rope passes the bedplate face at height zCut
  const f = (zCut - TAN.a[1]) / (TAN.b[1] - TAN.a[1]);
  return [TAN.a[0] + f * (TAN.b[0] - TAN.a[0]), zCut];
}
const ropesBelow = () => ropeSeg(crossing(BED_Z), TAN.b) + ROPES.map((ry) => arc(DEFLECT, DEFLECT.r, TAN.t, Math.PI, ry)).join("");
const ropesAbove = () => ropeSeg(TAN.a, crossing(BED_TOP)) + ROPES.map((ry) => arc(TRACTION, TRACTION.r, 0, TAN.t, ry)).join("") + ropeSeg([HITCH[0] + 0.3, BED_TOP], [HITCH[0] + 0.3, TRACTION.z]);

// car platform height z → counterweight underside height
const cwAt = (z) => ROPE_SUM - (TRACTION.z - (z + HITCH_UP)) - CW_H;
const carRope = (z) => ropeSeg([HITCH[0], z + HITCH_UP], [HITCH[0], BED_Z]);
const cwRope = (z) => ropeSeg([CW_X, cwAt(z) + CW_H + 1.6], [CW_X, DEFLECT.z]);

const START = 0;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A traction lift in an open steel shaft beside four floor landings. At the top a motor turns a grooved traction sheave; four ropes run from the car's crosshead up over the sheave, across to a deflector sheave and down to a counterweight that rides its own rails at the back of the shaft. When the sheave turns, the car and the counterweight move by the same distance in opposite directions.",
  body: [
    base(),
    wall(),
    post([POSTS.x0, POSTS.y0]),
    LEVELS.map((z) => tie([POSTS.x0, POSTS.y0], [POSTS.x1, POSTS.y0], z) + tie([POSTS.x0, POSTS.y0], [POSTS.x0, POSTS.y1], z)).join(""),
    post([POSTS.x0, POSTS.y1]),
    post([POSTS.x1, POSTS.y0]),
    buffer(CW_X, 0, 6),
    rail(CW_X, -11.5, -1),
    `<g data-part="cw" transform="${k.translateAlong(P, [0, 0, cwAt(START)])}">${counterweight()}</g>`,
    rail(CW_X, 11.5, 1),
    `<path data-part="cw-rope" class="iso-line" data-tone="mid" d="${cwRope(START)}"/>`,
    deflector(),
    `<path class="iso-line" data-tone="mid" d="${ropesBelow()}"/>`,
    rail(HITCH[0], -14.6, -1),
    `<g data-part="car" transform="${k.translateAlong(P, [0, 0, START])}">${car()}</g>`,
    `<path data-part="car-rope" class="iso-line" data-tone="mid" d="${carRope(START)}"/>`,
    rail(HITCH[0], 14.6, 1),
    [TOP - 4].map((z) => tie([POSTS.x0, POSTS.y1], [POSTS.x1, POSTS.y1], z) + tie([POSTS.x1, POSTS.y0], [POSTS.x1, POSTS.y1], z)).join(""),
    post([POSTS.x1, POSTS.y1]),
    [0, 1, 2, 3].map(landing).join(""),
    bedplate(),
    machine(),
    `<path class="iso-line" data-tone="mid" d="${ropesAbove()}"/>`,
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const M_PER = ${UNIT}, FLOOR = ${FLOOR}, FLOORS = ${FLOORS}, V_MAX = ${V_MAX}, ACCEL = ${ACCEL};
const HITCH = ${JSON.stringify(HITCH)}, HITCH_UP = ${HITCH_UP}, BED_Z = ${BED_Z}, CW_X = ${CW_X}, CW_H = ${CW_H}, ROPE_SUM = ${ROPE_SUM};
const TRACTION = ${JSON.stringify(TRACTION)}, DEFLECT = ${JSON.stringify(DEFLECT)}, ROPES = ${JSON.stringify(ROPES)};
const ropeSeg = (a, b) => ROPES.map((ry) => segment([a[0], ry, a[1]], [b[0], ry, b[1]], P)).join("");
const at = (p) => iso(p, P);
${spokes.toString()}
const cwAt = ${cwAt.toString()};
const carRope = ${carRope.toString()};
const cwRope = ${cwRope.toString()};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const carEl = part("car"), cwEl = part("cw"), carRopeEl = part("car-rope"), cwRopeEl = part("cw-rope"), spokesEl = part("spokes");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// state in metres: position of the car platform above the ground floor, and velocity
let pos = 0, vel = 0, target = 0, frame = 0, last = 0, visible = false, touring = true, idle = 0, dwell = 0, tourStep = 0;
const TOUR = [2, 1, 3, 0];
const STOP = FLOOR * M_PER;
function draw() {
  const z = pos / M_PER;
  carEl.setAttribute("transform", translateAlong(P, [0, 0, z]));
  cwEl.setAttribute("transform", translateAlong(P, [0, 0, cwAt(z)]));
  carRopeEl.setAttribute("d", carRope(z));
  cwRopeEl.setAttribute("d", cwRope(z));
  spokesEl.setAttribute("d", spokes(-pos / (TRACTION.r * M_PER)));
  const floor = pos / STOP;
  const near = Math.round(floor);
  const where = Math.abs(floor - near) < 0.01 && Math.abs(vel) < 0.01 ? "at floor " + (near + 1) : (vel > 0 ? "up" : "down") + " to " + (target + 1);
  const rpm = (Math.abs(vel) / (Math.PI * 2 * TRACTION.r * M_PER)) * 60;
  const text = where + " · " + pos.toFixed(2) + " m · " + Math.abs(vel).toFixed(2) + " m/s · sheave " + rpm.toFixed(0) + " rpm";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(near + 1));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (still.matches) { pos = target * STOP; vel = 0; draw(); frame = 0; return; }
  const goal = target * STOP;
  for (let i = 0; i < 4; i++) {
    const h = dt / 4;
    const left = goal - pos;
    // the fastest speed from which the car can still stop at the floor, capped at rated speed
    const want = Math.sign(left) * Math.min(V_MAX, Math.sqrt(2 * ACCEL * Math.abs(left) * 0.92));
    vel += clamp(want - vel, -ACCEL * h * 1.15, ACCEL * h * 1.15);
    pos += vel * h;
    if (Math.abs(goal - pos) < 0.002 && Math.abs(vel) < 0.03) { pos = goal; vel = 0; }
  }
  draw();
  const resting = pos === goal && vel === 0;
  if (touring && resting) {
    dwell += dt;
    if (dwell > 2.2) { dwell = 0; tourStep = (tourStep + 1) % TOUR.length; target = TOUR[tourStep]; }
  }
  frame = visible && (!resting || touring) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const call = (floor) => {
  touring = false;
  target = clamp(floor, 0, FLOORS - 1);
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; dwell = 0; run(); }, 6000);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = 1 - clamp(((event.clientY - box.top) / box.height - 0.22) / 0.62, 0, 1);
  const floor = Math.round(share * (FLOORS - 1));
  if (floor !== target || touring) call(floor);
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowUp" || event.key === "ArrowRight") to = target + 1;
  if (event.key === "ArrowDown" || event.key === "ArrowLeft") to = target - 1;
  if (/^[1-4]$/.test(event.key)) to = Number(event.key) - 1;
  if (to === null) return;
  event.preventDefault();
  call(to);
});
target = TOUR[0];
draw();
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Traction lift",
  hint: "Hover up or down to call a floor",
  readout: "at floor 1 · 0.00 m · 0.00 m/s · sheave 0 rpm",
  keys: [
    { mark: "lit", label: "Car: 900 kg, rated load 630 kg" },
    { mark: "raised", label: `Counterweight: ${Math.round(CW_KG)} kg, car plus 45% of the load` },
    { mark: "edge", label: "Four ropes over a 0.72 m traction sheave" },
  ],
  caption:
    "The ropes are not wound up; they only lie in the sheave's grooves, and friction lets the turning sheave drag them along. Because the counterweight balances the car plus about half a load, the motor only lifts the difference. Every metre the car rises the counterweight falls one metre. Stops are 3.2 m apart; the car runs at up to 1.6 m/s and speeds up and slows down at 0.8 m/s², so one floor takes about 4 s.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Traction lift: arrow keys or 1 to 4 call a floor" aria-valuemin="1" aria-valuemax="4" aria-valuenow="1">${svg}</div>`,
});

const out = theme === "light" ? "traction-lift-light.html" : "traction-lift.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Traction lift", theme, body, script: kitScript() + live }));
console.log("wrote", out);
