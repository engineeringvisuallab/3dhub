import { readFileSync } from 'node:fs';
import { check } from '../engine/collision.js';
import { evalExpr } from '../engine/expr.js';
import { columnCage, schedule } from '../engine/rebar.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const lib = {}; for (const f of ['rcc-column','rcc-wall-opening','di-pipe','table']) lib[f] = J('library/components/' + f + '.json');
const rules = J('rules/conflict-rules.json');
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const clone = o => JSON.parse(JSON.stringify(o));

t('expr', evalExpr('max($a*2, 10) + ($b/2)', { a: 3, b: 8 }) === 14);

const col = J('examples/column-with-rebar.assembly.json');
let r = check(col, lib, rules);
t('column + cage: no conflicts', r.ok && r.warnings.length === 0, JSON.stringify(r.conflicts.concat(r.warnings)).slice(0, 200));
const bars = columnCage({ b: 300, h: 450, H: 3000, cover: 40, nx: 3, ny: 2 });
console.log('     bar schedule', JSON.stringify(schedule(bars).map(s => `${s.kind} d${s.dia} x${s.count} ${s.kg.toFixed(1)}kg`)));

let c2 = clone(col); c2.rebarSets[0].params = { cover: 15 }; c2.rebarSets[0].minCover = 40;
r = check(c2, lib, rules);
t('cover 15 < 40 is flagged', r.warnings.some(w => w.kind === 'rebar-cover') || r.conflicts.some(w => w.kind === 'rebar-cover'));

let c3 = clone(col); c3.instances.push({ id: 'C2', component: 'rcc-column', params: { b: 300, h: 450, H: 3000 }, pos: [100, 0, 1500] });
r = check(c3, lib, rules);
t('two columns overlapping: conflict', !r.ok);

const pw = J('examples/pipe-through-wall.assembly.json');
r = check(pw, lib, rules);
t('pipe through wall opening: OK', r.ok && r.warnings.length === 0, JSON.stringify(r.conflicts).slice(0, 200));

let p2 = clone(pw); p2.instances[1].params.OD = 420;
r = check(p2, lib, rules);
t('pipe 420 in 400 opening: conflict', !r.ok);

let p3 = clone(pw); p3.instances[1].pos = [900, 0, 400];
r = check(p3, lib, rules);
t('pipe moved into solid wall: conflict', !r.ok);

let p4 = clone(pw); p4.instances.push({ id: 'T1', component: 'table', params: {}, pos: [-1000, -1000, 0] });
r = check(p4, lib, rules);
t('table clear of wall: ok', r.ok);
p4.instances[2].pos = [-1000, 0, 700];
r = check(p4, lib, rules);
t('table inside wall: conflict', !r.ok);
p4.instances[2].pos = [0, 0, 1000];
r = check(p4, lib, rules);
t('table in pipe opening: flagged', !r.ok || r.warnings.length > 0);

// ---- attach / snap tests ----
import { autoAttach, moveInstance, brokenLinks, worldPorts } from '../engine/snap.js';
const prules = J('rules/port-rules.json');
for (const f of ['di-pipe-fl','gate-valve']) lib[f] = J('library/components/' + f + '.json');
let s0 = { units: 'mm', instances: [ { id: 'P1', component: 'di-pipe-fl', params: { DN: 200, len: 2000 }, pos: [0,0,0], rot: [0,0,0] } ], links: [] };
let a = autoAttach(s0, lib, 'P1', 'gate-valve', prules);
t('click gate valve on pipe: attaches', !!a.assembly, a.error);
t('valve adopts pipe DN 200', a.instance && a.instance.params.DN === 200);
t('ports coincide, no broken link', a.assembly && brokenLinks(a.assembly, lib, prules).length === 0);
t('valve placed at first free pipe end (|y| = 1000 + FTF/2)', a.instance && Math.abs(Math.abs(a.instance.pos[1]) - 1115) < 0.01, JSON.stringify(a.instance && a.instance.pos));
let a2 = autoAttach(a.assembly, lib, 'P1', 'gate-valve', prules);
t('second valve goes to the other free end', !!a2.assembly && a2.instance.pos[1] * a.instance.pos[1] < 0, a2.error);
let a3 = a2.assembly && autoAttach(a2.assembly, lib, 'P1', 'gate-valve', prules);
t('third valve rejected: no free port', a3 && !!a3.error);
let r0 = { ...s0, instances: [ { ...s0.instances[0], rot: [0,0,90] } ] };
let ar = autoAttach(r0, lib, 'P1', 'gate-valve', prules);
t('rotated pipe: valve still mates and handwheel stays up', ar.assembly && brokenLinks(ar.assembly, lib, prules).length === 0 && Math.abs(Math.abs(ar.instance.rot[0]) + Math.abs(ar.instance.rot[1])) < 1e-3, JSON.stringify(ar.instance && ar.instance.rot));
let wrong = autoAttach({ ...s0, instances: [ { ...s0.instances[0], params: { DN: 200, PN: 10, len: 2000 } } ] }, lib, 'P1', 'gate-valve', { ...prules, mustMatch: ['DN','PN','std'] });
t('valve PN16 on PN10 pipe: adopts PN, still fits', !!wrong.assembly && wrong.instance.params.PN === 10);
let mv = moveInstance(a.assembly, 'P1', [0, 0, 500], { withAttached: true });
t('move with attached keeps links intact', mv.detached.length === 0 && brokenLinks(mv.assembly, lib, prules).length === 0);
let mv2 = moveInstance(a.assembly, a.instance.id, [300, 0, 0]);
t('free move detaches the link and reports it', mv2.detached.length === 1 && mv2.assembly.links.length === 0);
let cf = check(a.assembly, lib, rules);
t('pipe + valve attached: no conflicts', cf.ok, JSON.stringify(cf.conflicts).slice(0,200));

// ---- save / load / export ----
import { serialize, parse } from '../engine/io.js';
import { toOBJ, toGLB } from '../engine/export.js';
import { flatten } from '../engine/assembly.js';
for (const f of ['brick-wall','door']) lib[f] = J('library/components/' + f + '.json');
const rt = parse(serialize(a.assembly), lib);
t('save then load: same instances and links', JSON.stringify(rt.instances) === JSON.stringify(a.assembly.instances) && JSON.stringify(rt.links) === JSON.stringify(a.assembly.links));
t('loaded assembly still has no conflicts', check(rt, lib, rules).ok);
const bad = (txt) => { try { parse(txt, lib); return false; } catch (e) { return e.message; } };
t('load rejects non-JSON', !!bad('not json'));
t('load rejects unknown model', /unknown model/.test(bad(JSON.stringify({ units: 'mm', instances: [{ id: 'X', component: 'nope', pos: [0,0,0] }] }))));
t('load rejects out-of-range parameter', /above max|below min/.test(bad(JSON.stringify({ units: 'mm', instances: [{ id: 'X', component: 'brick-wall', params: { L: 99999 }, pos: [0,0,0] }] }))));
t('load rejects link to missing object', /missing object/.test(bad(JSON.stringify({ units: 'mm', instances: [], links: [{ a: 'Z.A', b: 'Z.B' }] }))));
const wl = { name: 'w', units: 'mm', links: [], instances: [{ id: 'w0', component: 'brick-wall', params: {}, pos: [0,0,0], rot: [0,0,0] }] };
const items = flatten(wl, lib).items;
const glb = toGLB(items), dvv = new DataView(glb.buffer);
const jl = dvv.getUint32(12, true), gj = JSON.parse(new TextDecoder().decode(glb.slice(20, 20 + jl)));
t('GLB header, length and JSON chunk are valid', dvv.getUint32(0, true) === 0x46546C67 && dvv.getUint32(8, true) === glb.length && gj.asset.version === '2.0' && gj.accessors.length === 3);
t('GLB wall is 3 m long in metres (Y-up)', Math.abs(gj.accessors[0].max[0] - gj.accessors[0].min[0] - 3) < 1e-4 && Math.abs(gj.accessors[0].max[1] - gj.accessors[0].min[1] - 3) < 1e-4);
const obj = toOBJ(items).split('\n');
t('OBJ has 24 vertices and 12 triangles for a box', obj.filter(l => l.startsWith('v ')).length === 24 && obj.filter(l => l.startsWith('f ')).length === 12);
console.log(fail ? `\n${fail} FAILED` : '\nall passed'); process.exit(fail ? 1 : 0);
