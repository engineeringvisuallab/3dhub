// Visual mesh of the vertical in-line pump set (vertical-inline-pump): base plate, through pipe with two real flanges, casing, lantern, motor with fins.
// Same port layout as pump.js (flange ports at x = -L/2 and +L/2, z = 0.8 DN), only the casing and the motor have a realistic size (tables in the component json).
import { Geo, box, lathe, tube, hex, hollow } from '../mesh.js';
import { flangeAt } from './flange.js';
import { along, cylAt, hollowAt, part, STEEL, DARK } from './util.js';
const Z = [0, 0, 1], X = [1, 0, 0];
const move = (g, p) => new Geo().merge(g, { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: p });
export function inlinePump({ params: p, color }) {
  const { DN, L, RC, LH, MD, MH } = p, zp = DN * 0.8, out = [];
  const fA = flangeAt(DN, p.PN, [-L / 2, 0, zp], X, { hub: DN * 1.12 }), fB = flangeAt(DN, p.PN, [L / 2, 0, zp], [-1, 0, 0], { hub: DN * 1.12 });
  const inner = fA.T + fA.hubLen, rt = DN * 0.56, tb = DN * 0.12;
  // base plate with two stiffening rails and four anchor bolts
  const base = new Geo().merge(move(box(L, RC * 2, tb), [0, 0, tb / 2]));
  for (const s of [-1, 1]) base.merge(move(box(L, DN * 0.08, DN * 0.1), [0, s * (RC - DN * 0.04), tb + DN * 0.05]));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) base.merge(along(hex(DN * 0.07, DN * 0.06), Z, [sx * (L / 2 - DN * 0.12), sy * (RC - DN * 0.14), tb + DN * 0.03]));
  out.push(part('base-plate', base, 0x4a5560));
  out.push(part('suction-discharge', new Geo().merge(hollowAt(rt, DN / 2, L - 2 * inner, X, [0, 0, zp])), color), part('flange-A', fA, color), part('flange-B', fB, color));
  // casing (volute) turned about the vertical axis, with cover bolts and the seal housing
  const z0 = zp - DN * 0.5, z1 = zp + DN * 0.5, r = RC;
  const cas = new Geo().merge(lathe([[0, z0], [r * 0.86, z0], [r, z0 + DN * 0.08], [r, z1 - DN * 0.08], [r * 0.86, z1], [0, z1]], { smooth: true, seg: 64 }));
  for (let i = 0; i < 12; i++) { const a = 2 * Math.PI * (i + 0.5) / 12; cas.merge(along(hex(DN * 0.045, DN * 0.05), Z, [r * 0.82 * Math.cos(a), r * 0.82 * Math.sin(a), z1 + 2])); }
  cas.merge(cylAt(DN * 0.22, DN * 0.14, Z, [0, 0, z1 + DN * 0.07]));
  out.push(part('casing', cas, color));
  // lantern (coupling guard): four posts and a ring
  const zm = z1 + LH, lant = new Geo();
  for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) lant.merge(cylAt(DN * 0.06, LH, Z, [MD * 0.33 * Math.cos(a), MD * 0.33 * Math.sin(a), z1 + LH / 2]));
  lant.merge(hollowAt(MD * 0.42, MD * 0.38, DN * 0.04, Z, [0, 0, z1 + DN * 0.02])).merge(hollowAt(MD * 0.42, MD * 0.38, DN * 0.04, Z, [0, 0, zm - DN * 0.02]));
  out.push(part('lantern', lant, STEEL));
  // motor: body, cooling fins, fan cover, terminal box, lifting eye
  const rm = MD / 2, motor = new Geo().merge(lathe([[0, zm], [rm, zm], [rm, zm + MH * 0.86], [rm * 0.9, zm + MH * 0.9], [rm * 0.9, zm + MH], [0, zm + MH]], { smooth: false, seg: 64 }));
  const nf = Math.max(6, Math.round(MH / 70));
  for (let i = 1; i < nf; i++) motor.merge(cylAt(rm * 1.025, 14, Z, [0, 0, zm + MH * 0.84 * i / nf]));
  motor.merge(move(box(MD * 0.36, MD * 0.3, MD * 0.3), [rm + MD * 0.1, 0, zm + MH * 0.55]));
  const eye = [], ze = zm + MH + DN * 0.06;
  for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24; eye.push([DN * 0.07 * Math.cos(a), 0, ze + DN * 0.07 * Math.sin(a)]); }
  motor.merge(tube(eye, DN * 0.012, { closed: true, seg: 8 }));
  out.push(part('motor', motor, 0x3a6ea5));
  return out;
}
