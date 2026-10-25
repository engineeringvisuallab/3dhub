// Assembly = placed instances of library components + rebar sets. flatten() turns it into
// world-space collision items.
import { evalExpr, evalVec } from './expr.js';
import { fromEuler, compose, rotFromTo, sub, len, add, scale, rotEuler, mulRR } from './math3.js';
import { materialize, validateParams } from './generate.js';
import { makeShape } from './shapes.js';
import { TEMPLATES } from './rebar.js';

const AXIS_ROT = { z: [1,0,0, 0,1,0, 0,0,1], x: [0,0,-1, 0,1,0, 1,0,0], y: [1,0,0, 0,0,-1, 0,1,0] };

export function resolveParams(comp, over = {}) {
  const p = {};
  for (const [k, d] of Object.entries(comp.parameters || {})) {
    const v = over[k] ?? d.default;
    if (d.options) { // choice parameter: options are plain values or { v, label }
      const vals = d.options.map(o => (o !== null && typeof o === 'object' ? o.v : o));
      if (!vals.includes(v)) throw new Error(`${comp.id}.${k}="${v}" is not one of: ${vals.join(', ')}`);
    }
    if (d.min !== undefined && v < d.min) throw new Error(`${comp.id}.${k}=${v} below min ${d.min}`);
    if (d.max !== undefined && v > d.max) throw new Error(`${comp.id}.${k}=${v} above max ${d.max}`);
    p[k] = v;
  }
  // derived values from standard tables, e.g. { "FTF": { "from": "DN", "table": { "300": 270 } } }
  for (const [k, d] of Object.entries(comp.derived || {})) {
    if (!(String(p[d.from]) in d.table)) throw new Error(`${comp.id}: no ${k} in table for ${d.from}=${p[d.from]}`);
    p[k] = d.table[String(p[d.from])];
  }
  validateParams(comp, p); // generator components check combinations (e.g. wall height vs door height)
  return p;
}
function shapeItem(def, params, instT, meta) {
  let local; // transform of the shape inside the instance
  if (def.type === 'cylinder') {
    // optional rot (degrees) turns the cylinder after its axis is chosen, e.g. a hinge pin on a swinging door leaf
    local = { R: mulRR(rotEuler(def.rot || [0,0,0]), AXIS_ROT[def.axis || 'z']), t: def.at ? evalVec(def.at, params) : [0,0,0] };
    return { ...meta, shape: makeShape({ type: 'cylinder', radius: evalExpr(def.radius, params), length: evalExpr(def.length, params) }), T: compose(instT, local) };
  }
  local = fromEuler(def.at ? evalVec(def.at, params) : [0,0,0], def.rot || [0,0,0]);
  return { ...meta, shape: makeShape({ type: 'box', size: evalVec(def.size, params) }), T: compose(instT, local) };
}
export function instanceParams(inst, library) { return resolveParams(library[inst.component], inst.params); }
export function flatten(assembly, library) {
  const items = [], inst = {};
  for (const i of assembly.instances) {
    const comp = library[i.component]; if (!comp) throw new Error('unknown component ' + i.component);
    const params = resolveParams(comp, i.params);
    const T = fromEuler(i.pos || [0,0,0], i.rot || [0,0,0]);
    inst[i.id] = { ...i, comp, params, T };
    for (const s of materialize(comp, params).shapes) items.push(shapeItem(s, params, T, {
      inst: i.id, id: s.id, role: s.role || 'solid', ...(s.color !== undefined ? { color: s.color } : {}), ...(s.opacity !== undefined ? { opacity: s.opacity } : {}), tags: [...(comp.tags || []), ...(s.tags || [])], accepts: s.accepts || [], group: i.id }));
  }
  const bars = [];
  for (const rs of assembly.rebarSets || []) {
    const host = inst[rs.host]; if (!host) throw new Error('rebar set host not found: ' + rs.host);
    if (!(host.comp.tags || []).includes('host')) throw new Error(rs.host + ' is not a rebar host');
    const gen = TEMPLATES[rs.template]; if (!gen) throw new Error('unknown rebar template ' + rs.template);
    const hp = host.params;
    for (const b of gen({ ...hp, ...(rs.params || {}) })) {
      const bid = rs.id + '/' + b.id; bars.push({ ...b, id: bid, set: rs.id, host: rs.host });
      for (let k = 1; k < b.path.length; k++) {
        const a = b.path[k-1], c = b.path[k], d = sub(c, a), L = len(d); if (L < 1e-6) continue;
        const mid = scale(add(a, c), 0.5);
        const local = { R: rotFromTo([0,0,1], d), t: mid };
        items.push({ inst: bid, id: 'seg' + k, role: 'rebar', tags: ['rebar'], accepts: [], host: rs.host, group: rs.id,
          shape: makeShape({ type: 'cylinder', radius: b.dia / 2, length: L }), T: compose(host.T, local), dia: b.dia });
      }
    }
  }
  return { items, instances: inst, bars };
}
