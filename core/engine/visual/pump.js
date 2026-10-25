// Visual mesh of the pump set (vertical in-line pump with the motor on top, standing on a base frame).
// The two flange ports sit at x = -L/2 and +L/2, z = 0.8 DN, exactly as in the collision envelope of end-suction-pump.json.
import { Geo, box, cyl, lathe, tube, sphere, hex, hollow } from '../mesh.js';
import { flangeAt } from './flange.js';
import { along, cylAt, hollowAt, part, STEEL, BRIGHT, DARK } from './util.js';
const Z = [0, 0, 1], X = [1, 0, 0];
const move = (g, p) => new Geo().merge(g, { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: p });
export function pump({ params: p, color }) {
  const { DN, L } = p, zp = DN * 0.8, fA = flangeAt(DN, p.PN, [-L / 2, 0, zp], X, { hub: DN * 1.12 }), fB = flangeAt(DN, p.PN, [L / 2, 0, zp], [-1, 0, 0], { hub: DN * 1.12 });
  const inner = fA.T + fA.hubLen, rt = DN * 0.56, out = [];
  const base = new Geo().merge(move(box(L, DN * 1.2, DN * 0.08), [0, 0, DN * 0.04]));
  for (const s of [-1, 1]) base.merge(move(box(L, DN * 0.1, DN * 0.12), [0, s * DN * 0.55, DN * 0.14]));
  for (const x of [-0.36, 0, 0.36]) base.merge(move(box(DN * 0.08, DN * 1.2, DN * 0.1), [x * L, 0, DN * 0.13]));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) base.merge(along(hex(DN * 0.07, DN * 0.06), Z, [sx * (L / 2 - DN * 0.1), sy * DN * 0.5, DN * 0.21]));
  out.push(part('base-frame', base, 0x4a5560));
  const pipes = new Geo().merge(hollowAt(rt, DN / 2, L - 2 * inner, X, [0, 0, zp]));
  out.push(part('suction-discharge', pipes, color), part('flange-A', fA, color), part('flange-B', fB, color));
  const z0 = zp - DN * 0.36, z1 = zp + DN * 0.36, r = DN * 0.6;
  const casing = lathe([[0, z0], [r * 0.86, z0], [r, z0 + DN * 0.07], [r, z1 - DN * 0.07], [r * 0.86, z1], [0, z1]], { smooth: true, seg: 56 });
  const cas = new Geo().merge(casing);
  for (let i = 0; i < 8; i++) { const a = 2 * Math.PI * (i + 0.5) / 8; cas.merge(along(hex(DN * 0.045, DN * 0.05), Z, [r * 0.8 * Math.cos(a), r * 0.8 * Math.sin(a), z1 + 2])); }
  cas.merge(cylAt(DN * 0.2, DN * 0.3, Z, [0, 0, z1 + DN * 0.15]));                                   // seal housing
  out.push(part('casing', cas, color));
  const zm = DN * 1.4, rm = DN * 0.45, lant = new Geo();
  for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) lant.merge(cylAt(DN * 0.05, zm - z1, Z, [DN * 0.26 * Math.cos(a), DN * 0.26 * Math.sin(a), (zm + z1) / 2]));
  out.push(part('lantern', lant, STEEL));
  const motor = new Geo().merge(lathe([[0, zm], [rm, zm], [rm, zm + DN * 0.72], [rm * 0.86, zm + DN * 0.78], [rm * 0.86, zm + DN * 0.88], [0, zm + DN * 0.88]], { smooth: false, seg: 56 }));
  for (const dz of [0.15, 0.3, 0.45, 0.6]) motor.merge(cylAt(rm * 1.03, DN * 0.025, Z, [0, 0, zm + DN * dz]));
  motor.merge(move(box(DN * 0.2, DN * 0.2, DN * 0.16), [rm + DN * 0.06, 0, zm + DN * 0.48]));          // terminal box
  const eye = [], ze = zm + DN * 0.88 + DN * 0.07;                                                // lifting eye
  for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24; eye.push([DN * 0.07 * Math.cos(a), 0, ze + DN * 0.07 * Math.sin(a)]); }
  motor.merge(tube(eye, DN * 0.012, { closed: true, seg: 8 }));
  out.push(part('motor', motor, 0x3a6ea5));
  return out;
}
