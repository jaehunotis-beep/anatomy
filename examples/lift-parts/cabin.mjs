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
const HEIGHT = 480;

// 1 world unit = 8 cm, the scale of Fig 2. On one bench: the car in its sling with the
// safety gear, the counterweight with its filler weights, and the overspeed governor
// (drawn twice life size: its Ø300 sheave would be under 4 units across).
const BENCH = { x: -42, y: -42, w: 86, d: 80, r: 5 };

// ---- 04 the car ----
const C = { x: -14, y: -8 };
const CAB = { x: C.x - 12, y: C.y - 12, w: 24, d: 24, r: 0.8 };
const STILE_IN = 13.2, STILE_OUT = 14.6;
const CAR_TOP = 38;

// ---- 06 the counterweight ----
const W = { x: 24, y: -18 };
const WEIGHTS = 8;
const PLATE_H = 3;
const CW_FRAME_H = 2 + WEIGHTS * PLATE_H + 2;

// ---- 05 the overspeed governor, 2× ----
const GV = { x: 16, z: 8 };
const GV_BASE = { x: GV.x - 6, y: 12, w: 12, d: 12, r: 0.8 };
const GV_BASE_TOP = 1.6;
const GOVERNOR = {
  x: GV.x, z: GV.z,
  shaft: { sections: [[13, 26.4, 0.6]], tone: "mid" },
  parts: [
    { id: "bracket", name: "브래킷", y0: 13.4, y1: 14.8, out: 0, bore: 99 },
    { id: "boss", name: "베어링", y0: 14.8, y1: 16.2, out: 3, bore: 99 },
    { id: "gsheave", name: "조속기 시브 Ø300 · 홈 1줄", y0: 16.2, y1: 19.2, out: 7, bore: 99 },
    { id: "fly", name: "플라이웨이트 2개 · 스프링", y0: 19.2, y1: 20.2, out: 11, bore: 99 },
    { id: "gcap", name: "축 끝 캡", y0: 26.4, y1: 27.2, out: 14, bore: 99 },
  ],
};

const P = k.fitProjection(
  [...k.boxCorners(BENCH, -14, 0), [C.x, C.y, CAR_TOP + 36], [C.x - 12, C.y + 22, 0], [W.x, W.y, CW_FRAME_H + 26], [GV.x, 42, GV.z + 4]],
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
const box = (x0, y0, x1, y1, z, h, tone = "mid", bevel = 0) => S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.3 }, z, h, P, 2, bevel), { tone, crease: "lo" });
const g = (attrs, inner) => `<g ${Object.entries(attrs).map(([a, b]) => `${a}="${b}"`).join(" ")}>${inner}</g>`;
const kitNode = { iso: k.iso, pathOf: k.pathOf, cameraOf: k.cameraOf };

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -14, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BENCH, 11))) {
    out.push(S(k.cylinder(x, y, 5.4, -14, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.2, -12.6, 2.6, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BENCH, -10, 10, P, 6, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 3.6), 0, P), { tone: "lo" }));
  const screws = k.corners(BENCH, 6.5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.6, 0, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  const strip = { x: BENCH.x + 10, y: BENCH.y + BENCH.d - 8, w: 34, d: 4, r: 0.5 };
  out.push(S(k.slabOf(strip, 0, 0.5, P, 2), { tone: "lo", crease: "lo" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.1, 0.5, [1.3, 3.9], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

// ---- 04 car parts, each drawn at rest; `out` is its explode vector ----
function stile(side) {
  const y0 = side < 0 ? C.y - STILE_OUT : C.y + STILE_IN;
  const y1 = y0 + (STILE_OUT - STILE_IN);
  const out = [box(C.x - 1.4, y0, C.x + 1.4, y1, 0, CAR_TOP, "mid")];
  out.push(D([4, 12, 20, 28, 34].map((z) => at([C.x + 1.4, (y0 + y1) / 2, z])), { size: 0.4, tone: "lo" }));
  // guide shoes on the outer face, top and bottom
  const yo = side < 0 ? y0 - 1.4 : y1;
  for (const z of [7, CAR_TOP - 4]) out.push(box(C.x - 1.8, yo, C.x + 1.8, yo + 1.4, z, 3, "lo"));
  return out.join("");
}
function safetyGear(side) {
  const y0 = side < 0 ? C.y - STILE_OUT - 3 : C.y + STILE_OUT;
  const y1 = y0 + 3;
  const out = [box(C.x - 3, y0, C.x + 3, y1, 0.4, 6, "hi", 0.3)];
  // the rail slot on the outer face, and the two wedges that climb it to grip the rail
  const face = side < 0 ? y0 : y1;
  if (side > 0) {
    out.push(L(k.pathOf([at([C.x - 0.9, face, 0.4]), at([C.x - 0.9, face, 6.4])]) + k.pathOf([at([C.x + 0.9, face, 0.4]), at([C.x + 0.9, face, 6.4])]), { tone: "lo" }));
    out.push(L(k.pathOf([at([C.x - 0.9, face, 2.2]), at([C.x - 2.6, face, 6.4])]) + k.pathOf([at([C.x + 0.9, face, 2.2]), at([C.x + 2.6, face, 6.4])]), { tone: "mid" }));
  }
  out.push(D([[C.x - 2.2, 1.6], [C.x + 2.2, 1.6], [C.x - 2.2, 5.2], [C.x + 2.2, 5.2]].map(([x, z]) => at([x + (side < 0 ? 0 : 0), face, z])).filter(() => side > 0), { size: 0.4, tone: "lo" }));
  return out.join("");
}
const carPart = {
  plank: () => box(C.x - 3, C.y - STILE_IN, C.x + 3, C.y + STILE_IN, 0, 3, "mid", 0.3) + D([at([C.x, C.y - 9, 3]), at([C.x, C.y + 9, 3])], { size: 0.45, tone: "lo" }),
  platform() {
    const plan = { x: CAB.x - 0.6, y: CAB.y - 0.6, w: CAB.w + 1.2, d: CAB.d + 1.2, r: 0.6 };
    return S(k.slabOf(plan, 3, 2, P, 2, 0.3), { tone: "mid", crease: "lo", inner: L(k.sideSeam(plan, 4, P, 2), { tone: "faint" }) })
      + S(k.slabOf({ x: CAB.x + CAB.w, y: C.y - 7, w: 1.6, d: 14, r: 0.2 }, 3, 2, P, 2), { tone: "lo", crease: "lo" });
  },
  cab() {
    const fx = CAB.x + CAB.w;
    const door = [
      k.segment([fx, C.y - 6, 5], [fx, C.y - 6, 27], P),
      k.segment([fx, C.y + 6, 5], [fx, C.y + 6, 27], P),
      k.segment([fx, C.y - 6, 27], [fx, C.y + 6, 27], P),
      k.segment([fx, C.y, 5], [fx, C.y, 27], P),
      k.sideSeam(CAB, 29, P, 2),
    ].join("");
    const vents = [0, 1, 2, 3, 4].map((i) => k.pathOf([[-0.4, 30], [0.4, 30], [0.4, 32], [-0.4, 32]].map(([dx, z]) => at([CAB.x + 6 + i * 3 + dx, CAB.y + CAB.d, z])), true)).join("");
    return S(k.slabOf(CAB, 5, 28, P, 2, 0.5), { tone: "hi", crease: "lo", inner: L(door, { tone: "lo" }) + L(vents, { tone: "faint" }) })
      + S(k.slabOf({ x: fx, y: C.y + 7.6, w: 0.5, d: 2.6, r: 0.2 }, 12, 7, P, 2), { tone: "mid", crease: "none" })
      + D([17.4, 15.8, 14.2, 12.6].map((z) => at([fx + 0.5, C.y + 8.9, z + 0.4])), { size: 0.4, tone: "lo" });
  },
  roof() {
    const plan = { x: CAB.x - 0.4, y: CAB.y - 0.4, w: CAB.w + 0.8, d: CAB.d + 0.8, r: 0.6 };
    return S(k.slabOf(plan, 33, 1.4, P, 2, 0.3), { tone: "mid", crease: "lo" })
      + S(k.cylinder(C.x - 6, C.y - 4, 3.2, 34.4, 1.6, P, 28), { tone: "mid" })
      + L(k.ring(C.x - 6, C.y - 4, 2.2, 36, P, 24), { tone: "faint" })
      + box(C.x + 4, C.y + 3, C.x + 9, C.y + 8, 34.4, 2.2, "mid", 0.3);
  },
  crosshead: () => box(C.x - 2, C.y - STILE_IN, C.x + 2, C.y + STILE_IN, 35, 3, "mid", 0.3)
    + box(C.x - 2.4, C.y - 3.4, C.x + 2.4, C.y + 3.4, 38, 1.6, "mid")
    + D([-2.25, -0.75, 0.75, 2.25].map((ry) => at([C.x, C.y + ry, 39.6])), { size: 0.55, tone: "hi" }),
};

// ---- 06 counterweight parts ----
function cwStile(side) {
  const y0 = side < 0 ? W.y - 12.4 : W.y + 11;
  const out = [box(W.x - 3.4, y0, W.x + 3.4, y0 + 1.4, 0, CW_FRAME_H, "mid")];
  const yo = side < 0 ? y0 - 1.2 : y0 + 1.4;
  for (const z of [1, CW_FRAME_H - 4]) out.push(box(W.x - 1.2, yo, W.x + 1.2, yo + 1.2, z, 3, "lo"));
  return out.join("");
}
const cwBeam = (z, top) => box(W.x - 3.4, W.y - 11, W.x + 3.4, W.y + 11, z, 2, "mid", 0.3)
  + (top ? box(W.x - 1.6, W.y - 3, W.x + 1.6, W.y + 3, z + 2, 1.4, "mid") + D([-2.25, -0.75, 0.75, 2.25].map((ry) => at([W.x, W.y + ry, z + 3.4])), { size: 0.55, tone: "hi" }) : "");
const cwPlate = (i) => {
  const z = 2 + i * PLATE_H;
  return S(k.slabOf({ x: W.x - 3, y: W.y - 10.6, w: 6, d: 21.2, r: 0.4 }, z, PLATE_H - 0.2, P, 2, 0.3), { tone: "hi", crease: "lo" })
    + L(k.lineOnTop([W.x - 3, W.y - 5], [W.x + 3, W.y - 5], z + PLATE_H - 0.2, P) + k.lineOnTop([W.x - 3, W.y + 5], [W.x + 3, W.y + 5], z + PLATE_H - 0.2, P), { tone: "faint" });
};

// ---- 05 governor parts ----
const GF = (y) => G.frameOf([GV.x, y, GV.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const gpart = {
  bracket() {
    const poly = [[-5, -GV.z + GV_BASE_TOP], [5, -GV.z + GV_BASE_TOP], [5, 1.4], [3, 4.6], [-3, 4.6], [-5, 1.4]];
    const f = GF(13.4);
    return S(G.prismOf(f, poly, 0, 1.4, P), { tone: "mid" }) + L(G.circleOf(f, 1.4, 1.6, P), { tone: "lo" })
      + D([[-3.6, -GV.z + 3.4], [3.6, -GV.z + 3.4]].map(([u, v]) => at([GV.x + u, 14.8, GV.z + v])), { size: 0.45, tone: "lo" });
  },
  boss: () => S(G.solidOf([[0, 1.6], [1.4, 1.6]], GF(14.8), P), { tone: "mid" }),
  gsheave() {
    const f = GF(16.2);
    return S(G.solidOf([[0, 3.75], [1.1, 3.75], [1.5, 3.1], [1.9, 3.75], [3, 3.75]], f, P), { tone: "hi" })
      + L(G.circleOf(f, 3, 2.6, P) + G.circleOf(f, 3, 1.1, P), { tone: "faint" });
  },
  fly() {
    const f = GF(19.2);
    const out = [S(G.prismOf(f, G.stadium(1.2, 1.2, 2.6).map(([u, v]) => [v, u]), 0, 0.5, P), { tone: "mid" })];
    for (const side of [-1, 1]) {
      const kidney = [[side * 1.4, -2.6], [side * 3.2, -2.2], [side * 3.6, 0], [side * 3.2, 2.2], [side * 1.4, 2.6]];
      out.push(S(G.prismOf(f, side > 0 ? kidney : kidney.reverse(), 0.5, 1.0, P), { tone: "hi" }));
      out.push(D([at([GV.x + side * 1.8, 20.2, GV.z - 2])], { size: 0.45, tone: "lo" }));
    }
    out.push(L(k.pathOf([at([GV.x - 1.4, 20.2, GV.z + 1.6]), at([GV.x - 0.7, 20.2, GV.z + 2.2]), at([GV.x, 20.2, GV.z + 1.6]), at([GV.x + 0.7, 20.2, GV.z + 2.2]), at([GV.x + 1.4, 20.2, GV.z + 1.6])]), { tone: "mid" }));
    return out.join("");
  },
  gcap: () => S(G.solidOf([[0, 1], [0.8, 1]], GF(26.4), P), { tone: "mid" }),
};
const gswitch = () => box(GV.x - 2.4, 13.2, GV.x + 2.4, 15.2, GV.z + 4.6, 3.2, "mid", 0.3) + D([at([GV.x - 1.2, 15.2, GV.z + 6.2]), at([GV.x + 1.2, 15.2, GV.z + 6.2])], { size: 0.45, tone: "lo" });

function stackSvg(name, stack, build) {
  const slots = ST.shaftSlots(stack, 0);
  const out = [g({ "data-slot": `${name}:gap:-1` }, ST.slotSvg(kitNode, stack, slots["gap:-1"], P))];
  stack.parts.forEach((p, i) => {
    out.push(g({ "data-slot": `${name}:in:${i}` }, ST.slotSvg(kitNode, stack, slots["in:" + i], P)));
    out.push(g({ "data-move": `${name}:${i}`, "data-asm": name }, build[p.id]()));
    out.push(g({ "data-slot": `${name}:gap:${i}` }, ST.slotSvg(kitNode, stack, slots["gap:" + i], P)));
  });
  return out.join("");
}

// free items: painter's order is fixed, each moves by its own vector × share
const item = (asm, out, svg) => g({ "data-asm": asm, "data-out": out.join(",") }, svg);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Three more parts of the traction lift on a bench, each able to come apart. The car: a plank with a safety gear at each end, two stiles, a platform, the cab, its roof and the crosshead the ropes hang from. The counterweight: two stiles, a bottom and a top beam and eight filler weights. The overspeed governor: a bracket, a bearing, a grooved sheave, two flyweights on a spring and an end cap, with its overspeed switch.",
  body: [
    bench(),
    // 04 the car: far side, middle stack bottom to top, near side
    item("car", [0, -7, 0], safetyGear(-1)),
    item("car", [0, -3, 0], stile(-1)),
    item("car", [0, 0, 0], carPart.plank()),
    item("car", [0, 0, 6], carPart.platform()),
    item("car", [0, 0, 13], carPart.cab()),
    item("car", [0, 0, 24], carPart.roof()),
    item("car", [0, 0, 32], carPart.crosshead()),
    item("car", [0, 3, 0], stile(1)),
    item("car", [0, 7, 0], safetyGear(1)),
    // 06 the counterweight
    item("cw", [0, -4, 0], cwStile(-1)),
    item("cw", [0, 0, 0], cwBeam(0, false)),
    ...Array.from({ length: WEIGHTS }, (_, i) => item("cw", [0, 0, 3 + i * 2.2], cwPlate(i))),
    item("cw", [0, 0, 24], cwBeam(2 + WEIGHTS * PLATE_H, true)),
    item("cw", [0, 4, 0], cwStile(1)),
    // 05 the governor
    g({ "data-asm": "gov" }, S(k.slabOf(GV_BASE, 0, GV_BASE_TOP, P, 2, 0.4), { tone: "mid", crease: "lo" }) + L(k.planOutline(k.insetPlan(GV_BASE, 1.4), GV_BASE_TOP, P, 2), { tone: "faint" })),
    stackSvg("gov", GOVERNOR, gpart),
    item("gov", [0, 0, 5], gswitch()),
  ],
});

const ASM = {
  car: {
    no: "04", title: "카 · 비상정지장치",
    parts: ["비상정지장치 2개 (쐐기형)", "카 기둥 (스타일) 2개 · 가이드 슈", "하부 빔 (플랭크)", "바닥 (플랫폼) · 문턱", "케이지 · 문 · 조작반", "천장 · 환풍기", "크로스헤드 · 로프 고정부"],
    note: "카는 프레임(기둥·하부 빔·크로스헤드)에 케이지를 얹은 구조이고, 로프는 크로스헤드에 걸립니다. 과속하면 조속기가 비상정지장치를 당기고, 쐐기가 레일을 물어 카를 세웁니다.",
  },
  gov: {
    no: "05", title: "조속기",
    parts: GOVERNOR.parts.map((p) => p.name).slice(0, 4).concat(["축 끝 캡", "과속 스위치"]),
    note: "카에 연결된 조속기 로프가 이 시브를 돌립니다. 너무 빨리 돌면 원심력으로 플라이웨이트가 벌어지면서 먼저 스위치로 모터를 끊고, 그래도 빠르면 로프를 잡아 비상정지장치를 작동시킵니다. 2배 확대해서 그렸습니다.",
  },
  cw: {
    no: "06", title: "균형추",
    parts: ["기둥 2개 · 가이드 슈", "하부 빔", "웨이트 판 8장", "상부 빔 · 로프 고정부"],
    note: "프레임에 웨이트 판을 쌓아 무게를 맞춥니다. 카 무게에 정원 하중의 약 45%를 더한 값이라, 모터는 그 차이만 들어 올리면 됩니다.",
  },
};
const CENTRES = { car: at([C.x, C.y, 20]), cw: at([W.x, W.y, 14]), gov: at([GV.x, 20, GV.z]) };

const script = `
${readFileSync(join(HERE, "stack.mjs"), "utf8").replace(/^export /gm, "")}
const kitNode = { iso, pathOf, cameraOf };
const P = ${JSON.stringify(P)};
const STACKS = { gov: ${JSON.stringify(GOVERNOR)} };
const ASM = ${JSON.stringify(ASM)};
const CENTRES = ${JSON.stringify(CENTRES)};
const ORDER = ["car", "gov", "cw"];
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const listEl = document.querySelector("[data-list]");
const noteEl = document.querySelector("[data-note]");
const buttons = [...document.querySelectorAll("[data-pick]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const share = { car: 0, gov: 0, cw: 0 };
let picked = null, frame = 0, last = 0, visible = false, touring = true, idle = 0, clock = 0;
const moves = {}, slots = {}, lastSlots = {};
for (const el of svg.querySelectorAll("[data-move]")) moves[el.dataset.move] = el;
for (const el of svg.querySelectorAll("[data-slot]")) slots[el.dataset.slot] = el;
const items = [...svg.querySelectorAll("[data-out]")].map((el) => ({ el, asm: el.dataset.asm, out: el.dataset.out.split(",").map(Number) }));
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
function draw() {
  drawStack("gov", share.gov);
  for (const it of items) { const e = share[it.asm]; it.el.setAttribute("transform", translateAlong(P, it.out.map((v) => v * e))); }
  const text = picked ? ASM[picked].no + " " + ASM[picked].title + " · 분해 " + Math.round(share[picked] * 100 + 0.4) + "%" : "조립 상태 · 부품을 고르세요";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
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
  const d = (n) => Math.hypot(CENTRES[n][0] - x, CENTRES[n][1] - y);
  pick(ORDER.reduce((best, n) => (d(n) < d(best) ? n : best), ORDER[0]));
});
buttons.forEach((b) => { b.addEventListener("click", () => pick(b.dataset.pick)); b.addEventListener("pointerenter", () => pick(b.dataset.pick)); });
stage.addEventListener("keydown", (event) => {
  if (/^[4-6]$/.test(event.key)) { event.preventDefault(); pick({ 4: "car", 5: "gov", 6: "cw" }[event.key]); }
  if (event.key === "Escape") { event.preventDefault(); pick(null); }
});
draw();
`;

const pickers = `<div class="lp-picks">${["car", "gov", "cw"].map((id) => `<button type="button" class="lp-pick" data-pick="${id}"><span>${ASM[id].no}</span>${ASM[id].title}</button>`).join("")}</div><ol class="lp-list" data-list></ol><p class="lp-note" data-note></p>`;
const css = readFileSync(join(HERE, "build.mjs"), "utf8").match(/const css = `(<style>[\s\S]*?<\/style>)`/)[1];

const body = css + k.plateHtml({
  fig: "Fig 4",
  title: "카 · 조속기 · 균형추 분해도",
  hint: "부품에 마우스를 올리면 분해",
  readout: "조립 상태 · 부품을 고르세요",
  caption:
    "Fig 2 승강기의 나머지 핵심 부품입니다. 카는 크로스헤드·천장·케이지가 위로 들리고 기둥과 비상정지장치가 옆으로 빠집니다. 균형추는 위 빔과 웨이트 판이 위로 펼쳐집니다. 조속기는 축을 따라 빠집니다. 모형 1 단위 = 8 cm (조속기만 2배 확대). 키보드: 4·5·6으로 선택, Esc로 다시 조립.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Car, governor and counterweight: press 4, 5 or 6 to take a part apart, Escape to put it back">${svg}</div>`,
}).replace("</figure>", `${pickers}</figure>`);

const out = theme === "light" ? "lift-cabin-light.html" : "lift-cabin.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Lift car, governor and counterweight", theme, body, script: kitScript() + script }).replace('<html lang="en">', '<html lang="ko">'));
console.log("wrote", out);
