// Tests for the generator room (DG set room). Run: node tests/genroom.mjs   (also part of npm test)
import { readFileSync } from 'node:fs';
import { flatten, resolveParams } from '../engine/assembly.js';
import { materialize } from '../engine/generate.js';
import { check } from '../engine/collision.js';
import { worldPorts } from '../engine/snap.js';
import { visualOf, partsBounds } from '../engine/visual/index.js';
import { plan, rectMinus, SETS, RULE } from '../engine/gen/genroom.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const comp = J('library/components/generator-room.json'), lib = { 'generator-room': comp }, crules = J('rules/conflict-rules.json');
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const one = (params = {}, extra = {}) => ({ name: 't', units: 'mm', links: [], instances: [{ id: 'G', component: 'generator-room', params, pos: [0, 0, 0], rot: [0, 0, 0], ...extra }] });
const P = (o = {}) => plan(resolveParams(comp, o));
const solids = (o = {}) => flatten(one(o), lib).items.filter(i => i.role === 'solid');

// 1. every kVA size x 1/2 sets x exhaust exit x door type builds (plan, shapes, real mesh)
let bad = '', n = 0;
for (const kva of comp.parameters.kva.options.map(o => o.v)) for (const sets of [1, 2]) for (const exhaust of ['wall', 'roof']) for (const doorType of ['double', 'shutter']) {
  try { const o = { kva, sets, exhaust, doorType, open: 50 }, m = materialize(comp, resolveParams(comp, o)), v = visualOf(comp, resolveParams(comp, o)); if (!m.shapes.length || !v.length) bad += ` ${kva}/${sets}/${exhaust}/${doorType}:empty`; n++; }
  catch (e) { bad += ` ${kva}/${sets}/${exhaust}/${doorType}:${e.message}`; }
}
t(`all ${n} size / sets / exhaust / door combinations build`, !bad, bad);

// 2. rectMinus: wall with openings keeps the exact area
const holes = [{ u0: 1000, u1: 2000, v0: 0, v1: 2100 }, { u0: 1500, u1: 3000, v0: 800, v1: 1600 }], rs = rectMinus(6000, 3000, holes);
const area = rs.reduce((a, r) => a + (r.u1 - r.u0) * (r.v1 - r.v0), 0);
t('rectMinus: area = wall minus the union of the holes', Math.abs(area - (6000 * 3000 - (1000 * 2100 + 1500 * 800 - 500 * 800))) < 1, String(area));

// 3. sizes follow the rules
const d = P(), S = SETS[250];
t('default: 250 kVA, 1 set, set 3400 x 1250 x 1900', d.S.L === 3400 && d.S.W === 1250 && d.S.H === 1900 && d.n === 1);
t('room is at least radiator + set + alternator clearance long', d.Li >= d.cR + S[0] + d.cA && d.Wi >= S[1] + 2 * RULE.sideClear && d.Hi >= 3600);
t('2 sets: width grows by one set and one gap', P({ sets: 2 }).Wi === 2 * S[1] + 3 * RULE.sideClear);
t('bigger set gives a bigger room and a bigger stack', P({ kva: 1000 }).Li > d.Li && P({ kva: 1000 }).Hi > d.Hi && P({ kva: 1000 }).stackAbove > d.stackAbove);
t('too small length is raised to the minimum with a note', P({ L: 3000 }).Li === d.Lmin && /raised/.test(P({ L: 3000 }).notes.join(' ')));
t('a larger length is kept (set stays centred in the extra)', P({ L: 12000 }).Li === 12000 && Math.abs((P({ L: 12000 }).sets[0].x0 + P({ L: 12000 }).sets[0].x1) / 2 - (d.sets[0].x0 + d.sets[0].x1) / 2) < 1);
t('stack below the guideline gives a warning', /below the guideline/.test(P({ stack: 1000 }).notes.join(' ')) && P().notes.length === 0);
t('bund keeps at least 110 % of the day tank', (() => { const k = d.tank, v = (k.bx - 200) * (k.by - 200) * k.hB / 1e6; return v >= 1.1 * k.V - 1e-6; })(), JSON.stringify(d.tank));
t('day tank covers the autonomy asked (2 sets, 8 h)', P({ sets: 2, tankHours: 8 }).tank.V * 1 >= Math.min(5000, 0.15 * 250 * 2 * 8) );
t('inlet louvre free area covers the air at 4 m/s (both walls)', 2 * d.louvre.free >= d.n * d.Q / RULE.inletVelocity - 1e-6, `${(2 * d.louvre.free).toFixed(2)} m2 vs ${(d.Q / 4).toFixed(2)}`);
t('discharge air speed is within the limit', d.disc.vel <= RULE.dischargeVelocity + 0.01);
t('equipment door passes the set (width +600, height +300 over the plinth)', d.Weq === S[1] + 600 && d.Heq >= d.ph + S[2] + 300);
t('hoist capacity is at least half the set mass', d.swl * 1000 >= 0.5 * 3000);

// 4. real openings in the collision model (a pipe can pass through; walls are real pieces, not a big box with a hole painted on)
const bx = i => ({ at: i.T.t, hh: i.shape.h }), isAA = i => i.shape.type === 'box' && i.T.R[0] === 1 && i.T.R[4] === 1;
const hit = (o, pt) => flatten(one(o), lib).items.filter(i => i.role === 'solid' && isAA(i)).some(i => { const { at, hh } = bx(i); return [0, 1, 2].every(k => Math.abs(pt[k] - at[k]) <= hh[k]); });
const x1 = d.Li / 2 + d.t / 2;
t('equipment door opening is empty when the shutter is rolled up (door 100 %)', !hit({ doorType: 'shutter', open: 100 }, [x1, 0, d.zf + 600]));
t('the wall beside the opening is solid', hit({ doorType: 'shutter', open: 100 }, [x1, d.Wi / 2 - 150, d.zf + 600]));
t('exhaust sleeve hole is open through the +Y wall', !hit({}, [d.sets[0].xEx, d.Wi / 2 + d.t / 2, d.sets[0].zH]) && hit({}, [d.sets[0].xEx + 600, d.Wi / 2 + d.t / 2, d.sets[0].zH]));
t('inlet louvre blocks are in the wall openings, the wall above the louvre is solid', hit({}, [-d.Li / 2 + d.louvre.u0 + 300, d.Wi / 2 + d.t / 2, d.zf + d.louvre.v0 + 300]) && hit({}, [-d.Li / 2 + d.louvre.u0 + 300, d.Wi / 2 + d.t / 2, d.zf + d.louvre.v1 + 300]));

// 5. doors swing
const find = (o, pre) => flatten(one(o), lib).items.find(i => i.id.startsWith(pre)).T.t;
t('equipment door leaf swings outward (+X) when opened', find({ open: 100 }, 'equipment-door')[0] > find({ open: 0 }, 'equipment-door')[0] + 300);
t('personnel door opens outward (-Y)', find({ open: 100 }, 'personnel-door')[1] < find({ open: 0 }, 'personnel-door')[1] - 300);

// 6. ports and standing on the ground
const wp = worldPorts(one(), 'G', lib), pid = id => wp.find(p => p.id === id);
t('ports: B at the bottom, T on the roof, L/R at the ends', pid('B').p[2] === 0 && pid('T').p[2] === d.zr && Math.abs(pid('R').p[0] - d.Lo / 2) < 1 && Math.abs(pid('L').p[0] + d.Lo / 2) < 1);
const sb = solids({}).filter(i => i.shape.type === 'box'), lo = Math.min(...sb.map(i => i.T.t[2] - i.shape.h[2])).toFixed(0);
t('stands on z = 0, centred in X and Y', Math.abs(lo) < 1 && Math.abs(Math.min(...sb.map(i => i.T.t[0] - i.shape.h[0])) + d.Lo / 2) < 1);
t('collision check: the room alone has no conflict', check(one(), lib, crules).conflicts.length === 0);
t('a second room on the right port does not overlap when moved by one room length', check({ ...one(), instances: [one().instances[0], { id: 'H', component: 'generator-room', params: {}, pos: [d.Lo + 10, 0, 0], rot: [0, 0, 0] }] }, lib, crules).conflicts.length === 0);

// 7. real mesh
const v = visualOf(comp, resolveParams(comp, {})), b = partsBounds(v);
t('real mesh has at least 35 named parts and stays within 20 m', v.length >= 35 && Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) < 20000, `${v.length} parts`);
t('cutaway (view only) removes the roof and front wall from the mesh, not from collision', !visualOf(comp, resolveParams(comp, { cutaway: 1 })).some(p => p.name === 'roof-slab') && v.some(p => p.name === 'roof-slab') && solids({ cutaway: 1 }).length === solids({}).length);
t('switching a facility off removes its parts', !visualOf(comp, resolveParams(comp, { hoist: 0 })).some(p => /hoist|monorail/.test(p.name)) && !visualOf(comp, resolveParams(comp, { dayTank: 0 })).some(p => /day-tank|bund/.test(p.name)));
if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); } else console.log('\nall generator room tests passed');
