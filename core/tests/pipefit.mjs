// Pump house tests: pipe fittings (bend, tee, reducer, dismantling joint, check / butterfly valve), choose-a-port attach,
// rotate-with-group, beam on column, and a whole pump line built by clicking (autoAttach) with no broken link and no conflict.
import { readFileSync, writeFileSync } from 'node:fs';
import { autoAttach, brokenLinks, worldPorts, rotateInstance, moveInstance } from '../engine/snap.js';
import { check } from '../engine/collision.js';
import { resolveParams } from '../engine/assembly.js';
import { materialize } from '../engine/generate.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const IDS = ['di-pipe-fl', 'gate-valve', 'end-suction-pump', 'di-bend-90', 'di-bend-45', 'di-tee', 'di-reducer', 'dismantling-joint', 'check-valve', 'butterfly-valve', 'rcc-column', 'rcc-beam', 'rcc-slab', 'brick-wall', 'pump-plinth'];
const lib = {}; for (const id of IDS) lib[id] = J('library/components/' + id + '.json');
const prules = J('rules/port-rules.json'), crules = J('rules/conflict-rules.json');
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const near = (a, b, e = 0.01) => a.every((v, i) => Math.abs(v - b[i]) < e);
const start = (id, comp, params = {}, pos = [0, 0, 0]) => ({ name: 't', units: 'mm', links: [], instances: [{ id, component: comp, params, pos, rot: [0, 0, 0] }] });
const add = (asm, sel, comp, opts) => { const r = autoAttach(asm, lib, sel, comp, prules, opts); if (r.error) throw new Error(`${sel} + ${comp}: ${r.error} ${(r.reasons || []).join('; ')}`); return r; };
const portOf = (asm, inst, pid) => worldPorts(asm, inst, lib).find(p => p.id === pid);

// ---- every new part builds with default parameters and valid ports
for (const id of ['di-bend-90', 'di-bend-45', 'di-tee', 'di-reducer', 'dismantling-joint', 'check-valve', 'butterfly-valve', 'rcc-beam']) {
  const m = materialize(lib[id], resolveParams(lib[id], {}));
  t(`${id}: default builds, ${m.shapes.length} shapes, ${m.ports.length} ports`, m.shapes.length > 0 && m.ports.length >= 2 && m.ports.every(p => p.dir.length === 3 && p.at.length === 3 && (lib[id].generator ? p.at.every(Number.isFinite) : true)));
}
// every size in the table
for (const DN of [100, 150, 200, 250, 300, 400, 500, 600]) for (const id of ['di-bend-90', 'di-bend-45', 'di-tee', 'check-valve', 'butterfly-valve', 'dismantling-joint'])
  try { materialize(lib[id], resolveParams(lib[id], { DN })); } catch (e) { t(`${id} DN${DN}`, false, e.message); }
t('all table sizes build for 6 fittings', true);

// ---- bend: all four turns attach to a horizontal pipe and point the right way
const dirs = { up: [0, 0, 1], down: [0, 0, -1], left: null, right: null };
for (const turn of ['up', 'down', 'left', 'right']) {
  let a = start('P1', 'di-pipe-fl', { DN: 300, len: 2000 }); // pipe runs along Y; its B end faces +Y
  a = add(a, 'P1', 'di-bend-90', { params: { turn } }).assembly;
  const bend = a.instances[1], out = portOf(a, bend.id, bend.id === 'x' ? '' : 'B');
  t(`bend turn=${turn}: no broken link`, brokenLinks(a, lib, prules).length === 0);
  if (dirs[turn]) t(`bend turn=${turn}: outlet points ${turn}`, near(out.d, dirs[turn], 1e-6), JSON.stringify(out.d));
  else t(`bend turn=${turn}: outlet horizontal and sideways`, Math.abs(out.d[2]) < 1e-6 && Math.abs(out.d[1]) < 1e-6 && Math.abs(Math.abs(out.d[0]) - 1) < 1e-6, JSON.stringify(out.d));
}
{ let l = start('P1', 'di-pipe-fl', { DN: 300, len: 2000 }); const L = add(l, 'P1', 'di-bend-90', { params: { turn: 'left' } }).assembly, R = add(l, 'P1', 'di-bend-90', { params: { turn: 'right' } }).assembly;
  const dl = portOf(L, L.instances[1].id, 'B').d, dr = portOf(R, R.instances[1].id, 'B').d;
  t('left and right turns point opposite ways', near(dl, dr.map(v => -v), 1e-6)); }
// ---- bend adopts the pipe size; 45 degree bend goes diagonally up
{ let a = start('P1', 'di-pipe-fl', { DN: 150, len: 1500, PN: 10 }); a = add(a, 'P1', 'di-bend-45', { params: { turn: 'up' }, fromPort: 'B' }).assembly;
  const b = a.instances[1], o = portOf(a, b.id, 'B');
  t('45 bend adopts DN150 / PN10', b.params.DN === 150 && b.params.PN === 10);
  t('45 bend outlet rises at 45 degrees', Math.abs(o.d[2] - Math.SQRT1_2) < 1e-6 && Math.abs(o.d[1] - Math.SQRT1_2) < 1e-6, JSON.stringify(o.d)); }
// ---- tee: branch up, run keeps flowing
{ let a = start('P1', 'di-pipe-fl', { DN: 200, len: 1500 }); a = add(a, 'P1', 'di-tee', { params: { branch: 'up' } }).assembly;
  const id = a.instances[1].id;
  t('tee has 3 ports and branch C points up', near(portOf(a, id, 'C').d, [0, 0, 1], 1e-6) && worldPorts(a, id, lib).length === 3);
  const b = add(a, id, 'gate-valve', { fromPort: 'C' }).assembly;
  t('gate valve on the tee branch (fromPort C) stands vertical', brokenLinks(b, lib, prules).length === 0 && Math.abs(portOf(b, b.instances[2].id, 'A').d[2]) > 0.999); }
// ---- reducer rules
{ let a = start('P1', 'di-pipe-fl', { DN: 300, len: 1500 }); const r = add(a, 'P1', 'di-reducer');
  const red = r.instance;
  const rp = resolveParams(lib['di-reducer'], red.params);
  t('reducer big end adopts DN300, outlet DN200', rp.DN === 300 && rp.DN2 === 200 && portOf(r.assembly, red.id, 'B').DN === 200, JSON.stringify(rp));
  const p2 = add(r.assembly, red.id, 'di-pipe-fl');
  t('pipe after the reducer adopts DN200', p2.instance.params.DN === 200 && brokenLinks(p2.assembly, lib, prules).length === 0, JSON.stringify(p2.instance.params));
  let a2 = start('P1', 'di-pipe-fl', { DN: 150, len: 1500 }); const r2 = add(a2, 'P1', 'di-reducer');
  t('reducer on a DN150 pipe: big end cannot be 150/200, so it turns round (small end on the pipe)', resolveParams(lib['di-reducer'], r2.instance.params).DN2 === 150 && resolveParams(lib['di-reducer'], r2.instance.params).DN === 300, JSON.stringify(r2.instance.params));
  let bad = false; try { resolveParams(lib['di-reducer'], { DN: 200, DN2: 200 }); } catch (e) { bad = /smaller than/.test(e.message); }
  t('reducer DN 200 to 200 is blocked', bad);
  bad = false; try { resolveParams(lib['di-reducer'], { DN: 600, DN2: 100 }); } catch (e) { bad = /too steep/.test(e.message); }
  t('reducer 600 to 100 is blocked (too steep)', bad); }
// ---- dismantling joint adjusts length; size mismatch is refused
{ let a = start('P1', 'di-pipe-fl', { DN: 250, len: 1500 }); const j = add(a, 'P1', 'dismantling-joint', { params: { FTF: 400 } });
  t('dismantling joint: DN adopted, length 400', j.instance.params.DN === 250 && j.instance.params.FTF === 400 && brokenLinks(j.assembly, lib, prules).length === 0);
  let bad = false; try { resolveParams(lib['dismantling-joint'], { FTF: 900 }); } catch (e) { bad = /above max/.test(e.message); }
  t('dismantling joint longer than 600 mm is blocked', bad);
  const s = { ...a, instances: [{ ...a.instances[0] }, { id: 'V1', component: 'gate-valve', params: { DN: 200 }, pos: [0, 0, 0], rot: [0, 0, 0] }] };
  t('DN250 pipe and DN200 valve do not mate', autoAttach(start('P1', 'di-pipe-fl', { DN: 250 }), lib, 'P1', 'gate-valve', { ...prules }, { params: { DN: 200 } }).assembly.instances[1].params.DN === 250); }
// ---- choose the port: second valve on a chosen end
{ let a = start('P1', 'di-pipe-fl', { DN: 200, len: 2000 });
  const ra = add(a, 'P1', 'gate-valve', { fromPort: 'B' }), rb = add(a, 'P1', 'gate-valve', { fromPort: 'A' });
  t('fromPort B and A put the valve on opposite ends', ra.instance.pos[1] * rb.instance.pos[1] < 0 && ra.link.a === 'P1.B' && rb.link.a === 'P1.A');
  const bad = autoAttach(ra.assembly, lib, 'P1', 'gate-valve', prules, { fromPort: 'B' });
  t('fromPort that is already used is refused', !!bad.error && /not free/.test(bad.error)); }
// ---- rotate with the group keeps every link
{ let a = start('P1', 'di-pipe-fl', { DN: 200, len: 1500 }, [1000, 500, 300]);
  a = add(a, 'P1', 'butterfly-valve', { fromPort: 'B' }).assembly; a = add(a, 'P1', 'di-bend-90', { params: { turn: 'up' }, fromPort: 'A' }).assembly;
  const r = rotateInstance(a, 'P1', 90, { withAttached: true });
  t('rotate 90 with attached parts: nothing detached, links intact', r.detached.length === 0 && brokenLinks(r.assembly, lib, prules).length === 0 && r.moved.length === 3);
  const r4 = [1, 2, 3, 4].reduce((s) => rotateInstance(s, 'P1', 90, { withAttached: true }).assembly, a);
  t('four turns of 90 degrees come back to the start', r4.instances.every((i, k) => near(i.pos, a.instances[k].pos, 0.02)) && brokenLinks(r4, lib, prules).length === 0);
  const rf = rotateInstance(a, 'P1', 90);
  t('rotate without attached parts detaches and says so', rf.detached.length === 2); }
// ---- beam on column, slab on beam
{ let a = start('C1', 'rcc-column', { H: 3000 }, [0, 0, 1500]);
  const b = add(a, 'C1', 'rcc-beam', { fromPort: 'top' });
  t('beam sits on the column top (bearing meets face-v)', b.instance.pos[2] === 3000 && brokenLinks(b.assembly, lib, prules).length === 0, JSON.stringify(b.instance.pos));
  const s = add(b.assembly, b.instance.id, 'rcc-slab', { fromPort: 'T' });
  t('slab sits on the beam top', Math.abs(s.instance.pos[2] - (3000 + 450)) < 0.01 && brokenLinks(s.assembly, lib, prules).length === 0);
  t('column + beam: no conflicts', check(b.assembly, lib, crules).ok, JSON.stringify(check(b.assembly, lib, crules).conflicts).slice(0, 200)); }
// ---- a whole pump line, built by clicking, with levels
{ let a = { name: 'pump-line', units: 'mm', links: [], instances: [
    { id: 'S1', component: 'rcc-slab', params: { L: 6000, W: 5000, T: 200 }, pos: [0, 0, 0], rot: [0, 0, 0] },
    ], links: [] };
  a = add(a, 'S1', 'pump-plinth', { fromPort: 'T', params: { L: 720, W: 700, T: 150 } }).assembly; // pump stands on a plinth: its flanged fittings clear the floor
  a.instances.push({ id: 'PUMP', component: 'end-suction-pump', params: { DN: 200 }, pos: [0, 0, 350], rot: [0, 0, 0] });
  const seq = [['PUMP', 'dismantling-joint', { fromPort: 'B' }], ['dismantling-joint-1', 'check-valve', { fromPort: 'B' }], ['check-valve-1', 'butterfly-valve', { fromPort: 'B' }],
    ['butterfly-valve-1', 'di-bend-90', { fromPort: 'B', params: { turn: 'up' } }], ['di-bend-90-1', 'di-pipe-fl', { fromPort: 'B', params: { len: 1500 } }], ['di-pipe-fl-1', 'di-bend-90', { fromPort: 'B', params: { turn: 'left' } }],
    ['di-bend-90-2', 'di-pipe-fl', { fromPort: 'B', params: { len: 2000 } }], ['PUMP', 'gate-valve', { fromPort: 'A' }], ['gate-valve-1', 'di-pipe-fl', { fromPort: 'B', params: { len: 1200 } }]];
  for (const [sel, comp, o] of seq) a = add(a, sel, comp, o).assembly;
  t(`pump line: ${a.instances.length - 3} parts attached, no broken link`, a.links.length === 10 && brokenLinks(a, lib, prules).length === 0);
  const top = a.instances.filter(i => i.component === 'di-pipe-fl').map(i => i.pos[2]).sort((x, y) => x - y);
  const cf = check(a, lib, crules);
  t('pump line: no overlaps between parts', cf.ok, JSON.stringify(cf.conflicts).slice(0, 300));
  t('pump line: delivery pipe rises above the pump (several heights)', top.at(-1) - 350 > 1000, JSON.stringify(top));
  const up = moveInstance(a, 'PUMP', [0, 0, 150], { withAttached: true });
  t('raise the whole line 150 mm on its plinth: links stay intact', up.detached.length === 0 && brokenLinks(up.assembly, lib, prules).length === 0);
  if (process.env.WRITE_EXAMPLE) writeFileSync(new URL('../examples/pump-station-line.assembly.json', import.meta.url), JSON.stringify({ ...a, name: 'Pump station line' }, null, 1));
}
console.log(fail ? `\n${fail} FAILED` : '\nall pipe fitting tests passed'); process.exit(fail ? 1 : 0);
