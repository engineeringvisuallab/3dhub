// Visual meshes for valves and the flow meter. Flow runs along Y, up is +Z, flanges at y = -FTF/2 and +FTF/2 (same as the ports).
// Sizes follow the DN / FTF / FOD tables of the components; the handwheel height follows the clearance zone of the component.
import { Geo, box, cyl, hollow, lathe, tube, sphere, frame, hex, cone, flip } from '../mesh.js';
import { apply, rotAxis } from '../math3.js';
import { flangeAt, boltAngle, flangeData } from './flange.js';
import { along, cylAt, hollowAt, part, wheel, RED, STEEL, BRIGHT, DARK } from './util.js';
const Z = [0, 0, 1], Y = [0, 1, 0];
const move = (g, p) => new Geo().merge(g, { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: p });
const ends = (p, hub) => [flangeAt(p.DN, p.PN, [0, -p.FTF / 2, 0], [0, 1, 0], { hub }), flangeAt(p.DN, p.PN, [0, p.FTF / 2, 0], [0, -1, 0], { hub })];
// a ring of small hex bolt heads on a horizontal circle (bonnet / cover bolts)
function boltRing(n, rc, z, size) {
  const g = new Geo();
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * (i + 0.5) / n; g.merge(along(hex(size, size * 0.8), Z, [rc * Math.cos(a), rc * Math.sin(a), z])); }
  return g;
}

export function gateValve({ params: p, color }) {
  const { DN, FTF, FOD } = p, [fA, fB] = ends(p, DN * 1.12), T = fA.T, yb = FTF / 2 - T;
  const rb = FOD * 0.40, rn = yb * 0.95, zn = rb + DN * 0.10, zf = zn + DN * 0.06, zb = zf + DN * 0.22;
  const zw = FOD / 2 + DN * 0.9 - 40, rw = DN * 0.45, rs = Math.max(8, DN * 0.035);
  const body = new Geo();
  body.merge(hollowAt(rb, DN / 2, 2 * yb, Y, [0, 0, 0], { smooth: true }));
  body.merge(cylAt(rn, zn, Z, [0, 0, zn / 2]));
  body.merge(cylAt(rn * 1.25, DN * 0.06, Z, [0, 0, zn + DN * 0.03]));                                  // bonnet flange
  body.merge(boltRing(8, rn * 1.1, zf + 6, Math.max(9, DN * 0.04)));
  body.merge(lathe([[0, zf], [rn * 0.85, zf], [rn * 0.7, zb - 20], [DN * 0.11, zb], [DN * 0.08, zw - DN * 0.04], [0, zw - DN * 0.04]], { smooth: true, seg: 40 }));   // bonnet + stem cover
  const sz0 = zw - DN * 0.04, sz1 = zw + 20 + p.open * DN * 0.22, stem = cylAt(rs * 0.7, sz1 - sz0, Z, [0, 0, (sz0 + sz1) / 2]);
  const hw = wheel(rw, Math.max(8, DN * 0.03), zw, 0, 0, 4);
  stem.merge(along(hex(rs * 1.5, rs * 1.3), Z, [0, 0, sz1]));
  return [part('body', body, color), part('flange-A', fA, color), part('flange-B', fB, color), part('stem', stem, BRIGHT), part('handwheel', hw, RED)];
}
export function butterflyValve({ params: p, color }) {
  const { DN, FTF, FOD } = p, [fA, fB] = ends(p, DN * 1.1), T = fA.T, yb = Math.max(FTF / 2 - T, 5), ro = DN / 2 + 34;
  const zg = FOD / 2 + 300, zn0 = ro - 10, gb = [250, 190, 200];
  const body = new Geo();
  body.merge(hollowAt(ro, DN / 2, 2 * yb, Y, [0, 0, 0]));
  body.merge(cylAt(55, zg - gb[2] / 2 - zn0 + 10, Z, [0, 0, (zg - gb[2] / 2 + zn0 - 10) / 2]));                 // neck
  body.merge(cylAt(80, 30, Z, [0, 0, zn0 + 20]));
  const gear = new Geo().merge(move(box(...gb), [0, 0, zg])).merge(along(cyl(gb[1] * 0.42, gb[0] * 0.9, [1, 0, 0]), [1, 0, 0], [0, 0, zg + gb[2] * 0.4]));
  const zw = FOD / 2 + 620, shaft = cylAt(16, zw - (zg + gb[2] / 2), Z, [0, 0, (zw + zg + gb[2] / 2) / 2]);
  const tilt = 35 * Math.PI / 180, discDir = [-Math.sin(tilt), Math.cos(tilt), 0];                          // disc turned 35 degrees from closed (a fully open disc would reach past the flange faces)
  const disc = cylAt(DN / 2 - 6, Math.max(18, DN * 0.06), discDir, [0, 0, 0], { seg: 56 }), stemRod = cylAt(Math.max(12, DN * 0.04), 2 * ro, Z, [0, 0, 0]);
  const out = [part('body', body, color), part('flange-A', fA, color), part('flange-B', fB, color), part('gearbox', gear, 0x1e4f9a), part('spindle', shaft, BRIGHT), part('handwheel', wheel(160, 10, zw), RED)];
  out.push(part('valve-disc', disc, BRIGHT), part('disc-stem', stemRod, STEEL));
  return out;
}
export function checkValve({ params: p, color }) {
  const { DN, FTF, FOD } = p, [fA, fB] = ends(p, DN * 1.1), T = fA.T, yb = FTF / 2 - T, rb = FOD * 0.42;
  const rc = yb * 0.9, zc = rb + DN * 0.1, body = new Geo();
  body.merge(hollowAt(rb, DN / 2, 2 * yb, Y, [0, 0, 0], { smooth: true }));
  body.merge(cylAt(rc, zc, Z, [0, 0, zc / 2]));
  body.merge(cylAt(rc * 1.18, DN * 0.05, Z, [0, 0, zc + DN * 0.025]));                                  // cover plate
  body.merge(boltRing(8, rc * 1.05, zc + DN * 0.06, Math.max(9, DN * 0.04)));
  body.merge(lathe([[0, zc + DN * 0.05], [rc, zc + DN * 0.05], [rc * 0.9, zc + DN * 0.10], [rc * 0.55, zc + DN * 0.16], [0, zc + DN * 0.18]], { smooth: true, seg: 40 }));
  const flap = cylAt(DN / 2 * 0.92, 14, [0, Math.cos(0.35), Math.sin(0.35)], [0, yb * 0.15, DN * 0.05], { seg: 48 });   // flap hanging a little open
  return [part('body', body, color), part('flange-A', fA, color), part('flange-B', fB, color), part('flap', flap, STEEL)];
}
export function ballValve({ params: p, color }) {
  const { DN, FTF, FOD } = p, [fA, fB] = ends(p, DN * 1.1), T = fA.T, yb = FTF / 2 - T, rb = DN * 0.52;
  const prof = [];                                                                                          // ellipse revolved around Y: half length yb, radius rb
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI * i / 16; prof.push([DN / 2 + (rb - DN / 2) * Math.cos(a), yb * Math.sin(a)]); }
  const shell = lathe([...prof, prof[0]], { seg: 56, smooth: true });
  const body = new Geo().merge(shell, frame(Y)), zn = FOD / 2 + 120;
  body.merge(cylAt(Math.max(35, DN * 0.1), zn - rb + 30, Z, [0, 0, (zn + rb - 30) / 2]));
  const lever = new Geo().merge(move(box(DN * 1.0, 40, 24), [DN * 0.45, 0, FOD / 2 + 140])).merge(along(cyl(22, DN * 0.26, [1, 0, 0]), [1, 0, 0], [DN * 0.82, 0, FOD / 2 + 140]));
  const stemNut = along(hex(30, 30), Z, [0, 0, FOD / 2 + 160]);
  return [part('body', body, color), part('flange-A', fA, color), part('flange-B', fB, color), part('lever', lever, RED), part('stem-nut', stemNut, STEEL)];
}
export function airValve({ params: p, color }) {
  const { DN } = p, f = flangeAt(DN, p.PN, [0, 0, 0], Z, { hub: DN * 0.62 }), T = f.T, h = f.hubLen;
  const z0 = T + h, body = lathe([[0, z0], [DN * 0.5, z0], [DN * 0.5, z0 + DN * 0.15], [DN * 0.45, z0 + DN * 0.3], [DN * 0.45, z0 + DN * 1.25], [DN * 0.34, z0 + DN * 1.5], [DN * 0.34, z0 + DN * 1.62], [0, z0 + DN * 1.62]], { smooth: true, seg: 56 });
  const top = new Geo().merge(lathe([[0, z0 + DN * 1.62], [DN * 0.36, z0 + DN * 1.62], [DN * 0.36, z0 + DN * 1.69], [0, z0 + DN * 1.69]], { seg: 56 }));
  const dome = lathe(Array.from({ length: 9 }, (_, i) => { const a = Math.PI / 2 * i / 8; return [DN * 0.22 * Math.cos(a), z0 + DN * 1.69 + DN * 0.22 * Math.sin(a)]; }).concat([[0, z0 + DN * 1.69]]), { smooth: true, seg: 40 });
  const boltsG = boltRing(8, DN * 0.3, z0 + DN * 1.69, Math.max(8, DN * 0.03));
  return [part('body', new Geo().merge(body).merge(top).merge(boltsG), color), part('flange', f, color), part('hood', dome, RED)];
}
export function flowMeter({ params: p, color }) {
  const { DN, FTF, FOD } = p, [fA, fB] = ends(p, DN * 1.1), T = fA.T, yb = FTF / 2 - T, ro = DN / 2 + 26, zt = FOD / 2 + 215;
  const body = new Geo();
  body.merge(hollowAt(ro, DN / 2, 2 * yb, Y, [0, 0, 0]));
  body.merge(hollowAt(ro + DN * 0.10, ro, yb * 0.9, Y, [0, 0, 0]));                                     // coil housing band
  body.merge(cylAt(48, zt - 110 - ro, Z, [0, 0, (zt - 110 + ro) / 2]));
  const trx = new Geo().merge(move(box(250, 170, 220), [0, 0, zt])).merge(move(box(8, 150, 100), [129, 0, zt + 10]));
  return [part('tube', body, color), part('flange-A', fA, color), part('flange-B', fB, color), part('transmitter', trx, 0x2b3b57)];
}
