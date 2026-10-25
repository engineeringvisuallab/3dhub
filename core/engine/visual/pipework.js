// Visual meshes for pipes and fittings: hollow barrels, flanges with real bolt holes, a real torus bend, tee, cone reducer.
// Everything is derived from the same parameters and ports as the collision shapes, so the end faces sit exactly on the ports.
import { Geo, hollow, tube, arcPoints, flip, cyl, lathe, frame } from '../mesh.js';
import { norm, scale, mulRV, apply } from '../math3.js';
import { flangeAt, boltAngle, flangeData } from './flange.js';
import { along, cylAt, hollowAt, part, STEEL, BRIGHT } from './util.js';
import { hex } from '../mesh.js';
const wallOf = OD => Math.max(5, OD * 0.03);
const port = (ports, id) => ports.find(p => p.id === id);

export function pipe({ params: p, color }) { // di-pipe: hollow plain-end barrel along Y
  const ro = p.OD / 2;
  return [part('barrel', hollowAt(ro, ro - wallOf(p.OD), p.len, [0, 1, 0], [0, 0, 0]), color)];
}
export function pipeFl({ params: p, color }) {
  const ro = p.OD / 2, ri = p.DN / 2, e = [
    flangeAt(p.DN, p.PN, [0, -p.len / 2, 0], [0, 1, 0], { hub: p.OD }), flangeAt(p.DN, p.PN, [0, p.len / 2, 0], [0, -1, 0], { hub: p.OD })];
  const inner = e[0].T + e[0].hubLen, L = p.len - 2 * inner;
  const out = [part('barrel', hollowAt(ro, ri, Math.max(L, 1), [0, 1, 0], [0, 0, 0]), color)];
  out.push(part('flange-A', e[0], color), part('flange-B', e[1], color));
  return out;
}
export function bend({ params: p, ports, color }) {
  const A = port(ports, 'A'), B = port(ports, 'B'), a = Math.hypot(...A.at), b = B.dir, theta = Math.round(Math.acos(Math.max(-1, Math.min(1, b[0]))) * 180 / Math.PI);
  const ro = p.OD / 2, ri = p.DN / 2, fA = flangeAt(p.DN, p.PN, A.at, [1, 0, 0], { hub: p.OD }), fB = flangeAt(p.DN, p.PN, B.at, scale(b, -1), { hub: p.OD });
  const inner = fA.T + fA.hubLen, k = Math.tan(theta * Math.PI / 360);
  const Rb = Math.min(p.DN, (a - inner - 10) / k), tl = Rb * k, n = norm([0, b[1], b[2]]);
  const C = [-tl + n[0] * Rb, n[1] * Rb, n[2] * Rb], pts = arcPoints(C, Rb, scale(n, -1), [1, 0, 0], theta, 24);
  const body = new Geo().merge(tube(pts, ro, { seg: 36, caps: false })).merge(flip(tube(pts, ri, { seg: 36, caps: false })));
  const L = a - inner - tl;
  if (L > 1) { body.merge(hollowAt(ro, ri, L, [1, 0, 0], [(-a + inner - tl) / 2, 0, 0])); body.merge(hollowAt(ro, ri, L, b, scale(b, (tl + a - inner) / 2))); }
  return [part('body', body, color), part('flange-A', fA, color), part('flange-B', fB, color)];
}
export function tee({ params: p, ports, color }) {
  const A = port(ports, 'A'), C = port(ports, 'C'), h = Math.hypot(...A.at), t = C.dir, ro = p.OD / 2, ri = p.DN / 2;
  const fl = ['A', 'B', 'C'].map(id => { const q = port(ports, id); return flangeAt(p.DN, p.PN, q.at, scale(q.dir, -1), { hub: p.OD }); });
  const inner = fl[0].T + fl[0].hubLen, body = new Geo();
  body.merge(hollowAt(ro, ri, 2 * (h - inner), [1, 0, 0], [0, 0, 0]));
  body.merge(hollowAt(ro * 0.985, ri, h - inner, t, scale(t, (h - inner) / 2)));   // branch a hair thinner so the two barrels do not share a surface
  return [part('body', body, color), ...fl.map((g, i) => part('flange-' + 'ABC'[i], g, color))];
}
export function reducer({ params: p, ports, color }) {
  const A = port(ports, 'A'), L = 2 * Math.abs(A.at[0]), fA = flangeAt(p.DN, p.PN, A.at, [1, 0, 0], { hub: p.OD }), fB = flangeAt(p.DN2, p.PN, port(ports, 'B').at, [-1, 0, 0], { hub: p.OD2 });
  const x0 = -L / 2 + fA.T + fA.hubLen, x1 = L / 2 - fB.T - fB.hubLen;
  const cone = lathe([[p.DN / 2, x0], [p.OD / 2, x0], [p.OD2 / 2, x1], [p.DN2 / 2, x1], [p.DN / 2, x0]], { seg: 48, smooth: false });
  // the lathe above has its axis on Z; turn it onto X (frame() keeps the up direction)
  return [part('cone', new Geo().merge(cone, frame([1, 0, 0])), color), part('flange-A', fA, color), part('flange-B', fB, color)];
}
export function blindFlange({ params: p, color }) {
  const f = flangeAt(p.DN, p.PN, [0, -p.T / 2, 0], [0, 1, 0], { blind: true });
  return [part('disc', f, color)];
}
export function dismantlingJoint({ params: p, color }) {
  const f = flangeData(p.DN, p.PN), ro = p.OD / 2, ri = p.DN / 2, H = p.FTF / 2, rods = new Geo();
  const fA = flangeAt(p.DN, p.PN, [0, -H, 0], [0, 1, 0], { hub: p.OD }), fB = flangeAt(p.DN, p.PN, [0, H, 0], [0, -1, 0], { hub: p.OD });
  const inner = f.T + fA.hubLen, L = Math.max(2 * (H - inner), 1), tieY = -p.FTF * 0.08, tieT = f.T * 0.9;
  const body = new Geo();
  body.merge(hollowAt(ro, ri, L, [0, 1, 0], [0, 0, 0]));
  body.merge(hollowAt(f.OD / 2 * 0.9, ro, tieT, [0, 1, 0], [0, tieY, 0]));                       // tie flange on the spigot piece
  const cy0 = tieY + tieT / 2, cy1 = H - inner;
  if (cy1 > cy0) body.merge(hollowAt(ro + 24, ro, cy1 - cy0, [0, 1, 0], [0, (cy0 + cy1) / 2, 0])); // flange adapter collar
  const y0 = tieY, y1 = H - f.T, rr = f.hole / 2 - 1, Fr = frame([0, 1, 0], [0, 0, 0]);
  for (const j of [0, f.n / 4, f.n / 2, 3 * f.n / 4]) {
    const al = boltAngle(f.n, j), pc = apply(Fr, [f.k / 2 * Math.cos(al), f.k / 2 * Math.sin(al), 0]);
    rods.merge(cylAt(rr, y1 - y0, [0, 1, 0], [pc[0], (y0 + y1) / 2, pc[2]]));
    for (const y of [y0 - f.hole * 0.4, y1 + f.hole * 0.4]) rods.merge(along(hex(f.hole * 0.95, f.hole * 0.8), [0, 1, 0], [pc[0], y, pc[2]]));
  }
  return [part('body', body, color), part('flange-A', fA, color), part('flange-B', fB, color), part('tie-rods', rods, STEEL)];
}
