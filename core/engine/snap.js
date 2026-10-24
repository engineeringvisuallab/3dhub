// Attach logic: select an object in the scene, click a model in the "3D models" tab (or drop it on the object)
// -> the new model snaps onto a free, compatible port of the selected object. User can move it afterwards.
import { instanceParams, resolveParams } from './assembly.js';
import { materialize } from './generate.js';
import { evalExpr, evalVec } from './expr.js';
import { fromEuler, compose, apply, mulRV, rotFromTo, rotAxis, mulRR, eulerFromR, sub, norm, len, dot } from './math3.js';

const clone = o => JSON.parse(JSON.stringify(o));
function worldPort(inst, comp, params, pd) {
  const T = fromEuler(inst.pos || [0,0,0], inst.rot || [0,0,0]);
  const fld = k => pd[k] === undefined ? undefined : (typeof pd[k] === 'string' && pd[k][0] === '$' ? evalExpr(pd[k], params) : pd[k]);
  return { id: pd.id, type: pd.type, DN: fld('DN'), PN: fld('PN'), std: pd.std,
    p: apply(T, evalVec(pd.at, params)), d: norm(mulRV(T.R, pd.dir)) };
}
export function worldPorts(assembly, id, library) {
  const inst = assembly.instances.find(i => i.id === id), comp = library[inst.component], params = instanceParams(inst, library);
  return materialize(comp, params).ports.map(pd => ({ inst: id, ...worldPort(inst, comp, params, pd) }));
}
export const usedPorts = assembly => new Set((assembly.links || []).flatMap(l => [l.a, l.b]));
export function compatible(A, B, rules) {
  if (!(rules.mates[A.type] || []).includes(B.type)) return 'type ' + A.type + ' cannot mate ' + B.type;
  for (const k of rules.mustMatch) if (A[k] !== undefined && B[k] !== undefined && A[k] !== B[k]) return `${k} ${A[k]} <> ${B[k]}`;
  return null;
}
function portDefs(comp, params) { // ports to try, in default size (generator components compute them from parameters)
  if (!comp.generator) return comp.ports || [];
  return materialize(comp, resolveParams(comp, params || {})).ports;
}
export function autoAttach(assembly, library, selectedId, componentId, rules, opts = {}) {
  const comp = library[componentId], used = usedPorts(assembly), reasons = [];
  if (!comp) return { error: 'unknown component ' + componentId };
  const freePorts = worldPorts(assembly, selectedId, library).filter(p => !used.has(p.inst + '.' + p.id));
  if (!freePorts.length) return { error: 'selected object has no free port', reasons };
  for (const A of freePorts) for (const pd0 of [...portDefs(comp, opts.params)].sort((x, y) => dot(x.dir, A.d) - dot(y.dir, A.d))) { // prefer the port that faces A: no extra rotation
    // adopt size: bind parameters used as "$name" in the new port to the selected port's value
    const over = { ...(opts.params || {}) };
    for (const k of rules.mustMatch) if (typeof pd0[k] === 'string' && pd0[k][0] === '$' && A[k] !== undefined) over[pd0[k].slice(1)] = A[k];
    let params; try { params = resolveParams(comp, over); } catch (e) { reasons.push(`${A.inst}.${A.id} -> ${componentId}.${pd0.id}: ${e.message}`); continue; }
    const pd = comp.generator ? (materialize(comp, params).ports.find(x => x.id === pd0.id) || pd0) : pd0; // generated ports depend on the resolved parameters
    const probe = { id: '_', component: componentId, params: over, pos: [0,0,0], rot: [0,0,0] };
    const B0 = worldPort(probe, comp, params, pd);
    const why = compatible(A, B0, rules); if (why) { reasons.push(`${A.inst}.${A.id} -> ${componentId}.${pd.id}: ${why}`); continue; }
    // rotate so B0.d == -A.d, then roll, then translate so ports coincide
    let R = rotFromTo(B0.d, A.d.map(v => -v));
    if (opts.roll) R = mulRR(rotAxis(A.d, opts.roll), R);
    const pos = sub(A.p, mulRV(R, B0.p));
    const id = opts.id || nextId(assembly, componentId);
    const inst = { id, component: componentId, params: over, pos: pos.map(v => +v.toFixed(3)), rot: eulerFromR(R).map(v => +v.toFixed(4)) };
    const out = clone(assembly); out.instances.push(inst); (out.links ||= []).push({ a: A.inst + '.' + A.id, b: id + '.' + pd.id });
    return { assembly: out, instance: inst, link: out.links.at(-1) };
  }
  return { error: `${componentId} does not fit any free port of ${selectedId}`, reasons };
}
export function nextId(assembly, base) { let n = 1; const ids = new Set(assembly.instances.map(i => i.id)); while (ids.has(`${base}-${n}`)) n++; return `${base}-${n}`; }

// Move freely. withAttached=true drags everything connected through links; false detaches (links removed) and reports it.
export function moveInstance(assembly, id, delta, { withAttached = false } = {}) {
  const out = clone(assembly), ids = new Set([id]);
  if (withAttached) { let grow = true; while (grow) { grow = false; for (const l of out.links || []) {
    const a = l.a.split('.')[0], b = l.b.split('.')[0];
    if (ids.has(a) !== ids.has(b)) { ids.add(a); ids.add(b); grow = true; } } } }
  for (const i of out.instances) if (ids.has(i.id)) i.pos = i.pos.map((v, k) => v + delta[k]);
  const detached = [];
  if (!withAttached) out.links = (out.links || []).filter(l => { const hit = l.a.split('.')[0] === id || l.b.split('.')[0] === id; if (hit) detached.push(l); return !hit; });
  for (const r of out.rebarSets || []) if (ids.has(r.host)) { /* rebar follows host automatically (host-local) */ }
  return { assembly: out, moved: [...ids], detached };
}
// Links whose ports no longer coincide (after manual edits)
export function brokenLinks(assembly, library, rules) {
  return (assembly.links || []).filter(l => {
    const [ai, ap] = l.a.split('.'), [bi, bp] = l.b.split('.');
    const A = worldPorts(assembly, ai, library).find(p => p.id === ap), B = worldPorts(assembly, bi, library).find(p => p.id === bp);
    return len(sub(A.p, B.p)) > rules.gapTol_mm || dot(A.d, B.d) > -0.999;
  });
}
