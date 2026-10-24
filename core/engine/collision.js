// Conflict checker. Results: { conflicts:[], warnings:[], ok:boolean }
//  roles: solid (real material) | void (opening/sleeve, belongs to an instance) | rebar | clearance (soft zone)
//  rules: see core/rules/conflict-rules.json
import { apply, applyInv } from './math3.js';
import { flatten } from './assembly.js';

const sdfW = (it, p) => it.shape.sdf(applyInv(it.T, p));
const worldPts = (it, step) => it.shape.sample(step).map(p => apply(it.T, p));
function aabb(it) {
  const h = it.shape.aabbHalf(), R = it.T.R, e = [0,1,2].map(i => Math.abs(R[i*3])*h[0] + Math.abs(R[i*3+1])*h[1] + Math.abs(R[i*3+2])*h[2]);
  return { lo: it.T.t.map((v, i) => v - e[i]), hi: it.T.t.map((v, i) => v + e[i]) };
}
const hit = (a, b, m = 0) => [0,1,2].every(i => a.lo[i] <= b.hi[i] + m && b.lo[i] <= a.hi[i] + m);

export function check(assembly, library, rules) {
  const tol = rules.tolerance_mm ?? 0.5, step = rules.sampleStep_mm ?? 60, minCover = rules.rebar?.minCover_mm ?? 25;
  const { items, instances } = flatten(assembly, library);
  items.forEach(it => { it.box = aabb(it); });
  const voidsOf = {}; items.filter(i => i.role === 'void').forEach(v => (voidsOf[v.inst] ||= []).push(v));
  const conflicts = [], warnings = [];
  const inMaterial = (host, p, own) => sdfW(host, p) < (own ? 1e-6 : -tol) && !(voidsOf[host.inst] || []).some(v => sdfW(v, p) < 0);
  // depth of `a` sunk into the material of `b` (0 if none); also reports stray use of an opening
  function depth(a, b) {
    let d = 0;
    for (const p of worldPts(a, step)) if (inMaterial(a, p, true) && inMaterial(b, p)) d = Math.max(d, -sdfW(b, p));
    return d;
  }
  const pairSeen = new Set();
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.role === 'void' || b.role === 'void') continue;
    if (a.group === b.group && a.role !== 'rebar') continue;             // inside one component: author's responsibility
    if (a.role === 'rebar' && b.role === 'rebar' && a.group === b.group && (a.inst === b.inst || rules.rebar?.ignoreSameSet)) continue;
    if (!hit(a.box, b.box, tol)) continue;
    const key = [a.inst, b.inst, a.role, b.role].join('|'); if (pairSeen.has(key)) continue;
    const dd = Math.max(depth(a, b), depth(b, a));
    if (dd <= tol) continue;
    pairSeen.add(key);
    const rec = (kind, msg, extra = {}) => ({ kind, a: a.inst, b: b.inst, depth_mm: +dd.toFixed(1), msg, ...extra });
    const [r, o] = a.role === 'rebar' ? [a, b] : b.role === 'rebar' ? [b, a] : [null, null];
    if (r && o.role === 'solid') {
      if (r.host === o.inst) continue;                                    // embedded in own host: cover check below
      conflicts.push(rec('rebar-in-foreign-solid', `rebar ${r.inst} passes through ${o.inst}`)); continue;
    }
    if (a.role === 'clearance' || b.role === 'clearance') { warnings.push(rec('clearance', `${a.inst} / ${b.inst} intrude into a clearance zone`)); continue; }
    conflicts.push(rec('overlap', `${a.inst} overlaps ${b.inst}`));
  }
  // anything standing in an opening that does not accept it
  for (const v of items.filter(i => i.role === 'void' && i.accepts.length)) for (const it of items) {
    if (it.inst === v.inst || it.role === 'void' || it.role === 'clearance' || !hit(it.box, aabb(v), 0)) continue;
    if (worldPts(it, step).some(p => sdfW(v, p) < -tol) && !it.tags.some(t => v.accepts.includes(t)))
      warnings.push({ kind: 'wrong-in-opening', a: it.inst, b: v.inst, msg: `${it.inst} sits in an opening of ${v.inst} that accepts only [${v.accepts}]` });
  }
  // rebar cover (must be inside host, with minimum cover on every face)
  const worst = new Map();
  for (const it of items.filter(i => i.role === 'rebar')) {
    const host = items.find(h => h.inst === it.host && h.role === 'solid'); if (!host) continue;
    let m = Infinity;
    for (const p of worldPts(it, step)) m = Math.min(m, -sdfW(host, p));      // distance from bar surface to host face
    const k = it.group; worst.set(k, Math.min(worst.get(k) ?? Infinity, m));
  }
  for (const [set, m] of worst) {
    const s = (assembly.rebarSets || []).find(r => r.id === set), need = s.minCover ?? minCover;
    if (m < need - tol) (m < 0 ? conflicts : warnings).push({ kind: 'rebar-cover', a: set, b: s.host, cover_mm: +m.toFixed(1), msg: `rebar set ${set}: cover ${m.toFixed(1)} mm < required ${need} mm` });
  }
  return { ok: conflicts.length === 0, conflicts, warnings, itemCount: items.length };
}
