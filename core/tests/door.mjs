// Tests for the rich door (generator components). Run: node tests/door.mjs   (also part of npm test)
import { readFileSync } from 'node:fs';
import { flatten, resolveParams } from '../engine/assembly.js';
import { autoAttach, brokenLinks, worldPorts } from '../engine/snap.js';
import { check } from '../engine/collision.js';
import { serialize, parse } from '../engine/io.js';
import { toGLB, toOBJ } from '../engine/export.js';
import { DESIGNS, dims } from '../engine/gen/door.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const lib = {}; for (const f of ['door', 'brick-wall', 'window', 'table']) lib[f] = J('library/components/' + f + '.json');
const prules = J('rules/port-rules.json'), crules = J('rules/conflict-rules.json');
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const one = (params, pos = [0, 0, 0]) => ({ name: 'd', units: 'mm', links: [], instances: [{ id: 'D', component: 'door', params, pos, rot: [0, 0, 0] }] });
const bounds = items => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const it of items) { const h = it.shape.aabbHalf(), R = it.T.R;
  for (let i = 0; i < 3; i++) { const e = Math.abs(R[i*3]) * h[0] + Math.abs(R[i*3+1]) * h[1] + Math.abs(R[i*3+2]) * h[2]; lo[i] = Math.min(lo[i], it.T.t[i] - e); hi[i] = Math.max(hi[i], it.T.t[i] + e); } } return { lo, hi }; };

// 1. every design, single and double: builds, finite numbers, two ports
let bad = '';
for (const d of Object.keys(DESIGNS)) for (const lv of [1, 2]) {
  const p = { design: d, leaves: lv, W: lv === 2 ? 1500 : 900 };
  try {
    const it = flatten(one(p), lib).items;
    if (!it.length || it.some(i => !i.T.t.every(Number.isFinite) || !i.T.R.every(Number.isFinite))) bad += ` ${d}/${lv}:nan`;
    if (worldPorts(one(p), 'D', lib).length !== 2) bad += ` ${d}/${lv}:ports`;
  } catch (e) { bad += ` ${d}/${lv}:${e.message}`; }
}
t(`all ${Object.keys(DESIGNS).length} designs x 2 leaf counts build`, !bad, bad);

// 2. sizes and ports
const d0 = dims(resolveParams(lib.door, {}));
t('default door: leaf 900x2100, wood, thickness 38 (automatic)', d0.Wl === 900 && d0.Hd === 2100 && d0.type === 'wood' && d0.t === 38);
t('overall width = opening + 2 frames (75 mm wood)', d0.Wtot === 900 + 10 + 150);
let wp = worldPorts(one({}), 'D', lib);
t('ports L/R are on the outer frame edges (+-Wtot/2)', Math.abs(wp.find(p => p.id === 'R').p[0] - d0.Wtot / 2) < 1e-6 && Math.abs(wp.find(p => p.id === 'L').p[0] + d0.Wtot / 2) < 1e-6);
const dSide = dims(resolveParams(lib.door, { sideGlass: 2, fanlight: 1 }));
t('side glass both sides adds 2x(400 + frame)', dSide.Wtot === d0.Wtot + 2 * (400 + 75));
let b = bounds(flatten(one({ sideGlass: 2, fanlight: 1 }), lib).items.filter(i => i.role === 'solid'));
t('unit is centred on the origin and stands on z=0', Math.abs(b.lo[0] + b.hi[0]) < 1e-3 && Math.abs(b.lo[2]) < 1e-3, JSON.stringify(b));
b = bounds(flatten(one({ sideGlass: 1 }), lib).items.filter(i => i.role === 'solid'));
t('one side glass: still centred (ports stay symmetric)', Math.abs(b.lo[0] + b.hi[0]) < 1e-3);
t('thickness: steel automatic = 45, wood wide leaf bumps to 45', dims(resolveParams(lib.door, { design: 'stpanel' })).t === 45 && dims(resolveParams(lib.door, { W: 1150 })).t === 45);
t('finish that does not fit the type falls back to the type default', dims(resolveParams(lib.door, { design: 'stpanel', finish: 'teak' })).finish === 'grey');
t('hinges: 4 when door is higher than 2200', dims(resolveParams(lib.door, { doorH: 2400 })).hinges === 4 && d0.hinges === 3);

// 3. validation messages (English, clear)
const err = (p) => { try { resolveParams(lib.door, p); return ''; } catch (e) { return e.message; } };
t('rejects unknown option', /not one of/.test(err({ design: 'nope' })));
t('can switch single <-> double one parameter at a time (no dead end)', err({ leaves: 2 }) === '' && err({ W: 1500 }) === '' && err({ leaves: 2, W: 1500 }) === '');
const notes = p => dims(resolveParams(lib.door, p)).notes.join(' ');
t('single leaf wider than 1200 gives a warning in the details', /single leaf wider than 1200/.test(notes({ W: 1500 })) && notes({}) === '');
t('double door narrower than 1000 gives a warning in the details', /narrower than 1000/.test(notes({ leaves: 2, W: 900 })) && notes({ leaves: 2, W: 1500 }) === '');
t('rejects wall height lower than frame top', /Wall height/.test(err({ doorH: 2700, fanlight: 1, H: 3000 })));
t('rejects out-of-range number', /above max/.test(err({ openAngle: 200 })));

// 4. swing direction and open angle (outside = -Y)
const yr = p => { const s = flatten(one(p), lib).items.filter(i => i.role === 'solid' && /^leaf|^glass|^hw/.test(i.id)); return bounds(s); };
const closed = yr({}), out90 = yr({ openAngle: 90 }), in90 = yr({ openAngle: 90, swing: 'in' });
t('closed leaf stays inside the wall thickness', closed.lo[1] > -150 && closed.hi[1] < 150);
t('open 90 deg outward: leaf sweeps to -Y by about the leaf width', out90.lo[1] < -850 && out90.hi[1] < 150, JSON.stringify(out90.lo[1]));
t('open 90 deg inward: leaf sweeps to +Y', in90.hi[1] > 850 && in90.lo[1] > -150);
const lh = yr({ openAngle: 90, hingeSide: 'L' }), rh = yr({ openAngle: 90, hingeSide: 'R' });
t('hinge side L vs R mirrors the leaf about x=0 (both open outward)', Math.abs(lh.lo[0] + rh.hi[0]) < 1.5 && lh.lo[1] < -850 && rh.lo[1] < -850);
const dbl = yr({ leaves: 2, W: 1500, openAngle: 90 });
t('double door: both leaves swing out, 2 x 748 mm', dbl.lo[1] < -740 && dbl.hi[1] < 150);

// 5. attach into a wall line, no conflicts
let asm = { name: 'line', units: 'mm', links: [], instances: [{ id: 'W1', component: 'brick-wall', params: {}, pos: [0, 0, 0], rot: [0, 0, 0] }] };
let a1 = autoAttach(asm, lib, 'W1', 'door', prules); t('door attaches to a brick wall', !!a1.assembly, a1.error);
let a2 = autoAttach(a1.assembly, lib, a1.instance.id, 'brick-wall', prules); t('a second wall attaches to the door (wall - door - wall)', !!a2.assembly, a2.error);
t('links all touch', brokenLinks(a2.assembly, lib, prules).length === 0);
let a3 = autoAttach(a2.assembly, lib, a1.instance.id, 'brick-wall', prules, {}); t('door has only 2 ports: third attach rejected', !!a3.error);
let cf = check(a2.assembly, lib, crules);
t('wall - door - wall: no conflicts, no warnings', cf.ok && cf.warnings.length === 0, JSON.stringify(cf.conflicts.concat(cf.warnings)).slice(0, 300));
for (const [name, p] of [['6-panel double + fanlight + side glass', { design: 'p6', leaves: 2, W: 1500, fanlight: 1, sideGlass: 2, H: 3300, closer: 1, kickplate: 1 }],
  ['steel fire-rated, knob, black hardware', { design: 'stfire', handle: 'bar', hardware: 'black' }], ['aluminium full glass', { design: 'alfull', glass: 'grey', handle: 'lever' }],
  ['wood louvre open 60 deg', { design: 'louvre', openAngle: 60 }]]) {
  const x = autoAttach(asm, lib, 'W1', 'door', prules, { params: p }); const y = x.assembly && autoAttach(x.assembly, lib, x.instance.id, 'brick-wall', prules);
  const c = y.assembly ? check(y.assembly, lib, crules) : { ok: false, conflicts: [y.error], warnings: [] };
  t('wall-door-wall without conflicts: ' + name, !!x.assembly && c.ok && c.warnings.length === 0 && brokenLinks(y.assembly, lib, prules).length === 0, JSON.stringify(c.conflicts.concat(c.warnings)).slice(0, 200));
}
// door + window chain (face-h ports of other components still mate)
let w1 = autoAttach(a1.assembly, lib, a1.instance.id, 'window', prules);
t('window attaches to the door (face-h to face-h)', !!w1.assembly, w1.error);

// 6. swing clearance warns about furniture in front of the door
const front = (y) => ({ ...asm, instances: [...a1.assembly.instances, { id: 'T1', component: 'table', params: {}, pos: [a1.instance.pos[0], y, 0], rot: [0, 0, 0] }], links: a1.assembly.links });
t('table in the door swing (outside): warning', check(front(-500), lib, crules).warnings.some(w => w.kind === 'clearance'));
t('table far away: no warning', check(front(-3000), lib, crules).warnings.length === 0);

// 7. save / load / export
const full = one({ design: 'p6', leaves: 2, W: 1600, glass: 'frost', handle: 'digital', sideGlass: 1, fanlight: 1, H: 3300, peephole: 1, numberplate: 1, openAngle: 45, swing: 'in' });
const back = parse(serialize(full), lib);
t('save then load keeps every option', JSON.stringify(back.instances[0].params) === JSON.stringify(full.instances[0].params));
let rej = ''; try { parse(serialize(one({ design: 'p4' })).replace('"p4"', '"bogus"'), lib); } catch (e) { rej = e.message; }
t('load rejects a bad option with a clear message', /not one of/.test(rej), rej);
const items = flatten(full, lib).items, glb = toGLB(items), dv = new DataView(glb.buffer);
t('GLB export works for the full door (valid header + length)', dv.getUint32(0, true) === 0x46546C67 && dv.getUint32(8, true) === glb.length);
t('OBJ export works and skips the swing clearance zone', toOBJ(items).includes('v ') && !items.filter(i => i.role === 'solid').some(i => i.tags.includes('swing')));
t('glass shapes carry colour + opacity', items.some(i => i.tags.includes('glass') && i.opacity < 1 && Number.isInteger(i.color)));
console.log(fail ? `\n${fail} FAILED` : '\nall door tests passed'); process.exit(fail ? 1 : 0);
