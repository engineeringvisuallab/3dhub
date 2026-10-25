// Real flange: ring with a bore, a bolt circle of real holes and a short hub. Local frame: mating face at z = 0, the body goes towards +z.
import { Geo, lathe, flip, frame, hex, cyl } from '../mesh.js';
import { flangeData, PIPE_OD } from './flange-data.js';
const TAU = Math.PI * 2;

// the flat ring (both faces, outer edge, bore, holes) as one Geo
function ringWithHoles(Ro, Ri, kc, nb, hr, T) {
  const g = new Geo(), h = Math.PI / nb, M = 16;
  const c = [kc, 0];                                     // hole centre of the wedge that sits on +X
  const angs = new Set(); for (let k = 0; k < M; k++) angs.add(+(TAU * k / M).toFixed(9));
  const corners = [[Ro * Math.cos(h), Ro * Math.sin(h)], [Ro * Math.cos(h), -Ro * Math.sin(h)]];
  if (Ri > 0.5) corners.push([Ri * Math.cos(h), Ri * Math.sin(h)], [Ri * Math.cos(h), -Ri * Math.sin(h)]);
  else corners.push([0, 0]);
  for (const q of corners) { let a = Math.atan2(q[1] - c[1], q[0] - c[0]); if (a < 0) a += TAU; angs.add(+a.toFixed(9)); }
  const list = [...angs].sort((a, b) => a - b);
  const sideN = [[-Math.sin(h), Math.cos(h)], [-Math.sin(h), -Math.cos(h)]];
  const ring = list.map(a => {                           // first point where the ray from the hole centre leaves the wedge
    const d = [Math.cos(a), Math.sin(a)], cd = c[0] * d[0] + c[1] * d[1], cc = c[0] * c[0] + c[1] * c[1];
    let best = Infinity;
    const disc = cd * cd - (cc - Ro * Ro); if (disc >= 0) { const t = -cd + Math.sqrt(disc); if (t > 1e-9) best = Math.min(best, t); }
    if (Ri > 0.5) { const di = cd * cd - (cc - Ri * Ri); if (di >= 0) { const t = -cd - Math.sqrt(di); if (t > 1e-9) best = Math.min(best, t); } }
    for (const n of sideN) { const dn = d[0] * n[0] + d[1] * n[1]; if (dn > 1e-12) { const t = -(c[0] * n[0] + c[1] * n[1]) / dn; if (t > 1e-9) best = Math.min(best, t); } }
    return { a, H: [c[0] + hr * d[0], c[1] + hr * d[1]], B: [c[0] + best * d[0], c[1] + best * d[1]] };
  });
  const outer = [], inner = [];
  for (const r of ring) { const m = Math.hypot(r.B[0], r.B[1]); if (Math.abs(m - Ro) < 1e-4) outer.push(r.B); else if (Ri > 0.5 && Math.abs(m - Ri) < 1e-4) inner.push(r.B); }
  const polar = p => Math.atan2(p[1], p[0]); outer.sort((p, q) => polar(p) - polar(q)); inner.sort((p, q) => polar(p) - polar(q));
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  for (let j = 0; j < nb; j++) {
    const ph = TAU * j / nb;
    for (const [z, up] of [[0, false], [T, true]]) {    // z = 0 mating face (normal -Z), z = T back face (normal +Z)
      const nn = [0, 0, up ? 1 : -1];
      const Hs = ring.map(r => { const p = rot(r.H, ph); return g.v([p[0], p[1], z], nn); }), Bs = ring.map(r => { const p = rot(r.B, ph); return g.v([p[0], p[1], z], nn); });
      for (let k = 0; k < ring.length; k++) {
        const k2 = (k + 1) % ring.length;
        if (up) { g.tri(Hs[k], Bs[k], Bs[k2]); g.tri(Hs[k], Bs[k2], Hs[k2]); } else { g.tri(Hs[k], Bs[k2], Bs[k]); g.tri(Hs[k], Hs[k2], Bs[k2]); }
      }
    }
    for (const k of ring.keys()) {                       // hole wall (normal points to the hole axis)
      const a0 = ring[k].a, a1 = k + 1 < ring.length ? ring[k + 1].a : TAU + ring[0].a;
      const P = (a, z) => { const p = rot([c[0] + hr * Math.cos(a), c[1] + hr * Math.sin(a)], ph); return [p[0], p[1], z]; };
      const N = a => { const n = rot([-Math.cos(a), -Math.sin(a)], ph); return [n[0], n[1], 0]; };
      const A = g.v(P(a0, 0), N(a0)), B = g.v(P(a1, 0), N(a1)), C = g.v(P(a1, T), N(a1)), D = g.v(P(a0, T), N(a0));
      g.q(A, D, C, B);
    }
    const wall = (pts, outward) => {                     // outer edge or bore: pieces of this wedge, joined to the neighbour at the corner points
      for (let i = 0; i + 1 < pts.length; i++) {
        const [p, q] = [rot(pts[i], ph), rot(pts[i + 1], ph)], nrm = s => { const l = Math.hypot(s[0], s[1]); return outward ? [s[0] / l, s[1] / l, 0] : [-s[0] / l, -s[1] / l, 0]; };
        const A = g.v([p[0], p[1], 0], nrm(p)), B = g.v([q[0], q[1], 0], nrm(q)), C = g.v([q[0], q[1], T], nrm(q)), D = g.v([p[0], p[1], T], nrm(p));
        outward ? g.q(A, B, C, D) : g.q(A, D, C, B);
      }
    };
    wall(outer, true); if (Ri > 0.5) wall(inner, false);
  }
  return g;
}

// DN, PN -> Geo. opts: blind (no bore), hub (pipe outside diameter: adds a tapered hub that joins the barrel, hub length is returned as hubLen)
export function flange(DN, PN = 16, opts = {}) {
  const f = flangeData(DN, PN), Ri = opts.blind ? 0 : DN / 2, g = ringWithHoles(f.OD / 2, Ri, f.k / 2, f.n, f.hole / 2, f.T);
  let hubLen = 0;
  if (opts.hub) {
    const ro = opts.hub / 2; hubLen = Math.round(25 + DN * 0.06);
    const rh = ro + 10 + DN * 0.03;
    g.merge(lathe([[Ri, f.T], [rh, f.T], [ro, f.T + hubLen], [Ri, f.T + hubLen], [Ri, f.T]], { seg: 48, smooth: false }));
  }
  g.T = f.T; g.hubLen = hubLen; g.data = f; return g;
}
// place a flange so its mating face is at `at` and the body extends along `dir` (unit vector pointing INTO the part)
export const flangeAt = (DN, PN, at, dir, opts) => { const g = flange(DN, PN, opts), o = new Geo().merge(g, frame(dir, at)); o.T = g.T; o.hubLen = g.hubLen; o.data = g.data; return o; };
// bolt-hole angles in the flange frame (frame(): local Y = up): holes straddle the vertical centre line
export const boltAngle = (n, j) => Math.PI / 2 + Math.PI / n + TAU * j / n;
export { PIPE_OD, flangeData };
