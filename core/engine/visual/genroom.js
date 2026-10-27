// Visual mesh of the generator room: what the user SEES and exports. Collision / BOM / drawings use the boxes of gen/genroom.js.
// Real shapes: walls with true openings, louvre blades, door leaves that swing, DG sets (skid, radiator with fan, engine, alternator),
// exhaust (bellows, silencer, lagged pipe, wall sleeve, stack, rain cap), day tank with bund and fuel lines, control panel, battery rack,
// cable trench with cover plates, monorail hoist, fire kit, lights, extraction fan. Everything is read from plan(p): one source of truth.
import { Geo, box, cyl, lathe, tube, hollow } from '../mesh.js';
import { fromEuler, add, sub, scale, norm, len, dot } from '../math3.js';
import { plan, rectMinus, WALL, SETCOL } from '../gen/genroom.js';
import { cylAt, hollowAt, part } from './util.js';

const mv = (x, y, z) => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [x, y, z] });
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const bxe = (g, x0, x1, y0, y1, z0, z1) => g.merge(box(x1 - x0, y1 - y0, z1 - z0), mv((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
const bxr = (g, size, at, rot) => g.merge(box(size[0], size[1], size[2]), fromEuler(at, rot));
const put = (g, local, x, y, z) => g.merge(local, mv(x, y, z));
const C = { concrete: 0x9aa0a6, concreteDark: 0x80868c, steel: 0x5d6b7a, dark: 0x2b3238, black: 0x1a1d20, alu: 0xbfc4c9, door: 0x5e6a74, frame: 0x4a545d, red: 0xc0392b, glass: 0xaed6e6, rubber: 0x15171a, brass: 0xb89a5a, yellow: 0xd8a21c };

// pipe path with rounded corners (radius R), 8 steps per corner
function rounded(pts, R, steps = 8) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], u = norm(sub(a, b)), v = norm(sub(c, b)), ang = Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
    if (ang > Math.PI - 1e-3) { out.push(b); continue; }
    const dd = Math.min(R / Math.tan(ang / 2), len(sub(a, b)) / 2, len(sub(c, b)) / 2), Rr = dd * Math.tan(ang / 2);
    const p1 = add(b, scale(u, dd)), p2 = add(b, scale(v, dd)), Cn = add(b, scale(norm(add(u, v)), Rr / Math.sin(ang / 2)));
    const r1 = sub(p1, Cn), r2 = sub(p2, Cn), phi = Math.acos(Math.max(-1, Math.min(1, dot(norm(r1), norm(r2)))));
    for (let k = 0; k <= steps; k++) { const s = k / steps, w1 = Math.sin((1 - s) * phi) / Math.sin(phi), w2 = Math.sin(s * phi) / Math.sin(phi); out.push(add(Cn, add(scale(r1, w1), scale(r2, w2)))); }
  }
  out.push(pts[pts.length - 1]); return out;
}
const bellows = (r, h) => { const n = 7, pr = [[0, 0], [r, 0]]; for (let k = 0; k < n; k++) { const z = h * k / n, d = h / n; pr.push([r * 1.2, z + d * 0.25], [r * 1.2, z + d * 0.75], [r, z + d]); } pr.push([0, h]); return lathe(pr, { seg: 28 }); };
const silencerGeo = (r, L) => lathe([[0, 0], [r * 0.5, 0], [r * 0.85, r * 0.2], [r, r * 0.4], [r, L - r * 0.4], [r * 0.85, L - r * 0.2], [r * 0.5, L], [0, L]], { seg: 36, smooth: true });
const cone = (r0, r1, h, seg = 24) => lathe([[0, 0], [r0, 0], [r1, h], [0, h]], { seg });

// ---- walls ----
function wallGeo(P, name, inset = 0, thick = 0) {   // inset = 0: the wall itself; inset > 0: lining of that thickness on the inside face
  const w = P.walls[name], g = new Geo(), { Li, Wi, Wo, t, zf, Hi } = P;
  const lining = thick > 0, W = lining ? (w.axis === 'x' ? Wi : Li) : w.W, shift = lining && w.axis === 'x' ? P.t : 0;
  const holes = w.holes.map(h => ({ ...h, u0: h.u0 - shift, u1: h.u1 - shift }));
  for (const r of rectMinus(W, Hi, holes)) {
    const uc = (r.u0 + r.u1) / 2, z0 = zf + r.v0, z1 = zf + r.v1, du = r.u1 - r.u0;
    if (w.axis === 'x') { const xc = w.side * (lining ? Li / 2 - thick / 2 : Li / 2 + t / 2), yc = lining ? -Wi / 2 + uc : -Wo / 2 + uc; bxe(g, xc - (lining ? thick : t) / 2, xc + (lining ? thick : t) / 2, yc - du / 2, yc + du / 2, z0, z1); }
    else { const yc = w.side * (lining ? Wi / 2 - thick / 2 : Wi / 2 + t / 2), xc = -Li / 2 + uc; bxe(g, xc - du / 2, xc + du / 2, yc - (lining ? thick : t) / 2, yc + (lining ? thick : t) / 2, z0, z1); }
  }
  return g;
}
// a flat frame (4 bars) around an opening of a wall; returns Geo in world coordinates
function openingFrame(P, name, h, bar = 60, depth = null) {
  const w = P.walls[name], g = new Geo(), t = P.t, zf = P.zf, dep = depth ?? t;
  const rect = (u0, u1, v0, v1) => {
    const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    if (w.axis === 'x') bxe(g, w.side * (P.Li / 2 + t / 2) - dep / 2, w.side * (P.Li / 2 + t / 2) + dep / 2, -P.Wo / 2 + u0, -P.Wo / 2 + u1, zf + v0, zf + v1);
    else bxe(g, -P.Li / 2 + u0, -P.Li / 2 + u1, w.side * (P.Wi / 2 + t / 2) - dep / 2, w.side * (P.Wi / 2 + t / 2) + dep / 2, zf + v0, zf + v1);
  };
  rect(h.u0, h.u0 + bar, h.v0, h.v1); rect(h.u1 - bar, h.u1, h.v0, h.v1); rect(h.u0 + bar, h.u1 - bar, h.v1 - bar, h.v1);
  if (h.v0 > 0) rect(h.u0 + bar, h.u1 - bar, h.v0, h.v0 + bar);
  return g;
}
// louvre blades inside an opening
function louvreBlades(P, name, h, tilt = 40) {
  const w = P.walls[name], g = new Geo(), bladeH = 75, n = Math.max(1, Math.floor((h.v1 - h.v0 - 120) / bladeH)), uc = (h.u0 + h.u1) / 2, span = h.u1 - h.u0 - 120;
  const phi = w.axis === 'y' ? -w.side * tilt : w.side * tilt;
  const xyAt = (u, v) => w.axis === 'x' ? [w.side * (P.Li / 2 + P.t / 2), -P.Wo / 2 + u, P.zf + v] : [-P.Li / 2 + u, w.side * (P.Wi / 2 + P.t / 2), P.zf + v];
  for (let i = 0; i < n; i++) {
    const v = h.v0 + 60 + bladeH / 2 + i * ((h.v1 - h.v0 - 120) / n), at = xyAt(uc, v);
    if (w.axis === 'y') bxr(g, [span, 90, 5], at, [phi, 0, 0]); else bxr(g, [90, span, 5], at, [0, phi, 0]);
  }
  return g;
}

// ---- DG set (local frame: x 0..L radiator -> alternator, y -W/2..W/2, z 0..H above the plinth) ----
function setGeo(P, sc) {
  const { L, W, H, D } = P.S, skid = new Geo(), mounts = new Geo(), rad = new Geo(), eng = new Geo(), alt = new Geo(), ctl = new Geo(), ex = new Geo();
  for (const s of [-1, 1]) bxe(skid, 0, L, s * (W / 2 - 55) - 55, s * (W / 2 - 55) + 55, 50, 200);
  for (let i = 0; i <= 6; i++) { const x = 40 + i * (L - 80) / 6; bxe(skid, x - 35, x + 35, -W / 2 + 110, W / 2 - 110, 70, 170); }
  for (const x of [0.08, 0.5, 0.92]) for (const s of [-1, 1]) mounts.merge(cylAt(48, 50, Z, [x * L, s * (W / 2 - 55), 25], { seg: 16 }));
  const rh = 0.8 * (H - 200), rz0 = 200, rx1 = 0.24 * L, rw = 0.92 * W;
  bxe(rad, 0, rx1, -rw / 2, rw / 2, rz0, rz0 + rh);
  for (let i = 0; i < 16; i++) { const y = -rw / 2 + 40 + i * (rw - 80) / 15; bxe(rad, -10, 0, y - 6, y + 6, rz0 + 30, rz0 + rh - 30); }
  bxe(rad, -4, rx1 + 4, -rw / 2 - 6, rw / 2 + 6, rz0 + rh, rz0 + rh + 40);           // top tank
  const fr = Math.min(rw / 2 - 40, rh / 2 - 30), fz = rz0 + rh / 2;
  rad.merge(hollowAt(fr + 25, fr, 0.06 * L, X, [rx1 + 0.04 * L, 0, fz], { seg: 40 }));
  rad.merge(cylAt(fr * 0.16, 0.08 * L, X, [rx1 + 0.04 * L, 0, fz], { seg: 20 }));
  for (let i = 0; i < 7; i++) { const a = i * 2 * Math.PI / 7, r = fr * 0.5; bxr(rad, [10, fr * 0.5, 70], [rx1 + 0.04 * L, -Math.sin(a) * r, fz + Math.cos(a) * r], [a * 180 / Math.PI + 90, 0, 0]); }   // fan blades
  const ex0 = 0.29 * L, ex1 = 0.66 * L, eTop = 200 + 0.55 * (H - 200), eHead = 200 + 0.72 * (H - 200);
  bxe(eng, ex0, ex1, -0.36 * W, 0.36 * W, 200, eTop); bxe(eng, ex0 + 0.03 * L, ex1 - 0.03 * L, -0.26 * W, 0.26 * W, eTop, eHead);
  for (let i = 0; i < 6; i++) { const x = ex0 + 0.05 * L + i * (ex1 - ex0 - 0.1 * L) / 5; eng.merge(cylAt(26, 0.12 * W, Z, [x, 0, eHead + 15], { seg: 14 })); }
  eng.merge(cylAt(0.045 * W, ex1 - ex0 - 0.08 * L, X, [(ex0 + ex1) / 2, 0.30 * W, eTop - 60], { seg: 20 }));            // intake manifold
  eng.merge(cylAt(0.075 * W, 0.16 * W, Y, [ex0 + 0.12 * L, 0.42 * W, eTop - 20], { seg: 24 }));                          // turbocharger
  eng.merge(cylAt(0.1 * W, 0.28 * H, Z, [ex0 + 0.07 * L, 0.46 * W, 200 + 0.3 * H], { seg: 28 }));                           // air cleaner
  for (const x of [0.5, 0.58]) eng.merge(cylAt(0.04 * W, 0.2 * H, Z, [(ex0 + ex1) * x, -0.42 * W, 200 + 0.15 * H], { seg: 18 })); // fuel / oil filters
  const exX = P.sets[0].xEx - P.sets[0].x0;                                                // exhaust outlet position along the set
  ex.merge(cylAt(D / 2 + 8, H - eHead + 40, Z, [exX, 0, (H + eHead) / 2 - 20], { seg: 28 }));
  ex.merge(cylAt(D * 0.75, 22, Z, [exX, 0, H - 11], { seg: 36 }));
  const ra = 0.4 * W, az = 200 + ra + 40, ax0 = 0.66 * L, ax1 = 0.96 * L;
  alt.merge(cylAt(ra * 0.92, 0.04 * L, X, [ax0 - 0.01 * L, 0, az], { seg: 36 })); alt.merge(cylAt(ra, ax1 - ax0 - 0.04 * L, X, [(ax0 + 0.03 * L + ax1) / 2, 0, az], { seg: 44 }));
  for (let i = 1; i < 6; i++) alt.merge(cylAt(ra * 1.02, 10, X, [ax0 + 0.03 * L + i * (ax1 - ax0 - 0.06 * L) / 6, 0, az], { seg: 44 }));
  alt.merge(cylAt(ra * 0.7, 0.03 * L, X, [ax1 - 0.005 * L, 0, az], { seg: 32 }));
  bxe(alt, ax0 + 0.12 * L, ax0 + 0.26 * L, -0.2 * W, 0.2 * W, az + ra - 10, az + ra + 0.2 * W);                            // terminal box
  bxe(alt, ax0 + 0.1 * L, ax0 + 0.28 * L, -0.17 * W, 0.17 * W, az + ra + 0.2 * W, az + ra + 0.2 * W + 20);
  bxe(ctl, 0.45 * L, 0.56 * L, -0.4 * W - 30, -0.36 * W, 200 + 0.18 * H, 200 + 0.18 * H + 0.2 * H);                    // controller on the engine side
  bxe(ctl, 0.46 * L, 0.55 * L, -0.4 * W - 36, -0.4 * W - 30, 200 + 0.2 * H + 0.05 * H, 200 + 0.2 * H + 0.15 * H);
  return { skid, mounts, rad, eng, alt, ctl, ex, terminal: { x: ax0 + 0.19 * L, z: az + ra + 0.1 * W } };
}

function doorLeaf(w, h, ysign, color) {     // hinge at local origin, leaf towards ysign * Y, thickness along X (50 mm)
  const g = new Geo(), y0 = ysign > 0 ? 0 : -w, y1 = ysign > 0 ? w : 0;
  bxe(g, -25, 25, y0, y1, 0, h);
  const e = ysign > 0 ? 1 : -1;
  for (const z of [0.12 * h, 0.5 * h, 0.88 * h]) bxe(g, 25, 40, y0 + 80, y1 - 80, z - 40, z + 40);
  bxe(g, 25, 40, y0 + w / 2 - 40, y0 + w / 2 + 40, 80, h - 80);
  for (const z of [0.15 * h, 0.5 * h, 0.85 * h]) g.merge(cylAt(14, 90, Z, [0, ysign > 0 ? 0 : 0, z], { seg: 12 }));          // hinge barrels on the hinge line
  g.merge(cylAt(14, 160, Z, [60, y0 + (ysign > 0 ? w - 90 : 90), 1000], { seg: 12 }));                                         // handle
  return g;
}

export function genRoom({ params: p }) {
  const P = plan(p), parts = [], { Li, Wi, Lo, Wo, t, zf, zc, zr, Hi, fl } = P;
  const cut = on(p.cutaway), wallC = WALL[p.wallColor] ?? WALL.grey, setC = SETCOL[p.setColor] ?? SETCOL.blue, open = Math.max(0, Math.min(100, +p.open || 0)) / 100, ang = 110 * open;
  const add2 = (name, g, color, extra) => { if (!g.empty) parts.push(part(name, g, color, extra)); };
  // floor (with cable trench) and plinths
  const floor = new Geo();
  if (P.fac.trench) {
    const T = P.fac.trench, d = T.depth;
    bxe(floor, -Lo / 2, Lo / 2, -Wo / 2, Wo / 2, 0, fl - d);
    for (const r of rectMinus(Lo, Wo, [{ u0: T.xc - T.w / 2 + Lo / 2, u1: T.xc + T.w / 2 + Lo / 2, v0: T.yB - T.w / 2 + Wo / 2, v1: T.yA + Wo / 2 }])) bxe(floor, -Lo / 2 + r.u0, -Lo / 2 + r.u1, -Wo / 2 + r.v0, -Wo / 2 + r.v1, fl - d, fl);
  } else bxe(floor, -Lo / 2, Lo / 2, -Wo / 2, Wo / 2, 0, fl);
  add2('floor-slab', floor, C.concrete);
  const plinth = new Geo(); for (const s of P.sets) bxe(plinth, (s.x0 + s.x1) / 2 - P.S.L / 2 - 200, (s.x0 + s.x1) / 2 + P.S.L / 2 + 200, s.ya - P.S.W / 2 - 200, s.ya + P.S.W / 2 + 200, zf, zf + P.ph);
  add2('set-plinth', plinth, C.concreteDark);
  // walls, frames, lining, roof
  const shown = Object.keys(P.walls).filter(n => !(cut && n === 'negy'));                       // cutaway (view only): the front wall and the roof are not drawn
  const walls = new Geo(); for (const n of shown) walls.merge(wallGeo(P, n)); add2('walls', walls, wallC);
  const frames = new Geo();
  for (const [n, w] of Object.entries(P.walls)) if (shown.includes(n)) for (const h of w.holes) if (['equipment-door', 'personnel-door', 'inlet-louvre', 'discharge', 'fan'].includes(h.kind)) frames.merge(openingFrame(P, n, h, h.kind.includes('door') ? 100 : 60));
  add2('opening-frames', frames, C.frame);
  if (on(p.acoustic)) { const l = new Geo(); for (const n of shown) l.merge(wallGeo(P, n, 1, 75)); add2('acoustic-lining', l, 0x66737f); }
  const roof = new Geo(); for (const r of rectMinus(Lo, Wo, P.roofHoles)) bxe(roof, -Lo / 2 + r.u0, -Lo / 2 + r.u1, -Wo / 2 + r.v0, -Wo / 2 + r.v1, zc, zr);
  bxe(roof, -Lo / 2, Lo / 2, -Wo / 2, -Wo / 2 + 150, zr, zr + 300); bxe(roof, -Lo / 2, Lo / 2, Wo / 2 - 150, Wo / 2, zr, zr + 300);
  bxe(roof, -Lo / 2, -Lo / 2 + 150, -Wo / 2 + 150, Wo / 2 - 150, zr, zr + 300); bxe(roof, Lo / 2 - 150, Lo / 2, -Wo / 2 + 150, Wo / 2 - 150, zr, zr + 300);
  if (!cut) add2('roof-slab', roof, C.concrete);
  // louvres
  const lv = new Geo(), lvF = new Geo();
  for (const [n, w] of Object.entries(P.walls)) if (shown.includes(n)) for (const h of w.holes) if (h.kind === 'inlet-louvre' || h.kind === 'discharge') lv.merge(louvreBlades(P, n, h));
  add2('louvre-blades', lv, 0x8a949c);
  // equipment doors
  const doors = new Geo(), shutters = new Geo(), xo = Li / 2 + t - 25;
  for (const s of P.sets) {
    if (p.doorType === 'shutter') {
      const hc = Math.max(100, P.Heq * (1 - open)), z1 = zf + P.Heq, ns = Math.ceil(hc / 100);
      for (let i = 0; i < ns; i++) { const za = z1 - (i + 1) * (hc / ns); bxe(shutters, xo - 20, xo + 20, s.ya - P.Weq / 2 + 20, s.ya + P.Weq / 2 - 20, za + 3, za + hc / ns - 3); }
      bxe(shutters, xo - 25, xo + 25, s.ya - P.Weq / 2 + 20, s.ya + P.Weq / 2 - 20, z1 - hc, z1 - hc + 40);
      for (const sd of [-1, 1]) bxe(shutters, xo - 30, xo + 45, s.ya + sd * (P.Weq / 2 - 30) - 20, s.ya + sd * (P.Weq / 2 - 30) + 20, zf, z1);
      bxe(shutters, xo - 20, Li / 2 + t + 250, s.ya - P.Weq / 2 - 100, s.ya + P.Weq / 2 + 100, z1 + 10, z1 + 340);
      for (const sd of [-1, 1]) shutters.merge(cylAt(150, 20, Y, [Li / 2 + t + 110, s.ya + sd * (P.Weq / 2 + 100), z1 + 170], { seg: 24 }));
    } else {
      const wl = (P.Weq - 20) / 2;
      for (const sd of [1, -1]) doors.merge(doorLeaf(wl, P.Heq - 20, -sd, C.door), { R: fromEuler([0, 0, 0], [0, 0, sd * ang]).R, t: [xo, s.ya + sd * (P.Weq / 2 - 10), zf + 10] });
    }
  }
  add2('equipment-doors', doors, C.door); add2('rolling-shutters', shutters, 0x9aa3ab);
  { const pd = new Geo(), wl = P.pd.w - 10, hx = Li / 2 - 205, yo = -Wi / 2 - t + 25, leaf = new Geo();
    bxe(leaf, -wl, 0, -25, 25, 0, P.pd.h - 20); bxe(leaf, -wl + 90, -90, 25, 38, 90, P.pd.h - 110); bxe(leaf, -wl + 90, -90, 25, 38, 900, 1000);
    leaf.merge(cylAt(14, 160, X, [-wl + 90, 40, 1000], { seg: 12 }));
    for (const z of [150, (P.pd.h - 20) / 2, P.pd.h - 170]) leaf.merge(cylAt(14, 90, Z, [0, 0, z], { seg: 12 }));
    pd.merge(leaf, { R: fromEuler([0, 0, 0], [0, 0, ang]).R, t: [hx, yo, zf + 10] }); if (!cut) add2('personnel-door', pd, C.door); }
  // DG sets
  const sg = setGeo(P, setC), nm = i => (P.n === 2 ? (i ? '-B' : '-A') : '');
  P.sets.forEach((s, i) => {
    const x = s.x0, y = s.ya, z = zf + P.ph, put2 = (l, name, c) => { const g = new Geo(); put(g, l, x, y, z); add2(name + nm(i), g, c); };
    put2(sg.skid, 'set-skid', 0x2d3238); put2(sg.mounts, 'set-mounts', C.rubber); put2(sg.rad, 'set-radiator', setC); put2(sg.eng, 'set-engine', 0x59636d);
    put2(sg.alt, 'set-alternator', setC); put2(sg.ctl, 'set-controller', C.black); put2(sg.ex, 'set-exhaust-outlet', 0x3a3f45);
  });
  // exhaust
  { const D = P.S.D, r = D / 2;
    P.sets.forEach((s, i) => {
      const bel = new Geo(), sil = new Geo(), pipe = new Geo(), lag = new Geo(), fit = new Geo();
      put(bel, bellows(r + 6, 400), s.xEx, s.ya, s.zTop); put(sil, silencerGeo(P.sil.Dia / 2, P.sil.L), s.xEx, s.ya, s.zSil0);
      const path = P.roofExit ? [[s.xEx, s.ya, s.zSil1], [s.xEx, s.ya, P.zStackTop]] : rounded([[s.xEx, s.ya, s.zSil1], [s.xEx, s.ya, s.zH], [s.xEx, s.yOut, s.zH], [s.xEx, s.yOut, P.zStackTop]], 1.5 * D);
      pipe.merge(tube(path.map(q => q.slice()), r, { seg: 24 }));
            const inside = P.roofExit ? [[s.xEx, s.ya, s.zSil1], [s.xEx, s.ya, zc]] : rounded([[s.xEx, s.ya, s.zSil1], [s.xEx, s.ya, s.zH], [s.xEx, s.dir * (Wi / 2 - 20), s.zH]], 1.5 * D);
      lag.merge(tube(inside, r + 55, { seg: 24 }));
      if (P.roofExit) { lag.merge(hollowAt(r + 100, r + 5, 200, Z, [s.xEx, s.ya, zc + 100], { seg: 24 })); }
      else { fit.merge(hollowAt(r + 70, r + 5, t, Y, [s.xEx, s.dir * (Wi / 2 + t / 2), s.zH], { seg: 24 })); fit.merge(hollowAt(r + 120, r + 5, 20, Y, [s.xEx, s.dir * (Wo / 2 + 10), s.zH], { seg: 24 })); }
      // stack brackets and rain cap
      const top = P.zStackTop, yS = P.roofExit ? s.ya : s.yOut;
      if (P.roofExit) for (let z = zr + 600; z < top - 300; z += 1800) fit.merge(hollowAt(r + 40, r + 3, 60, Z, [s.xEx, yS, z], { seg: 20 }));
      else for (let z = s.zH + 1500; z < top - 300; z += 1800) { fit.merge(hollowAt(r + 40, r + 3, 60, Z, [s.xEx, yS, z], { seg: 20 })); bxe(fit, s.xEx - 25, s.xEx + 25, Math.min(yS, s.dir * Wo / 2), Math.max(yS, s.dir * Wo / 2), z - 25, z + 25); }
      fit.merge(put(new Geo(), cone(r * 1.6, r * 0.2, r * 0.9, 24), s.xEx, yS, top + 0.6 * D));
      for (const a of [0, 2.094, 4.189]) fit.merge(cylAt(6, 0.6 * D, Z, [s.xEx + Math.cos(a) * r * 0.8, yS + Math.sin(a) * r * 0.8, top + 0.3 * D], { seg: 8 }));
      add2('exhaust-bellows' + nm(i), bel, 0x2b2f34); add2('exhaust-silencer' + nm(i), sil, 0xaab0b6); add2('exhaust-pipe' + nm(i), pipe, 0x3a3f45);
      add2('exhaust-lagging' + nm(i), lag, C.alu); add2('exhaust-sleeve-brackets-cap' + nm(i), fit, 0x6b747c);
    });
  }
  // day tank, bund, fuel lines
  const Tk = P.fac.tank;
  if (Tk) {
    const cx = Tk.x0 + Tk.bx / 2, cy = Tk.y1 - Tk.by / 2, bw = 100, tb = zf + Tk.leg, tt = tb + Tk.Ht, bund = new Geo(), tank = new Geo(), pipes = new Geo(), fit = new Geo(), gauge = new Geo();
    bxe(bund, cx - Tk.bx / 2, cx + Tk.bx / 2, cy - Tk.by / 2, cy - Tk.by / 2 + bw, zf, zf + Tk.hB); bxe(bund, cx - Tk.bx / 2, cx + Tk.bx / 2, cy + Tk.by / 2 - bw, cy + Tk.by / 2, zf, zf + Tk.hB);
    bxe(bund, cx - Tk.bx / 2, cx - Tk.bx / 2 + bw, cy - Tk.by / 2 + bw, cy + Tk.by / 2 - bw, zf, zf + Tk.hB); bxe(bund, cx + Tk.bx / 2 - bw, cx + Tk.bx / 2, cy - Tk.by / 2 + bw, cy + Tk.by / 2 - bw, zf, zf + Tk.hB);
    bxe(tank, cx - Tk.Lt / 2, cx + Tk.Lt / 2, cy - Tk.Wt / 2, cy + Tk.Wt / 2, tb, tt);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bxe(tank, cx + sx * (Tk.Lt / 2 - 60) - 30, cx + sx * (Tk.Lt / 2 - 60) + 30, cy + sy * (Tk.Wt / 2 - 60) - 30, cy + sy * (Tk.Wt / 2 - 60) + 30, zf, tb);
    for (const z of [tb + 40, tt - 40]) bxe(tank, cx - Tk.Lt / 2 - 6, cx + Tk.Lt / 2 + 6, cy - Tk.Wt / 2 - 6, cy + Tk.Wt / 2 + 6, z - 12, z + 12);   // stiffener bands
    tank.merge(hollowAt(150, 120, 40, Z, [cx - Tk.Lt * 0.25, cy, tt + 20], { seg: 28 })); tank.merge(cylAt(120, 10, Z, [cx - Tk.Lt * 0.25, cy, tt + 45], { seg: 28 }));   // manway
    const ven = rounded([[cx + Tk.Lt * 0.35, cy, tt], [cx + Tk.Lt * 0.35, cy, tt + 450], [cx + Tk.Lt * 0.35 + 150, cy, tt + 450], [cx + Tk.Lt * 0.35 + 150, cy, tt + 360]], 60);
    pipes.merge(tube(ven, 20, { seg: 14 }));
    const fx = P.fac.fill.x, fz = P.fac.fill.z, wy = Wo / 2;
    pipes.merge(tube(rounded([[fx, cy, tt], [fx, cy, fz], [fx, wy + 280, fz]], 80), 25, { seg: 16 }));
    fit.merge(cylAt(45, 70, Y, [fx, wy + 190, fz], { seg: 18 })); bxe(fit, fx - 8, fx + 8, wy + 190 - 6, wy + 190 + 6, fz, fz + 150);                // fill valve and lever
    fit.merge(cylAt(40, 30, Y, [fx, wy + 295, fz], { seg: 18 }));                                                                                      // cap
    const s0 = P.sets[0], fy = s0.ya + s0.dir * P.S.W / 2, xf = s0.x0 + 0.5 * P.S.L, zo = tb + 150;
    pipes.merge(tube(rounded([[cx + Tk.Lt / 2, cy, zo], [xf, cy, zo], [xf, cy, zf + P.ph + 700], [xf, fy, zf + P.ph + 700]], 70), 16, { seg: 12 }));
    fit.merge(cylAt(28, 90, X, [cx + Tk.Lt / 2 + 80, cy, zo], { seg: 14 })); bxe(fit, cx + Tk.Lt / 2 + 72, cx + Tk.Lt / 2 + 88, cy - 6, cy + 6, zo, zo + 110);   // outlet valve
    fit.merge(cylAt(24, 80, Z, [cx - Tk.Lt / 2 + 80, cy - Tk.Wt / 2 - 30, tb + 60], { seg: 14 })); bxe(fit, cx - Tk.Lt / 2 + 72, cx - Tk.Lt / 2 + 88, cy - Tk.Wt / 2 - 36, cy - Tk.Wt / 2 - 24, tb + 100, tb + 200);          // drain valve
    gauge.merge(cylAt(11, Tk.Ht - 160, Z, [cx + Tk.Lt / 2 + 22, cy - Tk.Wt / 4, tb + Tk.Ht / 2], { seg: 12 }));
    for (const z of [tb + 80, tt - 80]) gauge.merge(cylAt(20, 40, X, [cx + Tk.Lt / 2 + 10, cy - Tk.Wt / 4, z], { seg: 12 }));
    add2('day-tank', tank, 0xc8892a); add2('tank-bund', bund, C.concrete); add2('fuel-pipes', pipes, 0xb5651d); add2('fuel-valves-fittings', fit, C.brass); add2('tank-level-gauge', gauge, C.glass, { opacity: 0.55 });
  }
  // control panel and battery
  const Pn = P.fac.panel;
  if (Pn) {
    const g = new Geo(), dets = new Geo(), glass = new Geo(), cx = Pn.x0 + Pn.w / 2, yf = Pn.y1 - Pn.d, z0 = zf + Pn.base;
    bxe(g, Pn.x0 + 10, Pn.x0 + Pn.w - 10, yf + 10, Pn.y1 - 10, zf, z0); bxe(g, Pn.x0, Pn.x0 + Pn.w, yf, Pn.y1, z0, z0 + Pn.h);
    bxe(dets, Pn.x0 + 60, Pn.x0 + Pn.w - 60, yf - 6, yf, z0 + 100, z0 + Pn.h - 100);                                                              // door panel
    for (let i = 0; i < 5; i++) bxe(dets, Pn.x0 + 140, Pn.x0 + Pn.w - 140, yf - 14, yf - 6, z0 + 100 + i * 14, z0 + 108 + i * 14);              // louvre grille
    bxe(glass, cx - 220, cx + 220, yf - 12, yf - 6, z0 + 1150, z0 + 1550);                                                                            // meter window
    [C.red, 0xe0a020, 0x2fa36b].forEach((c, i) => dets.merge(cylAt(22, 14, Y, [cx - 120 + i * 120, yf - 14, z0 + 960], { seg: 16 })));
    for (const dx of [-120, 0, 120]) dets.merge(cylAt(20, 18, Y, [cx + dx, yf - 15, z0 + 800], { seg: 16 }));
    bxe(dets, Pn.x0 + Pn.w - 100, Pn.x0 + Pn.w - 80, yf - 30, yf - 6, z0 + 850, z0 + 1050);                                                        // handle
    add2('control-panel', g, 0x8c9399); add2('panel-front-details', dets, 0x30363c); add2('panel-glass', glass, C.glass, { opacity: 0.45 });
  }
  const Bt = P.fac.battery;
  if (Bt) {
    const g = new Geo(), bat = new Geo(), ch = new Geo(), y0 = Bt.y1 - Bt.d, y1 = Bt.y1;
    for (const sx of [0, 1]) for (const sy of [0, 1]) bxe(g, Bt.x0 + sx * (Bt.w - 40), Bt.x0 + sx * (Bt.w - 40) + 40, y0 + sy * (Bt.d - 40), y0 + sy * (Bt.d - 40) + 40, zf, zf + Bt.h);
    for (const z of [zf + 200, zf + 500]) bxe(g, Bt.x0, Bt.x0 + Bt.w, y0, y1, z, z + 30);
    for (let i = 0; i < 2; i++) { const x0 = Bt.x0 + 30 + i * (Bt.w / 2 - 15); bxe(bat, x0, x0 + Bt.w / 2 - 45, y0 + 40, y1 - 40, zf + 230, zf + 470); for (const s of [0.25, 0.75]) bat.merge(cylAt(14, 30, Z, [x0 + s * (Bt.w / 2 - 45), (y0 + y1) / 2, zf + 485], { seg: 10 })); }
    bxe(ch, Bt.x0 + 250, Bt.x0 + 650, y1 - 150, y1, zf + 1300, zf + 1800); bxe(ch, Bt.x0 + 300, Bt.x0 + 500, y1 - 156, y1 - 150, zf + 1550, zf + 1700);
    add2('battery-rack', g, 0x4d5760); add2('batteries', bat, 0x1d3a6b); add2('battery-charger', ch, 0xb9bec5);
  }
  // cable trench cover and cables
  const Tr = P.fac.trench;
  if (Tr) {
    const cov = new Geo(), cab = new Geo(), gaps = P.sets.map(s => s.ya), top = zf;
    for (let y = Tr.yB - Tr.w / 2 + 10; y < Tr.yA - 10;) {
      const y1 = Math.min(y + 600, Tr.yA - 10), yc = (y + y1) / 2, near = gaps.some(a => Math.abs(a - yc) < 250 + (y1 - y) / 2);
      if (!near) { bxe(cov, Tr.xc - Tr.w / 2 + 6, Tr.xc + Tr.w / 2 - 6, y + 4, y1 - 4, top - 12, top); for (const k of [-1, 0, 1]) bxe(cov, Tr.xc + k * 100 - 6, Tr.xc + k * 100 + 6, y + 40, y1 - 40, top, top + 4); }
      y = y1;
    }
    for (const s of P.sets) for (const [k, c] of [[-1, 0], [0, 1], [1, 2]]) {
      const tm = setGeo(P, 0).terminal, y = s.ya + k * 35, zb = zf - Tr.depth + 50 + (k + 1) * 25;
      cab.merge(tube(rounded([[s.x0 + tm.x, y, zf + P.ph + tm.z], [Tr.xc + k * 45, y, zf + P.ph + tm.z], [Tr.xc + k * 45, y, zb], [Tr.xc + k * 45, Tr.yA - 120, zb]], 70), 14, { seg: 10 }));
    }
    add2('trench-cover-plates', cov, 0x6e7378); add2('power-cables', cab, 0x16181a);
  }
  // hoist
  const Hh = P.fac.hoist;
  if (Hh) {
    const g = new Geo(), tro = new Geo(), chain = new Geo(), hook = new Geo(), len0 = Hh.x1 - Hh.x0, xc = (Hh.x0 + Hh.x1) / 2, zt = Hh.zTop, zb = zt - Hh.depth;
    bxe(g, Hh.x0, Hh.x1, Hh.y - 60, Hh.y + 60, zt - 14, zt); bxe(g, Hh.x0, Hh.x1, Hh.y - 60, Hh.y + 60, zb, zb + 14); bxe(g, Hh.x0, Hh.x1, Hh.y - 5, Hh.y + 5, zb + 14, zt - 14);
    for (const x of [Hh.x0, Hh.x1 - 20]) bxe(g, x, x + 20, Hh.y - 70, Hh.y + 70, zb - 10, zt);
    for (let x = Hh.x0 + 800; x < Hh.x1 - 400; x += 2000) bxe(g, x - 100, x + 100, Hh.y - 100, Hh.y + 100, zt, zt + 50);                                  // hanger plates
    const hx = Hh.xHook, hz = zb - 140;
    for (const s of [-1, 1]) { bxe(tro, hx - 120, hx + 120, Hh.y + s * 110 - 8, Hh.y + s * 110 + 8, zb - 60, zt + 10); for (const dx of [-80, 80]) tro.merge(cylAt(32, 20, Y, [hx + dx, Hh.y + s * 82, zb + 70], { seg: 16 })); }
    bxe(tro, hx - 150, hx + 150, Hh.y - 120, Hh.y + 120, hz - 130, zb - 60);
    const sw = Hh.zTop - Hh.depth - 140 - 130;
    chain.merge(tube([[hx, Hh.y, hz - 130], [hx, Hh.y, Math.max(zf + 2200, hz - 900)]], 8, { seg: 8 }));
    const zh = Math.max(zf + 2200, hz - 900);
    bxe(hook, hx - 45, hx + 45, Hh.y - 30, Hh.y + 30, zh - 110, zh);
    hook.merge(tube(rounded([[hx, Hh.y, zh - 110], [hx, Hh.y, zh - 190], [hx + 70, Hh.y, zh - 260], [hx + 20, Hh.y, zh - 330], [hx - 50, Hh.y, zh - 270]], 40), 12, { seg: 10 }));
    add2('monorail-beam', g, C.yellow); add2('hoist-trolley', tro, 0xd8a21c); add2('hoist-chain', chain, 0x2a2d30); add2('hoist-hook', hook, 0x23272b);
  }
  // fire kit, lights, vent fan, drain
  if (on(p.fire)) {
    const ex = new Geo(), tr = new Geo(), det = new Geo();
    [[0, C.red], [260, 0x1d1d1d]].forEach(([dy, c], i) => {
      const x = Li / 2 - 130, y = Wi / 2 - 300 - dy, z = zf + 600, g = new Geo();
      g.merge(cylAt(90, 560, Z, [x, y, z], { seg: 24 })); g.merge(cylAt(40, 70, Z, [x, y, z + 315], { seg: 16 })); bxe(g, x - 40, x + 40, y - 10, y + 10, z + 340, z + 365);
      tr.merge(g); bxe(ex, x - 70, x + 70, y - 100, y + 100, z - 40, z - 20);
    });
    for (const [x, y] of [[-Li / 4, 0], [Li / 4, 0]]) det.merge(cylAt(60, 30, Z, [x, y, zc - 15], { seg: 20 }));
    add2('fire-extinguishers', tr, C.red); add2('extinguisher-brackets', ex, C.dark); add2('smoke-detectors', det, 0xe6e6e6);
  }
  if (on(p.lights)) {
    const g = new Geo(), em = new Geo(), rows = P.n === 2 ? [-Wi / 3, Wi / 3] : [-Wi / 5, Wi / 5];
    for (const y of rows) for (let x = -Li / 2 + 1000; x < Li / 2 - 600; x += 2400) bxe(g, x - 600, x + 600, y - 45, y + 45, zc - 60, zc - 10);
    bxe(em, Li / 2 - 80, Li / 2 - 40, P.sets[0].ya - 150, P.sets[0].ya + 150, zf + P.Heq + 60, zf + P.Heq + 140);
    bxe(em, Li / 2 - 700 - 175, Li / 2 - 700 + 175, -Wi / 2 + 4, -Wi / 2 + 34, zf + 2250, zf + 2400);
    add2('led-battens', g, 0xf4f2d8); add2('emergency-and-exit-lights', em, 0x2fa36b);
  }
  if (on(p.vent)) {
    const y = -(Wi / 2 - 500), z = zf + Hi - 700, x = -Li / 2 + 70, g = new Geo(), bl = new Geo();
    g.merge(hollowAt(320, 280, 120, X, [x, y, z], { seg: 36 })); g.merge(cylAt(60, 140, X, [x, y, z], { seg: 20 }));
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.4; bxr(bl, [10, 240, 100], [x, y + Math.sin(a) * 160, z + Math.cos(a) * 160], [90 - a * 180 / Math.PI, 0, 0]); }
    for (const dz of [-250, -125, 0, 125, 250]) bxe(g, x - 70, x - 55, y - 300, y + 300, z + dz - 4, z + dz + 4);
    add2('extraction-fan', g, 0x6b747c); add2('fan-blades', bl, 0x2b3238);
  }
  { const s = P.sets[0], g = new Geo(), x = s.x0 + 0.2 * P.S.L, y = s.ya + s.dir * (P.S.W / 2 + 500); bxe(g, x - 150, x + 150, y - 150, y + 150, zf, zf + 8); for (let i = -2; i <= 2; i++) bxe(g, x + i * 50 - 5, x + i * 50 + 5, y - 150, y + 150, zf + 8, zf + 14); add2('floor-drain-grating', g, 0x3a3f45); }
  return parts;
}
const on = v => +v === 1;
