import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as ST from "./stack.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 440;

// 1 world unit = 4 cm. The parts of the traction lift in Fig 2, on one bench:
// the machine (motor, brake, Ø720 traction sheave, outboard bearing), the Ø520 deflector
// sheave in its brackets, and a length of 8-strand wire rope shown about 37× life size.
const BENCH = { x: -52, y: -76, w: 100, d: 118, r: 6 };
const BENCH_TOP = 0;

// ---- 01 the traction machine: one shaft along y ----
const M = { x: -30, z: 16 };
const BED = { x: M.x - 15, y: -50, w: 30, d: 82, r: 1.2 };
const BED_TOP = 3;
const MACHINE = {
  x: M.x, z: M.z,
  shaft: { sections: [[-39, -14, 1.8], [-31, -17, 6.2], [-14, 18, 1.8]], tone: "mid" },
  parts: [
    { id: "fan", name: "팬 커버", y0: -40, y1: -35.5, out: -26, bore: 99 },
    { id: "stator", name: "모터 하우징 (고정자)", y0: -35.5, y1: -15, out: -18, bore: 99 },
    { id: "shield", name: "엔드 실드", y0: -15, y1: -12.4, out: -10, bore: 99 },
    { id: "drum", name: "브레이크 드럼", y0: -11.4, y1: -5, out: -4, bore: 99 },
    { id: "sheave", name: "권상 시브 Ø720 · 홈 4줄", y0: -3.5, y1: 6.5, out: 0, bore: 99 },
    { id: "bearing", name: "외측 베어링", y0: 9, y1: 15, out: 12, bore: 99 },
    { id: "cap", name: "축 끝 캡", y0: 17, y1: 18.6, out: 19, bore: 99 },
  ],
};
const ROTOR_NAME = "회전자 · 주축";

// ---- 02 the deflector sheave: an axle pin through two brackets, two spacers and the sheave ----
const DF = { x: 26, z: 13 };
const DEFLECTOR = {
  x: DF.x, z: DF.z,
  shaft: { sections: [[-48.4, -32.6, 1.3]], out: 22, tone: "hi" },
  parts: [
    { id: "plateB", name: "뒤 브래킷", y0: -47, y1: -45.2, out: -10, bore: 99 },
    { id: "spacerB", name: "스페이서", y0: -45.2, y1: -43.4, out: -5, bore: 99 },
    { id: "dsheave", name: "디플렉터 시브 Ø520", y0: -43.4, y1: -36.2, out: 0, bore: 99 },
    { id: "spacerF", name: "스페이서", y0: -36.2, y1: -34.4, out: 5, bore: 99 },
    { id: "plateF", name: "앞 브래킷", y0: -34.4, y1: -32.6, out: 10, bore: 99 },
  ],
};
const PIN_NAME = "축 핀 · 너트";
const DF_BASE = { x: DF.x - 10, y: -60, w: 20, d: 40, r: 1 };
const DF_BASE_TOP = 2.4;

// ---- 03 wire rope 8 × 19 with a fibre core, standing on end ----
const ROPE = { x: 22, y: 26, z0: 2.4, h: 26, core: 1.7, strand: 1.45, lay: 3.15, out: 5.2 };
const ROPE_BASE_R = 12;

const P = k.fitProjection(
  [...k.boxCorners(BENCH, -14, 0), [M.x, -70, M.z + 11], [M.x, 40, M.z + 11], [DF.x, -60, DF.z + 9], [ROPE.x, ROPE.y, ROPE.z0 + ROPE.h + 2]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 40, elevation: 30 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y], z = 0) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));
const AX = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const box = (x0, y0, x1, y1, z, h, tone = "mid", bevel = 0) => S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.3 }, z, h, P, 2, bevel), { tone, crease: "lo" });

// ---- the bench ----
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -14, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BENCH, 12))) {
    out.push(S(k.cylinder(x, y, 6, -14, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -12.6, 2.6, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BENCH, -10, 10, P, 6, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 4), 0, P), { tone: "lo" }));
  const screws = k.corners(BENCH, 7);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  // a ruler strip along the near +y edge
  const strip = { x: BENCH.x + 12, y: BENCH.y + BENCH.d - 9, w: 46, d: 4.4, r: 0.6 };
  out.push(S(k.slabOf(strip, 0, 0.5, P, 2), { tone: "lo", crease: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2.5, 4, strip.y + 0.1, 0.5, [1.4, 4.3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

// ---- 01 machine parts, each built at rest, moved along y by its group transform ----
function bedplate() {
  const out = [S(k.slabOf(BED, BENCH_TOP, BED_TOP, P, 3, 0.6), { tone: "mid", crease: "lo" })];
  out.push(L(k.planOutline(k.insetPlan(BED, 2.4), BED_TOP, P, 3), { tone: "faint" }));
  out.push(D(k.corners(BED, 3.2).map(([x, y]) => at([x, y, BED_TOP])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
const F = (y) => AX(M.x, y, M.z);
const part = {
  fan(lit) {
    const f = F(-40);
    const body = G.solidOf([[0, 7.2], [1.2, 8.6, 1], [2.8, 9.4, 1], [4.5, 9.6]], f, P);
    return S(body, { tone: "mid", lit, inner: L(G.circleOf(f, 0, 4.2, P) + G.circleOf(f, 0, 2.4, P), { tone: "faint" }) });
  },
  stator(lit) {
    const out = [];
    const f = F(-35.5);
    out.push(box(M.x - 8, -34, M.x - 4.6, -16.5, BED_TOP, M.z - 7.6 - BED_TOP, "mid"));
    out.push(box(M.x + 4.6, -34, M.x + 8, -16.5, BED_TOP, M.z - 7.6 - BED_TOP, "mid"));
    out.push(S(G.solidOf([[0, 9.6], [20.5, 9.6]], f, P), { tone: "mid", lit, inner: k.fadedSvg(G.ribsOf(f, 0.8, 19.7, 9.6, 36, P, { fade: [0.04, 0.4], seams: true }), { tone: "lo" }) }));
    // terminal box on top
    out.push(box(M.x - 3.4, -29, M.x + 3.4, -21, M.z + 9.2, 3.6, "mid", 0.3));
    out.push(D([at([M.x - 2.2, -27.6, M.z + 12.8]), at([M.x + 2.2, -22.4, M.z + 12.8])], { size: 0.4, tone: "lo" }));
    return out.join("");
  },
  shield(lit) {
    const f = F(-15);
    return S(G.solidOf([[0, 9.6], [1.2, 9.6], [1.2, 7], [2.6, 5]], f, P), { tone: "mid", lit })
      + D(G.dotsOf(f, 1.2, 8.3, 8, P, { fade: [0.04, 0.42] }), { size: 0.45, tone: "lo" });
  },
  drum(lit) {
    const f = F(-11.4);
    return S(G.solidOf([[0, 7.2], [6.4, 7.2]], f, P), { tone: "hi", lit, inner: L(G.arcOf(f, 1, 7.2, P) + G.arcOf(f, 5.4, 7.2, P), { tone: "faint" }) })
      + S(G.disc(6.4, 6.4 + 0.01, 3.2, f, P), { tone: "mid", lit });
  },
  sheave(lit) {
    const f = F(-3.5);
    const grooves = [1.6, 3.8, 6.2, 8.4].map((s) => G.arcOf(f, s, 9, P)).join("");
    const out = [S(G.solidOf([[0, 8.4], [0.6, 9], [9.4, 9], [10, 8.4]], f, P), { tone: "hi", lit, inner: L(grooves, { tone: "lo" }) })];
    out.push(L(G.spokesOf(f, 10, 3.4, 7.2, 6, P), { tone: "faint" }));
    out.push(L(G.circleOf(f, 10, 7.4, P) + G.circleOf(f, 10, 3.2, P), { tone: "faint" }));
    return out.join("");
  },
  bearing(lit) {
    const out = [box(M.x - 5.6, 9.4, M.x + 5.6, 14.6, BED_TOP, M.z - BED_TOP - 2, "mid")];
    out.push(D([at([M.x - 3.8, 12, M.z - 2]), at([M.x + 3.8, 12, M.z - 2])], { size: 0.45, tone: "lo" }));
    const f = F(9);
    out.push(S(G.solidOf([[0, 4.2], [6, 4.2]], f, P), { tone: "mid", lit, inner: L(G.arcOf(f, 3, 4.2, P), { tone: "faint" }) }));
    out.push(D(G.dotsOf(f, 6, 3.2, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.4, tone: "lo" }));
    return out.join("");
  },
  cap(lit) {
    const f = F(17);
    return S(G.solidOf([[0, 2.6], [1.6, 2.6]], f, P), { tone: "mid", lit }) + L(G.circleOf(f, 1.6, 1.3, P), { tone: "lo" });
  },
};
// brake: a shoe on an arm either side of the drum; the arms open outward in x
function brakeArm(side, lit) {
  const x = M.x + side * 7.9;
  const out = [];
  out.push(box(x - 0.9, -10.6, x + 0.9, -5.8, BED_TOP, M.z + 5 - BED_TOP, "mid"));
  out.push(box(side < 0 ? x : x - 0.6, -10.4, side < 0 ? x + 0.6 : x, -6, M.z - 4, 8, "lo"));
  out.push(box(x - 1.2, -11, x + 1.2, -5.4, BED_TOP, 1.4, "lo"));
  out.push(S(k.cylinder(x, -8.2, 0.9, M.z + 5, 1.2, P, 14), { tone: "mid", crease: "none", lit }));
  return out.join("");
}

// ---- 02 deflector parts ----
const DFF = (y) => AX(DF.x, y, DF.z);
function plate(y0, y1, lit) {
  const f = AX(DF.x, y0, DF.z);
  const poly = [[-7.5, -DF.z + DF_BASE_TOP], [7.5, -DF.z + DF_BASE_TOP], [7.5, 2], [5.2, 6.4], [0, 8.4], [-5.2, 6.4], [-7.5, 2]];
  const out = [S(G.prismOf(f, poly, 0, y1 - y0, P), { tone: "mid", lit })];
  out.push(L(G.circleOf(f, y1 - y0, 2.4, P), { tone: "lo" }));
  out.push(D([[-5.2, -DF.z + 4.6], [5.2, -DF.z + 4.6]].map(([u, v]) => at([DF.x + u, y1, DF.z + v])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
const dpart = {
  plateB: (lit) => plate(-47, -45.2, lit),
  spacerB: (lit) => S(G.solidOf([[0, 2.6], [1.8, 2.6]], DFF(-45.2), P), { tone: "mid", lit }),
  dsheave(lit) {
    const f = DFF(-43.4);
    const grooves = [1.4, 2.8, 4.4, 5.8].map((s) => G.arcOf(f, s, 6.5, P)).join("");
    return S(G.solidOf([[0, 6], [0.5, 6.5], [6.7, 6.5], [7.2, 6]], f, P), { tone: "hi", lit, inner: L(grooves, { tone: "lo" }) })
      + L(G.circleOf(f, 7.2, 4.8, P) + G.circleOf(f, 7.2, 2.6, P), { tone: "faint" })
      + L(G.spokesOf(f, 7.2, 2.8, 4.6, 5, P), { tone: "faint" });
  },
  spacerF: (lit) => S(G.solidOf([[0, 2.6], [1.8, 2.6]], DFF(-36.2), P), { tone: "mid", lit }),
  plateF: (lit) => plate(-34.4, -32.6, lit),
};
// the pin's head and nut ride with the pin: head at the front end, nut at the back
function pinEnds(lit) {
  const fh = DFF(-32.6);
  const fn = DFF(-48.4);
  return {
    back: S(G.prismOf(fn, Array.from({ length: 6 }, (_, i) => [2.2 * Math.cos((i * Math.PI) / 3 + 0.5), 2.2 * Math.sin((i * Math.PI) / 3 + 0.5)]), -1.6, 0, P), { tone: "mid", lit }),
    front: S(G.solidOf([[0, 2.4], [1.4, 2.4], [1.8, 2]], fh, P), { tone: "mid", lit }),
  };
}

// ---- 03 wire rope ----
const STRANDS = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + Math.PI / 8);
function strandSvg(angle, lit) {
  const cx = ROPE.x + ROPE.lay * Math.cos(angle), cy = ROPE.y + ROPE.lay * Math.sin(angle);
  const f = G.frameOf([cx, cy, ROPE.z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const top = ROPE.z0 + ROPE.h;
  const out = [S(k.cylinder(cx, cy, ROPE.strand, ROPE.z0, ROPE.h, P, 28), { tone: "hi", crease: "lo", lit, inner: k.fadedSvg(G.ribsOf(f, 0.6, ROPE.h - 0.6, ROPE.strand, 10, P, { twist: 1.6, fade: [0.04, 0.5], seams: true }), { tone: "lo" }) })];
  // 19 wires: 1 + 6 + 12, seen end on
  const wires = [[0, 0]];
  for (let i = 0; i < 6; i++) wires.push([0.55 * Math.cos((i * Math.PI) / 3), 0.55 * Math.sin((i * Math.PI) / 3)]);
  for (let i = 0; i < 12; i++) wires.push([1.08 * Math.cos((i * Math.PI) / 6 + 0.26), 1.08 * Math.sin((i * Math.PI) / 6 + 0.26)]);
  out.push(D(wires.map(([u, v]) => at([cx + u, cy + v, top])), { size: 0.42, tone: "lo" }));
  return out.join("");
}
function ropeCore(lit) {
  const top = ROPE.z0 + ROPE.h;
  return S(k.cylinder(ROPE.x, ROPE.y, ROPE.core, ROPE.z0, ROPE.h, P, 28), { tone: "lo", crease: "lo", lit, inner: L([4, 8, 12, 16, 20, 24].map((z) => k.sideArc(ROPE.x, ROPE.y, ROPE.core, ROPE.z0 + z, P, 20)).join(""), { tone: "faint" }) })
    + D([[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]].map(([u, v]) => at([ROPE.x + u, ROPE.y + v, top])), { size: 0.4, tone: "mid" });
}
function ropeBase() {
  const out = [S(k.cylinder(ROPE.x, ROPE.y, ROPE_BASE_R, 0, ROPE.z0, P, 64, 0.6), { tone: "mid", crease: "lo" })];
  out.push(L(k.ring(ROPE.x, ROPE.y, ROPE_BASE_R - 2, ROPE.z0, P, 64), { tone: "faint" }));
  const ticks = k.radialTicks(ROPE.x, ROPE.y, ROPE_BASE_R - 0.4, 32, 4, ROPE.z0, [0.8, 1.5], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

// ---- assembling the drawing ----
const g = (attrs, inner) => `<g ${Object.entries(attrs).map(([a, b]) => `${a}="${b}"`).join(" ")}>${inner}</g>`;
const kitNode = { iso: k.iso, pathOf: k.pathOf, cameraOf: k.cameraOf };
function stackSvg(name, stack, build, extras = {}) {
  const slots = ST.shaftSlots(stack, 0);
  const out = [g({ "data-slot": `${name}:gap:-1` }, ST.slotSvg(kitNode, stack, slots["gap:-1"], P))];
  stack.parts.forEach((p, i) => {
    out.push(g({ "data-slot": `${name}:in:${i}` }, ST.slotSvg(kitNode, stack, slots["in:" + i], P)));
    if (extras.before?.[p.id]) out.push(extras.before[p.id]);
    out.push(g({ "data-move": `${name}:${i}`, "data-asm": name }, build[p.id](false)));
    if (extras.after?.[p.id]) out.push(extras.after[p.id]);
    out.push(g({ "data-slot": `${name}:gap:${i}` }, ST.slotSvg(kitNode, stack, slots["gap:" + i], P)));
  });
  return out.join("");
}

const nearSide = depth([1, 0]) > 0 ? 1 : -1; // the brake arm on +x faces the viewer
const pins = pinEnds(false);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Three parts of a traction lift on a bench, each able to come apart along its real disassembly direction. The traction machine: fan cover, motor housing with its rotor and shaft, end shield, brake drum with two brake arms, the grooved traction sheave, an outboard bearing and an end cap. The deflector sheave: two brackets, two spacers, the sheave and an axle pin. And a length of wire rope: eight strands of nineteen wires each laid around a fibre core.",
  body: [
    bench(),
    g({ "data-asm": "rope", "data-fixed": "" }, ropeBase()),
    // 02 sits furthest back on the right, 01 on the left, 03 in front
    g({ "data-asm": "deflector", "data-fixed": "" }, S(k.slabOf(DF_BASE, 0, DF_BASE_TOP, P, 2, 0.4), { tone: "mid", crease: "lo" }) + L(k.planOutline(k.insetPlan(DF_BASE, 1.6), DF_BASE_TOP, P, 2), { tone: "faint" })),
    g({ "data-pin": "back", "data-asm": "deflector" }, pins.back),
    stackSvg("deflector", DEFLECTOR, dpart),
    g({ "data-pin": "front", "data-asm": "deflector" }, pins.front),
    g({ "data-asm": "machine", "data-fixed": "" }, bedplate()),
    stackSvg("machine", MACHINE, part, {
      before: { drum: g({ "data-brake": String(-nearSide), "data-asm": "machine" }, brakeArm(-nearSide, false)) },
      after: { drum: g({ "data-brake": String(nearSide), "data-asm": "machine" }, brakeArm(nearSide, false)) },
    }),
    ...rope(),
  ],
});

function rope() {
  const view = k.towardViewer(P);
  const facing = (a) => Math.cos(a) * view[0] + Math.sin(a) * view[1];
  const order = STRANDS.map((a, i) => [a, i]).sort((p, q) => facing(p[0]) - facing(q[0]));
  const back = order.filter(([a]) => facing(a) < 0), front = order.filter(([a]) => facing(a) >= 0);
  const strand = ([a, i]) => g({ "data-strand": String(i), "data-asm": "rope" }, strandSvg(a, false));
  return [...back.map(strand), g({ "data-asm": "rope", "data-core": "" }, ropeCore(false)), ...front.map(strand)];
}

const ASM = {
  machine: {
    no: "01", title: "권상기",
    parts: [...MACHINE.parts.slice(0, 3).map((p) => p.name), ROTOR_NAME, MACHINE.parts[3].name + " · 브레이크 암 2개", ...MACHINE.parts.slice(4).map((p) => p.name)],
    note: "모터가 주축을 돌리고, 주축에 끼운 권상 시브가 홈에 걸린 로프를 마찰로 끕니다. 정지할 때는 스프링이 브레이크 슈를 드럼에 눌러 잡습니다.",
  },
  deflector: {
    no: "02", title: "디플렉터(세컨) 시브",
    parts: DEFLECTOR.parts.map((p) => p.name).concat(PIN_NAME),
    note: "동력은 없습니다. 로프를 균형추 쪽으로 벌려 주고, 권상 시브에 로프가 감기는 각도(감김각)를 키웁니다.",
  },
  rope: {
    no: "03", title: "와이어 로프 8×19",
    parts: ["섬유 심 (가운데)", "스트랜드 8가닥", "스트랜드마다 소선 19가닥 (1+6+12)"],
    note: "Ø10 mm 로프를 약 37배로 키운 모형입니다. 소선이 꼬여 스트랜드가 되고, 스트랜드가 섬유 심을 감아 로프가 됩니다.",
  },
};

// screen centres of the three assemblies, for hover picking
const CENTRES = {
  machine: at([M.x, -12, M.z]),
  deflector: at([DF.x, -40, DF.z]),
  rope: at([ROPE.x, ROPE.y, ROPE.z0 + ROPE.h / 2]),
};

const script = `
${readFileSync(join(HERE, "stack.mjs"), "utf8").replace(/^export /gm, "")}
const kitNode = { iso, pathOf, cameraOf };
const P = ${JSON.stringify(P)};
const STACKS = { machine: ${JSON.stringify(MACHINE)}, deflector: ${JSON.stringify(DEFLECTOR)} };
const ASM = ${JSON.stringify(ASM)};
const CENTRES = ${JSON.stringify(CENTRES)};
const NUT_OUT = -15, STRANDS = ${JSON.stringify(STRANDS)}, ROPE_OUT = ${ROPE.out}, BRAKE_OUT = 5;
const ORDER = ["machine", "deflector", "rope"];
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const listEl = document.querySelector("[data-list]");
const noteEl = document.querySelector("[data-note]");
const buttons = [...document.querySelectorAll("[data-pick]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const share = { machine: 0, deflector: 0, rope: 0 };
let picked = null, frame = 0, last = 0, visible = false, touring = true, idle = 0, clock = 0;
const moves = {}, slots = {};
for (const el of svg.querySelectorAll("[data-move]")) moves[el.dataset.move] = el;
for (const el of svg.querySelectorAll("[data-slot]")) slots[el.dataset.slot] = el;
const lastSlots = {};
function drawStack(name, e) {
  const stack = STACKS[name];
  stack.parts.forEach((p, i) => moves[name + ":" + i].setAttribute("transform", translateAlong(P, [0, p.out * e, 0])));
  const pieces = shaftSlots(stack, e);
  for (const key of Object.keys(slots)) {
    if (!key.startsWith(name + ":")) continue;
    const list = pieces[key.slice(name.length + 1)] || [];
    const sig = list.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(";");
    if (lastSlots[key] === sig) continue;
    lastSlots[key] = sig;
    slots[key].innerHTML = slotSvg(kitNode, stack, list, P);
  }
}
const pinEls = [...svg.querySelectorAll("[data-pin]")];
const brakeEls = [...svg.querySelectorAll("[data-brake]")];
const strandEls = [...svg.querySelectorAll("[data-strand]")];
function draw() {
  drawStack("machine", share.machine);
  drawStack("deflector", share.deflector);
  const pinShift = translateAlong(P, [0, STACKS.deflector.shaft.out * share.deflector, 0]);
  pinEls.forEach((el) => el.setAttribute("transform", el.dataset.pin === "front" ? pinShift : translateAlong(P, [0, NUT_OUT * share.deflector, 0])));
  brakeEls.forEach((el) => el.setAttribute("transform", translateAlong(P, [Number(el.dataset.brake) * BRAKE_OUT * share.machine, STACKS.machine.parts[3].out * share.machine, 0])));
  strandEls.forEach((el) => { const a = STRANDS[Number(el.dataset.strand)]; el.setAttribute("transform", translateAlong(P, [Math.cos(a) * ROPE_OUT * share.rope, Math.sin(a) * ROPE_OUT * share.rope, 0])); });
  const name = picked || ORDER.reduce((best, n) => (share[n] > share[best] ? n : best), "machine");
  const text = picked ? ASM[picked].no + " " + ASM[picked].title + " · 분해 " + Math.round(share[picked] * 100 + 0.4) + "%" : "조립 상태 · 부품을 고르세요";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
  void name;
}
function show(name) {
  for (const el of svg.querySelectorAll(".iso-solid[data-lit]")) el.removeAttribute("data-lit");
  buttons.forEach((b) => (b.dataset.pick === name ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
  if (name) for (const el of svg.querySelectorAll('[data-asm="' + name + '"] .iso-solid')) el.setAttribute("data-lit", "");
  const a = name ? ASM[name] : null;
  listEl.innerHTML = a ? a.parts.map((p, i) => "<li><span>" + String(i + 1).padStart(2, "0") + "</span>" + p + "</li>").join("") : "";
  noteEl.textContent = a ? a.note : "";
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    clock += dt;
    const next = ORDER[Math.floor(clock / 4.5) % ORDER.length];
    if (next !== picked) { picked = next; show(picked); }
  }
  let moving = false;
  for (const n of ORDER) {
    const goal = n === picked ? 1 : 0;
    share[n] = still.matches ? goal : share[n] + (goal - share[n]) * (1 - Math.exp(-dt / 0.32));
    if (Math.abs(goal - share[n]) < 0.002) share[n] = goal; else moving = true;
  }
  draw();
  frame = visible && (moving || touring) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function pick(name) {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 7000);
  if (name !== picked) { picked = name; show(name); }
  run();
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const x = ((event.clientX - box.left) / box.width) * vb.width + vb.x, y = ((event.clientY - box.top) / box.height) * vb.height + vb.y;
  const near = ORDER.reduce((best, n) => (Math.hypot(CENTRES[n][0] - x, CENTRES[n][1] - y) < Math.hypot(CENTRES[best][0] - x, CENTRES[best][1] - y) ? n : best), ORDER[0]);
  pick(near);
});
buttons.forEach((b) => { b.addEventListener("click", () => pick(b.dataset.pick)); b.addEventListener("pointerenter", () => pick(b.dataset.pick)); });
stage.addEventListener("keydown", (event) => {
  if (/^[1-3]$/.test(event.key)) { event.preventDefault(); pick(ORDER[Number(event.key) - 1]); }
  if (event.key === "Escape") { event.preventDefault(); pick(null); }
});
draw();
`;

const pickers = `<div class="lp-picks">${Object.entries(ASM).map(([id, a]) => `<button type="button" class="lp-pick" data-pick="${id}"><span>${a.no}</span>${a.title}</button>`).join("")}</div><ol class="lp-list" data-list></ol><p class="lp-note" data-note></p>`;
const css = `<style>
.lp-picks{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 8px}
.lp-pick{display:inline-flex;align-items:baseline;gap:7px;padding:5px 11px;border:0;border-radius:999px;background:transparent;color:var(--anatomy-muted, inherit);font:inherit;font-size:13px;cursor:pointer;box-shadow:inset 0 0 0 1px color-mix(in srgb, currentColor 18%, transparent)}
.lp-pick span{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;opacity:.6}
.lp-pick:hover,.lp-pick:focus-visible,.lp-pick[data-on]{color:var(--anatomy-text);background:color-mix(in srgb, currentColor 7%, transparent)}
.lp-list{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:2px 16px;font-size:13px;min-height:1.6em}
.lp-list span{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;opacity:.55;margin-right:6px}
.lp-note{margin:6px 0 0;font-size:13px;opacity:.8;min-height:1.6em}
</style>`;

const body = css + k.plateHtml({
  fig: "Fig 3",
  title: "승강기 부품 분해도",
  hint: "부품에 마우스를 올리면 분해",
  readout: "조립 상태 · 부품을 고르세요",
  caption:
    "Fig 2 승강기의 핵심 부품 세 가지를 작업대에 올려 두었습니다. 각 부품은 실제로 분해하는 방향으로 벌어집니다: 권상기와 디플렉터 시브는 축을 따라, 브레이크 암은 드럼에서 바깥으로, 로프의 스트랜드는 심에서 바깥으로. 모형 1 단위 = 4 cm (로프만 약 37배 확대). 키보드: 1·2·3으로 선택, Esc로 다시 조립.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Lift parts: press 1, 2 or 3 to take a part apart, Escape to put it back">${svg}</div>`,
}).replace("</figure>", `${pickers}</figure>`);

const out = theme === "light" ? "lift-parts-light.html" : "lift-parts.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Lift parts", theme, body, script: kitScript() + script }).replace('<html lang="en">', '<html lang="ko">'));
console.log("wrote", out);
