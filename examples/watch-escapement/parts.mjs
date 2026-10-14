// Shared by the build and the page: everything that turns is rebuilt from here.
// `k` is the kit (imported in Node, inlined in the page), angles are radians,
// positive anticlockwise seen from above.

export const TAU = Math.PI * 2;
export const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export const around = (c, list, a) => list.map((p) => { const [x, y] = rot(p, a); return [c[0] + x, c[1] + y]; });

// A toothed wheel: `count` teeth between root and tip, as one floor outline.
export function teethRing(count, tip, depth, a = 0) {
  const ring = [];
  const root = tip - depth;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * TAU + a;
    const step = TAU / count;
    for (const [f, r] of [[0.02, root], [0.22, tip], [0.48, tip], [0.68, root]]) {
      const u = t + f * step;
      ring.push([r * Math.cos(u), r * Math.sin(u)]);
    }
  }
  return ring;
}

// Club-tooth escape wheel: 15 raked teeth, each with a short flat impulse face.
export function escapeRing(count, tip, a = 0) {
  const ring = [];
  const root = tip * 0.76;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * TAU + a;
    const step = TAU / count;
    for (const [f, r] of [[0, root], [0.05, tip * 0.97], [0.13, tip], [0.19, tip * 0.95], [0.3, root * 1.12], [0.62, root]]) {
      const u = t + f * step;
      ring.push([r * Math.cos(u), r * Math.sin(u)]);
    }
  }
  return ring;
}

// Crossing windows (the cut-outs between a wheel's arms), as closed outlines.
export function windows(k, c, r0, r1, arms, z, a, P) {
  const out = [];
  const span = TAU / arms;
  for (let i = 0; i < arms; i++) {
    const a0 = a + i * span + span * 0.16;
    const a1 = a + (i + 1) * span - span * 0.16;
    const pts = [];
    const n = 10;
    for (let j = 0; j <= n; j++) { const u = a0 + ((a1 - a0) * j) / n; pts.push([c[0] + r1 * Math.cos(u), c[1] + r1 * Math.sin(u)]); }
    const b0 = a0 + span * 0.08, b1 = a1 - span * 0.08;
    for (let j = n; j >= 0; j--) { const u = b0 + ((b1 - b0) * j) / n; pts.push([c[0] + r0 * Math.cos(u), c[1] + r0 * Math.sin(u)]); }
    out.push(k.onTop(pts, z, P, true));
  }
  return out.join("");
}

// One train wheel on its arbor: pinion below, toothed wheel, hub, crossings.
export function wheelSvg(k, w, a, P) {
  const [cx, cy] = w.at;
  const out = [];
  const ring = around(w.at, teethRing(w.teeth, w.r, Math.min(1.1, w.r * 0.08), 0), a);
  out.push(k.solidSvg(k.extrude(ring, w.z, w.h, P, { convex: false }), { tone: "hi", crease: "lo" }));
  if (w.arms) out.push(k.lineSvg(windows(k, w.at, w.r * 0.3, w.r * 0.78, w.arms, w.z + w.h, a, P), { tone: "lo" }));
  out.push(k.lineSvg(k.ring(cx, cy, w.r * 0.86, w.z + w.h, P, 64), { tone: "faint" }));
  out.push(k.solidSvg(k.cylinder(cx, cy, w.hub, w.z + w.h, 0.6, P, 24), { tone: "mid" }));
  return out.join("");
}

export function pinionSvg(k, w, a, P) {
  const ring = around(w.at, teethRing(w.leaves, w.pr, w.pr * 0.32, 0), a);
  return k.solidSvg(k.extrude(ring, w.pz, w.ph, P, { convex: false }), { tone: "mid", crease: "lo" });
}

export function escapeSvg(k, E, a, P) {
  const out = [];
  out.push(k.solidSvg(k.extrude(around(E.at, escapeRing(E.teeth, E.r), a), E.z, E.h, P, { convex: false }), { tone: "hi", crease: "lo" }));
  out.push(k.lineSvg(windows(k, E.at, E.r * 0.24, E.r * 0.6, 5, E.z + E.h, a, P), { tone: "lo" }));
  out.push(k.solidSvg(k.cylinder(E.at[0], E.at[1], 1.3, E.z + E.h, 0.5, P, 20), { tone: "mid" }));
  return out.join("");
}

// The pallet fork, turned by `phi` about its arbor: two arms to the stones, the lever to the horns.
export function forkSvg(k, F, phi, P) {
  const turn = (list) => around(F.at, list, F.a + phi);
  const bar = (from, to, w) => {
    const dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy);
    const nx = (-dy / l) * w / 2, ny = (dx / l) * w / 2;
    return [[from[0] + nx, from[1] + ny], [to[0] + nx, to[1] + ny], [to[0] - nx, to[1] - ny], [from[0] - nx, from[1] - ny]];
  };
  const out = [];
  // local frame: +x toward the escape wheel, -x toward the balance
  const body = [[-F.lever + 1.2, 1.5], [-F.lever, 2.6], [-F.lever - 2.2, 2.4], [-F.lever - 2.2, 0.8], [-F.lever + 0.4, 0.7], [-F.lever + 0.4, -0.7], [-F.lever - 2.2, -0.8], [-F.lever - 2.2, -2.4], [-F.lever, -2.6], [-F.lever + 1.2, -1.5], [-2, -1.1], [F.reach * 0.55, -F.spread * 0.9], [F.reach + 0.6, -F.spread - 0.6], [F.reach - 1.4, -F.spread - 1.4], [F.reach * 0.45, -F.spread * 0.3 - 1.4], [1.6, -2.2], [1.6, 2.2], [F.reach * 0.45, F.spread * 0.3 + 1.4], [F.reach - 1.4, F.spread + 1.4], [F.reach + 0.6, F.spread + 0.6], [F.reach * 0.55, F.spread * 0.9], [-2, 1.1]];
  out.push(k.solidSvg(k.extrude(turn(body), F.z, F.h, P, { convex: false }), { tone: "hi", crease: "lo" }));
  for (const side of [-1, 1]) {
    const stone = bar([F.reach - 0.6, side * (F.spread + 0.2)], [F.reach + 1.8, side * (F.spread - 0.9)], 1.1);
    out.push(k.solidSvg(k.extrude(turn(stone), F.z - 0.2, F.h + 0.5, P), { tone: "hi", crease: "lo" }));
  }
  const [gx, gy] = turn([[-F.lever + 2.2, 0]])[0];
  out.push(k.solidSvg(k.cylinder(gx, gy, 0.45, F.z + F.h, 1.4, P, 10), { tone: "mid", crease: "none" }));
  out.push(k.solidSvg(k.cylinder(F.at[0], F.at[1], 1.6, F.z + F.h, 0.5, P, 20), { tone: "mid" }));
  return out.join("");
}

// The balance: arms, timing weights and the roller jewel turn with it; the rim is static (it is round).
export function balanceMoving(k, B, theta, P) {
  const a = B.a + theta;
  const out = [];
  const arm = [[-B.r + 1, -0.8], [B.r - 1, -0.8], [B.r - 1, 0.8], [-B.r + 1, 0.8]];
  out.push(k.solidSvg(k.extrude(around(B.at, arm, a + Math.PI / 2), B.z, B.h * 0.7, P), { tone: "hi", crease: "lo" }));
  out.push(k.solidSvg(k.cylinder(B.at[0], B.at[1], 2.6, B.z, B.h + 0.4, P, 28), { tone: "hi", crease: "lo" }));
  const weights = [0, 1, 2, 3].map((i) => around(B.at, [[B.r - 0.8, 0]], a + Math.PI / 4 + (i * Math.PI) / 2)[0]);
  const front = [...weights].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
  for (const [x, y] of front) out.push(k.solidSvg(k.cylinder(x, y, 1.2, B.z + B.h, 0.9, P, 16), { tone: "hi", crease: "lo" }));
  const [jx, jy] = around(B.at, [[B.jewel, 0]], a)[0];
  out.push(k.solidSvg(k.cylinder(jx, jy, 0.55, B.z - 1.6, 1.6, P, 12), { tone: "hi", crease: "none" }));
  return out.join("");
}

// The hairspring: an Archimedean spiral whose inner end turns with the balance and
// whose outer end is pinned at the stud, so each coil turns by its share of theta.
export function hairspring(k, H, theta, P) {
  const pts = [];
  const n = H.turns * 28;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const r = H.r0 + (H.r1 - H.r0) * f;
    const u = H.a0 + f * H.turns * TAU + theta * (1 - f);
    pts.push([H.at[0] + r * Math.cos(u), H.at[1] + r * Math.sin(u)]);
  }
  return k.onTop(pts, H.z, P);
}

// The seconds hand on the fourth wheel's pivot.
export function handPath(k, S, a, P) {
  const [tx, ty] = around(S.at, [[S.len, 0]], a)[0];
  const [bx, by] = around(S.at, [[-S.tail, 0]], a)[0];
  return k.lineOnTop([bx, by], [tx, ty], S.z, P);
}
