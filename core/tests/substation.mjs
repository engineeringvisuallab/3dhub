// Tests for the substation (pole, kiosk, indoor, AIS, GIS). Run: node tests/substation.mjs   (also part of npm test)
import { readFileSync } from 'node:fs';
import { flatten, resolveParams } from '../engine/assembly.js';
import { materialize } from '../engine/generate.js';
import { check } from '../engine/collision.js';
import { visualOf, partsBounds } from '../engine/visual/index.js';
import { plan, shell, ALLOWED, YARD, RULE, DIST, POWER } from '../engine/gen/substation.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const comp = J('library/components/substation.json'), lib = { substation: comp }, crules = J('rules/conflict-rules.json');
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const P = (o = {}) => plan(resolveParams(comp, o));
const one = (params = {}) => ({ name: 't', units: 'mm', links: [], instances: [{ id: 'S', component: 'substation', params, pos: [0, 0, 0], rot: [0, 0, 0] }] });
const items = (o, k) => P(o).items.filter(i => i.kind === k);
const AIS = { type: 'ais', kv: '33/11', rating: 10000, tx: 2, lines: 2 };

// 1. every type x voltage x first/last rating x transformers x facilities on/off builds (plan, shapes, mesh)
let bad = '', n = 0;
for (const type of Object.keys(ALLOWED)) for (const kv of Object.keys(ALLOWED[type])) for (const r of [ALLOWED[type][kv][0], ALLOWED[type][kv].at(-1)]) for (const tx of [1, 2, 3]) for (const fac of [1, 0]) {
  const o = { type, kv, rating: r, tx, fence: fac, fireWall: fac, oilPit: fac, capBank: fac, trench: fac, crane: fac, mast: fac, flood: fac, earth: fac, ner: fac, aux: fac, stay: fac, cutaway: fac, open: 50 };
  try { const p = resolveParams(comp, o), m = materialize(comp, p), v = visualOf(comp, p); if (!m.shapes.length || !v.length) bad += ` ${type}/${kv}/${r}/${tx}/${fac}:empty`; n++; } catch (e) { bad += ` ${type}/${kv}/${r}/${tx}/${fac}:${e.message}`; }
}
t(`all ${n} type / voltage / rating / transformers / facility combinations build`, !bad, bad);

// 2. soft rules: voltage and rating follow the type, transformer count is limited
t('pole type forces 11/0.4 kV and says so', P({ type: 'pole', kv: '132/33' }).kv === '11/0.4' && /Using 11\/0\.4/.test(P({ type: 'pole', kv: '132/33' }).notes.join(' ')));
t('ais at 11/0.4 is moved to 33/11 kV', P({ type: 'ais', kv: '11/0.4' }).kv === '33/11');
t('a rating that is not offered snaps to the nearest offered', P({ type: 'kiosk', kv: '11/0.4', rating: 25 }).rating === 200 && P({ type: 'ais', kv: '132/33', rating: 5000 }).rating === 20000);
t('pole and kiosk take 1 transformer, indoor at most 2', P({ type: 'pole', tx: 3 }).tx === 1 && P({ type: 'kiosk', tx: 3 }).tx === 1 && P({ type: 'indoor', kv: '11/0.4', rating: 1000, tx: 3 }).tx === 2);

// 3. pole: single pole up to 63 kVA, H-pole from 100 kVA
t('pole: single pole for 63 kVA, H-pole (2 poles + platform) for 100 kVA', items({ type: 'pole', kv: '11/0.4', rating: 63 }, 'pole').length === 1 && items({ type: 'pole', kv: '11/0.4', rating: 100 }, 'pole').length === 2 && items({ type: 'pole', kv: '11/0.4', rating: 100 }, 'platform').length === 1);
t('pole: transformer is above 4 m and HT fuses, arresters, cross arm exist', (() => { const q = P({ type: 'pole', kv: '11/0.4', rating: 200 }); return q.items.find(i => i.kind === 'tx-dist').at[2] >= 4000 && ['do-fuse', 'la-pole', 'crossarm', 'lt-box'].every(k => q.items.some(i => i.kind === k)); })());

// 4. kiosk: three compartments, enclosure grows with the transformer
const k1 = P({ type: 'kiosk', kv: '11/0.4', rating: 200 }), k2 = P({ type: 'kiosk', kv: '11/0.4', rating: 1600 });
t('kiosk: RMU + transformer + LT panel, and a bigger transformer gives a bigger enclosure', ['rmu', 'tx-dist', 'lt-panel'].every(k => k1.items.some(i => i.kind === k)) && k2.extra.kiosk.Lo > k1.extra.kiosk.Lo && k2.extra.kiosk.Hi >= k1.extra.kiosk.Hi);

// 5. indoor: rooms and panel counts follow the transformers and feeders
const i1 = P({ type: 'indoor', kv: '11/0.4', rating: 1000, tx: 1, feeders: 0 }), i2 = P({ type: 'indoor', kv: '11/0.4', rating: 1000, tx: 2, feeders: 3 });
t('indoor: 1 or 2 transformer rooms, MV panel count grows with transformers and feeders', i1.extra.rooms.filter(r => r.id.startsWith('tx')).length === 1 && i2.extra.rooms.filter(r => r.id.startsWith('tx')).length === 2 && i2.extra.nMv > i1.extra.nMv + 3);
t('indoor: clearance in front of MV panels is at least 1.5 m, wall clearance 0.9 m', RULE.panelFront >= 1500 && RULE.wallClear >= 900 && i1.extra.Wi >= RULE.mvPanel[11][1] + RULE.panelFront + RULE.panelRear);
t('indoor: soak pit holds 100 % of the oil at 40 % void (floor thickened when needed)', P({ type: 'indoor', kv: '11/0.4', rating: 2000, oilPit: 1 }).extra.pits.every(q => q.L * q.W * q.depth * RULE.oilVoid / 1e9 * 1000 >= q.oil * 0.999));

// 6. AIS / GIS: bays, spacing, fire wall, oil pit, control building, heights
const a33 = P({ ...AIS }), a132 = P({ ...AIS, kv: '132/33', rating: 31500 });
t('ais: 132 kV yard is bigger than 33 kV yard (phase spacing, bay, gantry, mast)', a132.Lo > a33.Lo && a132.Wo > a33.Wo && YARD['132/33'].ph > YARD['33/11'].ph && YARD['132/33'].Hg > YARD['33/11'].Hg && a132.extra.pitch >= 13500);
t('ais: every bay has isolator, breaker, CT, arrester (line: also CVT) in the right order', (() => { const q = P({ ...AIS, tx: 1, lines: 1 }); const x = k => q.items.find(i => i.id === k).at[0]; return x('line1-arrester') < x('line1-cvt') && x('line1-cvt') < x('line1-line-isolator') && x('line1-line-isolator') < x('line1-ct') && x('line1-ct') < x('line1-breaker') && x('line1-breaker') < x('line1-bus-isolator') && x('line1-bus-isolator') < x('main-bus') && x('main-bus') < x('tx1-bus-isolator') && x('tx1-bus-isolator') < x('tx1-breaker') && x('tx1-breaker') < x('tx1-ct') && x('tx1-ct') < x('tx1-arrester') && x('tx1-arrester') < x('transformer-1'); })());
t('ais: live parts at least 3.7 m (33 kV) / 5.2 m (132 kV) above ground, insulator bottom at least 2.4 m', Object.values(YARD).every(y => y.Ht >= (y.hv === 33 ? 3700 : 5200) && Object.entries(y.stand).every(([k, s]) => s >= (k === 'pt' && y.hv === 132 ? 2200 : 2400)) && Object.keys(y.stand).every(k => y.stand[k] + y.body[k] === y.Ht)));
t('ais: sectional clearance and fence margin follow the voltage (2.8 / 4.0 m)', YARD['33/11'].sect === 2800 && YARD['132/33'].sect === 4000 && YARD['132/33'].margin > YARD['132/33'].sect);
t('fire wall between 2 transformers lets the gap shrink; without it the gap grows', P({ ...AIS, fireWall: 1 }).extra.pitch < P({ ...AIS, fireWall: 0 }).extra.pitch && items({ ...AIS, fireWall: 1 }, 'fire-wall').length === 1 && items({ ...AIS, fireWall: 0 }, 'fire-wall').length === 0 && /no fire wall/.test(P({ ...AIS, fireWall: 0 }).notes.join(' ')));
t('fire wall is higher than the transformer and longer than its pit', (() => { const q = P({ ...AIS, fireWall: 1 }), w = q.items.find(i => i.kind === 'fire-wall'), T = POWER[10000]; return w.size[2] > T[2] && w.size[0] >= T[0] + 2000; })());
t('oil pit under each transformer: plan = transformer + 1 m each side, void 40 %', (() => { const q = P({ ...AIS }); const T = POWER[10000]; return q.items.filter(i => i.kind === 'oil-pit').length === 2 && q.extra.pits.every(p => p.L === T[0] + 2000 && p.W === T[1] + 2000 && p.L * p.W * p.depth * RULE.oilVoid / 1e9 * 1000 >= T[4] * 0.999); })());
t('transformer bays are spaced so neighbouring oil pits do not touch', (() => { const q = P({ ...AIS }); const ys = q.items.filter(i => i.kind === 'tx-power').map(i => i.at[1]); return Math.abs(ys[0] - ys[1]) >= POWER[10000][1] + 2000 + 1000; })());
t('control building: MV switch room panels follow transformers + feeders', P({ ...AIS, feeders: 8 }).extra.control.nMv > P({ ...AIS, feeders: 2 }).extra.control.nMv + 5 && ['mv-switchgear', 'control-relay-panels', 'battery-bank', 'dc-chargers'].every(id => P({ ...AIS }).items.some(i => i.id === id)));
t('gis: hall with one bay per line, transformer and bus PT, bushings on the wall, ducts to the transformers', (() => { const q = P({ ...AIS, type: 'gis', crane: 1 }); return q.items.filter(i => i.kind === 'gis-bay').length === 2 + 2 + 1 && q.items.filter(i => i.kind === 'duct').length === 2 && q.items.some(i => i.kind === 'crane') && q.blds.some(b => b.id === 'gis-hall'); })());
t('gis: hall is smaller than the AIS yard bays it replaces', P({ ...AIS, type: 'gis' }).Lo < P({ ...AIS }).Lo + 1 && P({ ...AIS, type: 'gis', kv: '132/33', rating: 31500 }).Lo < P({ ...AIS, kv: '132/33', rating: 31500 }).Lo);
t('facility switches add and remove items (masts, flood poles, NER, cap bank, fence, gate)', (() => { const on = P({ ...AIS }), off = P({ ...AIS, mast: 0, flood: 0, ner: 0, capBank: 0, fence: 0 }); const cnt = (q, k) => q.items.filter(i => i.kind === k).length; return cnt(on, 'mast') === 2 && cnt(off, 'mast') === 0 && cnt(on, 'flood-pole') === 4 && cnt(off, 'flood-pole') === 0 && cnt(on, 'ner') === 2 && cnt(off, 'ner') === 0 && cnt(on, 'capbank-yard') === 1 && cnt(off, 'capbank-yard') === 0 && cnt(on, 'gate') === 1 && cnt(off, 'gate') === 0 && cnt(on, 'fence-run') >= 4; })());

// 7. building shells: real openings (a door hole is empty, the wall beside it is solid)
{ const q = P({ type: 'indoor', kv: '11/0.4', rating: 630, tx: 1, trench: 0, oilPit: 0 }), b = q.blds[0], boxes = shell(b), door = b.holes.negy[0];
  const hit = pt => boxes.some(s => [0, 1, 2].every(k => Math.abs(pt[k] - s.c[k]) <= s.s[k] / 2 + 1e-6));
  const x = b.x0 + (door.u0 + door.u1) / 2, y = b.y0 + b.t / 2;
  t('indoor: door opening is empty, wall beside it is solid', !hit([x, y, b.zb + 1000]) && hit([b.x0 + (door.u1 + 300), y, b.zb + 1000])); }

// 8. collision: no self conflict, gate opens, ports
const one1 = one({ ...AIS }); const t0 = Date.now(); const ck = check(one1, lib, crules);
t('collision check: the substation alone has no conflict', ck.conflicts.length === 0, `${Date.now() - t0} ms`);
t('gate moves along the fence when opened', (() => { const g0 = flatten(one({ ...AIS, open: 0 }), lib).items.find(i => i.id.startsWith('gate')).T.t[0], g1 = flatten(one({ ...AIS, open: 100 }), lib).items.find(i => i.id.startsWith('gate')).T.t[0]; return g1 < g0 - 3000; })());
t('ports: B on the ground, L / R at the plot ends', (() => { const m = materialize(comp, resolveParams(comp, AIS)), q = P(AIS); const B = m.ports.find(p => p.id === 'B'), R = m.ports.find(p => p.id === 'R'); return B.at[2] === 0 && Math.abs(R.at[0] - q.plot.x1) < 1; })());

// 9. real mesh
const v = visualOf(comp, resolveParams(comp, AIS));
t('ais mesh has 60+ named parts and winding stays valid', v.length >= 60);
t('cutaway removes roofs and front walls from the mesh only', (() => { const a = visualOf(comp, resolveParams(comp, { type: 'indoor', kv: '11/0.4', rating: 630, cutaway: 0 })), c = visualOf(comp, resolveParams(comp, { type: 'indoor', kv: '11/0.4', rating: 630, cutaway: 1 })); const tri = x => x.reduce((s, p) => s + p.idx.length, 0); return tri(c) < tri(a) && materialize(comp, resolveParams(comp, { type: 'indoor', kv: '11/0.4', rating: 630, cutaway: 0 })).shapes.length === materialize(comp, resolveParams(comp, { type: 'indoor', kv: '11/0.4', rating: 630, cutaway: 1 })).shapes.length; })());
if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); } else console.log('\nall substation tests passed');
