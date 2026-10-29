// Visual mesh layer: what the user SEES and exports. Collision, BOM and drawings keep using the simple shapes of the component json.
//   visualOf(comp, params)           -> parts [{ name, color, opacity?, tags, pos: Float32Array, nor: Float32Array, idx: Uint32Array }] in the part's own frame
//   visualItems(assembly, library)   -> the same parts for every instance, with the instance transform T (and the instance id)
// A component gets a real mesh from a builder named in its json ("visual": "<builder>", default = its id). Components without a builder
// (walls, slabs, columns, door ...) are built from their own solid boxes / cylinders, so every component always has a visual mesh.
import { Geo, box, cyl } from '../mesh.js';
import { fromEuler, compose, mulRR, rotEuler } from '../math3.js';
import { evalExpr, evalVec } from '../expr.js';
import { colorOf } from '../colors.js';
import { materialize } from '../generate.js';
import { resolveParams } from '../assembly.js';
import * as pw from './pipework.js';
import * as vv from './valves.js';
import { pump } from './pump.js';
import { inlinePump } from './pump-inline.js';
import { genRoom } from './genroom.js';
import { substation } from './substation.js';

export const BUILDERS = {
  'di-pipe': pw.pipe, 'di-pipe-fl': pw.pipeFl, 'di-bend-90': pw.bend, 'di-bend-45': pw.bend, 'di-tee': pw.tee, 'di-reducer': pw.reducer,
  'blind-flange': pw.blindFlange, 'dismantling-joint': pw.dismantlingJoint,
  'gate-valve': vv.gateValve, 'butterfly-valve': vv.butterflyValve, 'check-valve': vv.checkValve, 'ball-valve': vv.ballValve, 'air-valve': vv.airValve, 'flow-meter': vv.flowMeter,
  'end-suction-pump': pump, 'vertical-inline-pump': inlinePump, 'generator-room': genRoom, substation
};
const AXIS_ROT = { z: [1, 0, 0, 0, 1, 0, 0, 0, 1], x: [0, 0, -1, 0, 1, 0, 1, 0, 0], y: [1, 0, 0, 0, 0, -1, 0, 1, 0] };
const memo = new Map();

// ports with every value a number (generator components already have numbers; json components hold $expressions)
function numericPorts(comp, params, raw) {
  return raw.map(q => ({ ...q, at: q.at.map(v => (typeof v === 'string' ? evalExpr(v, params) : v)), dir: q.dir.map(v => (typeof v === 'string' ? evalExpr(v, params) : v)) }));
}
function pack(geo, name, color, extra = {}) {
  return { name, color, ...extra, pos: Float32Array.from(geo.pos), nor: Float32Array.from(geo.nor), idx: Uint32Array.from(geo.idx) };
}
// fallback: the solid shapes of the component as boxes / cylinders (same size, colour and opacity as before)
function fromShapes(comp, params, shapes) {
  const out = [];
  for (const s of shapes) {
    if ((s.role || 'solid') !== 'solid') continue;
    const at = s.at ? evalVec(s.at, params) : [0, 0, 0];
    let g, T;
    if (s.type === 'cylinder') {
      g = cyl(evalExpr(s.radius, params), evalExpr(s.length, params), { seg: 40 });
      T = { R: mulRR(rotEuler(s.rot || [0, 0, 0]), AXIS_ROT[s.axis || 'z']), t: at };
    } else { const [sx, sy, sz] = evalVec(s.size, params); g = box(sx, sy, sz); T = fromEuler(at, s.rot || [0, 0, 0]); }
    out.push(pack(new Geo().merge(g, T), s.id, s.color ?? colorOf([...(comp.tags || []), ...(s.tags || [])]), { ...(s.opacity !== undefined ? { opacity: s.opacity } : {}), tags: [...(comp.tags || []), ...(s.tags || [])] }));
  }
  return out;
}
export function visualOf(comp, params) {
  const key = comp.id + '|' + JSON.stringify(params);
  let r = memo.get(key);
  if (r) return r;
  const m = materialize(comp, params), b = BUILDERS[comp.visual || comp.id];
  if (b) {
    const color = (comp.shapes || m.shapes).find(s => s.color !== undefined)?.color ?? m.shapes.find(s => s.color !== undefined)?.color ?? colorOf(comp.tags || []);
    const parts = b({ comp, params, ports: numericPorts(comp, params, m.ports), color });
    r = parts.map(p => pack(p.geo, p.name, p.color ?? color, { tags: comp.tags || [], ...(p.opacity !== undefined ? { opacity: p.opacity } : {}) }));
  } else r = fromShapes(comp, params, m.shapes);
  if (memo.size > 300) memo.clear();
  memo.set(key, r);
  return r;
}
export function visualItems(assembly, library) {
  const out = [];
  for (const i of assembly.instances) {
    const comp = library[i.component]; if (!comp) throw new Error('unknown component ' + i.component);
    const T = fromEuler(i.pos || [0, 0, 0], i.rot || [0, 0, 0]);
    for (const p of visualOf(comp, resolveParams(comp, i.params))) out.push({ inst: i.id, T, part: p, ...p });   // part = the cached object (viewer caches GPU geometry by it)
  }
  return out;
}
export function partsBounds(parts) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.pos[i + k]); hi[k] = Math.max(hi[k], p.pos[i + k]); }
  return { min: lo, max: hi };
}
