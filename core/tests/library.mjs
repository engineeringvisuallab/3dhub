// Library test: every component listed in core/library/components/manifest.json is valid and builds at its limits,
// every file in the folder is listed, and every flanged part attaches to a DN300 flanged pipe.
import { readFileSync, readdirSync } from 'node:fs';
import { resolveParams } from '../engine/assembly.js';
import { materialize } from '../engine/generate.js';
import { evalExpr } from '../engine/expr.js';
import { autoAttach, brokenLinks } from '../engine/snap.js';
import { check } from '../engine/collision.js';
const dir = new URL('../library/components/', import.meta.url);
const J = f => JSON.parse(readFileSync(new URL(f, dir)));
const prules = JSON.parse(readFileSync(new URL('../rules/port-rules.json', import.meta.url)));
const crules = JSON.parse(readFileSync(new URL('../rules/conflict-rules.json', import.meta.url)));
let fail = 0; const t = (name, cond, info = '') => { if (!cond) { console.log('FAIL ' + name + (info ? '  ' + info : '')); fail++; } return cond; };

const manifest = J('manifest.json').components;
t('manifest has no duplicate ids', new Set(manifest).size === manifest.length);
const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'manifest.json').map(f => f.slice(0, -5));
for (const f of files) t(`${f}.json is listed in manifest.json`, manifest.includes(f));
for (const id of manifest) t(`${id} listed in manifest.json has a file`, files.includes(id));

const lib = {}, ROLES = ['solid', 'void', 'clearance'], num = (v, p) => { const n = evalExpr(v, p); if (!Number.isFinite(n)) throw new Error('not a number: ' + v); return n; };
function combos(c) {
  const out = [{}]; if (c.generator) return out; // generator parts have linked options: default only here (pipefit.mjs / door.mjs cover them)
  for (const [k, d] of Object.entries(c.parameters || {})) {
    if (typeof d.min === 'number') out.push({ [k]: d.min }, { [k]: d.max });
    for (const o of d.options || []) out.push({ [k]: o !== null && typeof o === 'object' ? o.v : o });
  }
  for (const d of Object.values(c.derived || {})) { const P = c.parameters[d.from]; for (const key of Object.keys(d.table)) if (+key >= P.min && +key <= P.max) out.push({ [d.from]: +key }); }
  return out;
}
for (const id of manifest) {
  let c; try { c = lib[id] = J(id + '.json'); } catch (e) { t(id + ' reads as json', false, e.message); continue; }
  for (const k of ['id', 'name', 'category', 'units', 'shapes']) t(`${id}: has ${k}`, !!c[k] || k === 'shapes' && Array.isArray(c.shapes));
  t(`${id}: id equals file name`, c.id === id); t(`${id}: units mm`, c.units === 'mm');
  let n = 0;
  for (const over of combos(c)) {
    try {
      const p = resolveParams(c, over), m = materialize(c, p);
      for (const s of m.shapes) {
        if (!ROLES.includes(s.role || 'solid')) throw new Error(s.id + ': bad role ' + s.role);
        if (s.type === 'box') s.size.forEach(v => { if (!(num(v, p) > 0)) throw new Error(s.id + ': size must be > 0'); });
        else if (s.type === 'cylinder') { if (!(num(s.radius, p) > 0 && num(s.length, p) > 0)) throw new Error(s.id + ': radius/length must be > 0'); }
        else throw new Error(s.id + ': unknown shape type ' + s.type);
        (s.at || [0, 0, 0]).forEach(v => num(v, p));
      }
      const seen = new Set();
      for (const pt of m.ports) {
        if (seen.has(pt.id)) throw new Error('duplicate port ' + pt.id); seen.add(pt.id);
        if (!(pt.type in prules.mates)) throw new Error(`port ${pt.id}: type "${pt.type}" is not in port-rules.json`);
        pt.at.forEach(v => num(v, p)); if (Math.abs(Math.hypot(...pt.dir.map(v => num(v, p))) - 1) > 1e-3) throw new Error(`port ${pt.id}: dir is not a unit vector`);
        if (pt.type === 'flange') for (const k of ['DN', 'PN', 'std']) if (pt[k] === undefined) throw new Error(`flange port ${pt.id} has no ${k}`);
      }
      n++;
    } catch (e) { t(`${id} ${JSON.stringify(over)}`, false, e.message); }
  }
  t(`${id}: builds`, n > 0);
}

// every part with a flange port attaches to a DN300 PN16 flanged pipe, with no broken link and no conflict
const pipe = { name: 't', units: 'mm', links: [], instances: [{ id: 'P1', component: 'di-pipe-fl', params: { DN: 300, len: 2000 }, pos: [0, 0, 0], rot: [0, 0, 0] }] };
for (const id of manifest) {
  const c = lib[id]; if (!c || id === 'di-pipe-fl') continue;
  let flanged = false; try { flanged = materialize(c, resolveParams(c, {})).ports.some(p => p.type === 'flange'); } catch { /* reported above */ }
  if (!flanged) continue;
  const r = autoAttach(pipe, lib, 'P1', id, prules, {});
  if (!t(`${id}: attaches to a flanged pipe`, !r.error, r.error)) continue;
  t(`${id}: attached, no broken link`, brokenLinks(r.assembly, lib, prules).length === 0);
  const rep = check(r.assembly, lib, crules); t(`${id}: attached, no conflict`, rep.conflicts.length === 0, JSON.stringify(rep.conflicts).slice(0, 200));
}
console.log(fail ? `${fail} FAILED` : `all passed (${manifest.length} components)`); process.exit(fail ? 1 : 0);
