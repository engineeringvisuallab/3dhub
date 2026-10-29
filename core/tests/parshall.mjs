// Parshall flume: data, calculations, the worked examples of the Utah report, geometry and the model page.
import { readFileSync } from 'node:fs';
import * as P from '../engine/wtp/parshall.js';
import * as G from '../engine/wtp/parshall-geometry.js';
import { loadWtp } from '../engine/wtp/node-loader.mjs';
import { buildRegistry, explain, validate } from '../engine/wtp/registry.js';
import { buildParshallPage, PAGE } from '../../tools/build-parshall-page.mjs';
const data = JSON.parse(readFileSync(new URL('../library/wtp/data/parshall.json', import.meta.url), 'utf8'));
let fail = 0; const t = (n, c, i = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); if (!c) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const FT = 0.3048, IN = 0.0254, CFS = 0.028316846592;
const ids = P.pfSizeIds(data);

t('13 standard sizes from 3 in to 8 ft', ids.length === 13 && ids[0] === '3in' && ids[12] === '8ft');
// Table 2 as printed
t('Table 2 transition submergence 56..78 %', data.utah.sizes.map(s => Math.round(s.transition_submergence * 100)).join(',') === '56,56,60,62,64,66,67,68,70,72,74,76,78');

// Table 1 internal consistency (a transcription error would break these relations)
const big = data.utah.sizes.filter(s => s.W_in >= 12);
t('Table 1: B = W + 12 in for every size from 12 in up', big.every(s => near(s.dims_in.B, s.W_in + 12, 1e-9)));
t('Table 1: 2/3 C matches two thirds of C within 1/8 in for all 13 sizes', data.utah.sizes.every(s => near(s.dims_in.C23, s.dims_in.C * 2 / 3, 0.126)));
t('Table 1: throat floor drops 9 in over 24 in from 12 in up, and 3/8 slope for all sizes', big.every(s => s.dims_in.H === 9 && s.dims_in.E === 24) && data.utah.sizes.every(s => near(s.dims_in.H / s.dims_in.E, 0.375, 1e-9)));
t('Table 1: outlet floor rises 6 in over 36 in and ends 3 in below the crest (report text)', big.every(s => near((s.dims_in.H - s.dims_in.K) / s.dims_in.F, 1 / 6, 1e-9) && s.dims_in.K === 3));
t('Table 1: converging wall length C agrees with the plan geometry within 0.5 in', data.utah.sizes.every(s => { const d = s.dims_in; return near(Math.hypot(d.D, (d.A - s.W_in) / 2), d.C, 0.5); }));

// Table 3 as power laws
let worst = 0; for (const s of data.utah.sizes) worst = Math.max(worst, s.free.worst_error_in_half_units);
t('Table 3 fit reproduces all 28 anchor rows within 2 half-units of the last printed digit', worst <= 2, 'worst ' + worst);
const col = data.utah.table3_anchors.columns, rows = data.utah.table3_anchors.Ha_ft, Q = data.utah.table3_anchors.Q_cfs;
let n = 0, maxHalf = 0; rows.forEach((ha, i) => col.forEach((id, j) => { const q = Q[i][j]; if (q === null) return; n++; const f = P.pfFreeFlow(data, id, ha * FT).Q_m3s / CFS, dp = String(q).split('.')[1]?.length || 0; maxHalf = Math.max(maxHalf, Math.abs(f - q) / (0.5 * Math.pow(10, -dp))); }));
t('every anchor cell re-checked through the public function', maxHalf <= 2, n + ' cells, worst ' + maxHalf.toFixed(2));
t('anchors cover all 13 sizes with at least 8 points each', col.every((_, j) => Q.filter(r => r[j] !== null).length >= 8));
t('Table 1 maximum flows agree with the fit at the end of the table range within 5 %', data.utah.sizes.every(s => { const f = P.pfFreeFlow(data, s.id, s.free.Ha_max_ft * FT).Q_m3s / CFS; return Math.abs(f / s.table1_Q_max_cfs - 1) < 0.05; }));
t('free flow rises with head for every size', ids.every(id => { let p = 0; for (let h = 0.2; h <= 2.5; h += 0.1) { const q = P.pfFreeFlow(data, id, h * FT).Q_m3s; if (q <= p) return false; p = q; } return true; }));
t('head for flow inverts free flow', ids.every(id => near(P.pfHeadForFlow(data, id, P.pfFreeFlow(data, id, 0.9 * FT).Q_m3s), 0.9 * FT, 1e-12)));
t('range flags: 3 in is out of range above 0.74 ft, 8 ft below 0.30 ft', !P.pfFreeFlow(data, '3in', 0.8 * FT).inRange && !P.pfFreeFlow(data, '8ft', 0.25 * FT).inRange && P.pfFreeFlow(data, '24in', 1 * FT).inRange);

// worked examples of the Utah report
t('Example 1: 2 ft flume, Ha = 2.19 ft -> 27.0 cfs', near(P.pfFreeFlow(data, '24in', 2.19 * FT).Q_m3s / CFS, 27.0, 0.1));
t('Table 3 spot values: 12 in at 1.00 ft = 4.00, 3 ft at 1.00 = 12.0, 8 ft at 2.50 = 139.5 cfs', near(P.pfFreeFlow(data, '12in', FT).Q_m3s / CFS, 4.0, 0.01) && near(P.pfFreeFlow(data, '3ft', FT).Q_m3s / CFS, 12.0, 0.02) && near(P.pfFreeFlow(data, '8ft', 2.5 * FT).Q_m3s / CFS, 139.5, 0.3));
const ex4 = P.pfSelect(data, { Qmax_m3s: 10 * CFS, downstreamDepth_m: 0.8 * FT, allowedLoss_m: 0.5 * FT });
t('Example 4: 10 cfs, depth 0.8 ft, loss 0.5 ft -> 2 ft flume', ex4 && ex4.id === '24in' && near(ex4.submergence, 0.615, 0.001), JSON.stringify(ex4 && { id: ex4.id, S: +ex4.submergence.toFixed(3) }));
t('Example 4: 18 in flume is too small (passes only ~9 cfs at 1.3 ft)', P.pfFreeFlow(data, '18in', 1.3 * FT).Q_m3s / CFS < 10);
t('Example 5: throat built 2.10 ft instead of 2.00 -> factor 1.05, 27.0 cfs becomes 28.35', near(P.pfAsBuiltFactor(2.0, 2.10), 1.05, 1e-12) && near(27.0 * P.pfAsBuiltFactor(2.0, 2.10), 28.35, 1e-9));
const ex6 = P.pfInstallation(data, '24in', 27.0 * CFS);
t('Example 6: 27.0 cfs in a 2 ft flume -> Ha 2.19 ft, crest 1.45 ft below high water, water rises 0.74 ft', near(ex6.Ha_m / FT, 2.19, 0.01) && near(ex6.crestBelowHighWater_m / FT, 1.45, 0.01) && near(ex6.afflux_m / FT, 0.74, 0.01), `${(ex6.Ha_m / FT).toFixed(3)} ${(ex6.crestBelowHighWater_m / FT).toFixed(3)} ${(ex6.afflux_m / FT).toFixed(3)}`);
for (const [id, nm] of [['24in', '2 ft'], ['30in', '30 in'], ['3ft', '3 ft']]) t(`Example 7: Ha 2.0 and Hb 1.8 (90 %) is submerged for the ${nm} flume`, P.pfRegime(data, id, 2.0 * FT, 1.8 * FT).submerged);
t('Figure 3: 2 ft flume, submergence 66 % is free flow (transition), 72 % is submerged', !P.pfRegime(data, '24in', 2.19 * FT, 2.19 * 0.66 * FT).submerged && P.pfRegime(data, '24in', 2.19 * FT, 2.19 * 0.72 * FT).submerged);
t('free-flow selection returns nothing when downstream depth gives 92 % submergence (above every transition value)', P.pfSelect(data, { Qmax_m3s: 10 * CFS, downstreamDepth_m: 1.2 * FT, allowedLoss_m: 0.1 * FT }) === null);

// Arkon cross-check (different geometry and gauge point, so only a plausibility band, not a match)
let aw = 0, an = 0;
for (const id of ['3in', '6in', '9in', '12in', '18in', '24in', '3ft']) {
  const s = data.utah.sizes.find(x => x.id === id), Pn = P.pfArkonForWidth(data, P.pfThroatWidth(data, id) * 100);
  for (const ha of [0.3, 0.5, 0.7, 1.0]) { if (ha < s.free.Ha_min_ft || ha > s.free.Ha_max_ft) continue; an++; aw = Math.max(aw, Math.abs(P.pfArkonDischarge(data, Pn, ha * FT) / P.pfFreeFlow(data, id, ha * FT).Q_m3s - 1)); }
}
t('Arkon equation stays within 12 % of the Utah table for the seven matching widths (no gross transcription error)', aw < 0.12, an + ' points, worst ' + (aw * 100).toFixed(1) + ' %');
t('Arkon data: nine sizes, widths match inches', data.arkon.id.length === 9 && near(data.arkon.W_cm[3], 6 * 2.54, 0.001) && near(data.arkon.W_cm[5], 12 * 2.54, 0.001));
t('Arkon P1 reaches about its listed Qmax (6.22 l/s) at h = 0.23 m', near(P.pfArkonDischarge(data, 'P1', 0.23) * 1000, 6.22, 0.3), (P.pfArkonDischarge(data, 'P1', 0.23) * 1000).toFixed(2));

// expert rules agree with the check function
const reg = buildRegistry(loadWtp()), K = 'rapid-mix-and-measurement.parshall-flume';
let agree = true, cases = 0;
for (const S of [0.3, 0.64, 0.68, 0.72]) for (const bend of [6, 12, 20]) for (const gate of [false, true]) for (const deb of [0.2, 0.9]) for (const wc of [0.2, 0.5, 0.9]) {
  const id = '12in', W = P.pfThroatWidth(data, id), Ha = 0.4, tr = P.pfTransitionSubmergence(data, id); cases++;
  const a = P.pfChecks(data, id, { Ha_m: Ha, Hb_m: S * Ha, distanceFromBend_W: bend, nearGate: gate, debris_m: deb * W, channelWidth_m: W / wc }).map(x => x.rule).sort().join();
  const b = explain(reg, K, { Hb_over_Ha: S, transition_submergence: tr, distance_from_bend_in_W: bend, near_gate: gate, debris_size_over_W: deb, throat_over_channel_width: wc, water_temperature: 20 }).warnings.map(x => x.id).sort().join();
  if (a !== b) { agree = false; console.log('  mismatch', S, bend, gate, deb, wc, a, '|', b); }
}
t('pfChecks and the PF-CHK rules raise the same flags', agree, cases + ' cases');

// geometry
let geoOk = true, msgs = [];
for (const id of ids) {
  const dm = P.pfDimensions(data, id), d = {}; for (const k in dm) d[k] = dm[k] * 1000;
  const o = { channelW: Math.max(d.A, 2.5 * d.W), approachLen: 12 * d.W, tailLen: Math.max(600, 2 * d.W), wall: 150, slab: 150, Ha: 0.4 * d.G, Hd: 0.15 * d.G, withWater: true };
  const r = G.pfBuild(d, o);
  const vols = r.solids.map(s => G.pfMesh(s).volume);
  if (!vols.every(v => v > 0)) { geoOk = false; msgs.push(id + ' volume'); }
  const gr = new Set(r.solids.map(s => s.group));
  if (!['Flume', 'Approach channel', 'Tail channel', 'Water (schematic)', 'Gauges'].every(x => gr.has(x))) { geoOk = false; msgs.push(id + ' groups'); }
  const thr = r.solids.find(s => s.name === 'Throat floor'), con = r.solids.find(s => s.name === 'Converging floor'), div = r.solids.find(s => s.name === 'Diverging floor');
  if (!(near(thr.top[1][2] * 2, d.W, 1e-6) && near(thr.top[2][1], -d.H, 1e-6) && near(con.top[0][0], -d.D, 1e-6) && near(con.top[0][2] * -2, d.A, 1e-6) && near(div.top[2][0], d.E + d.F, 1e-6) && near(div.top[2][2] * 2, d.B, 1e-6) && near(div.top[2][1], -d.K, 1e-6))) { geoOk = false; msgs.push(id + ' dims'); }
  const water = r.solids.filter(s => s.group === 'Water (schematic)'); if (!water.every(s => Math.max(...s.top.map(p => p[1])) <= o.Ha + 1e-9)) { geoOk = false; msgs.push(id + ' water above Ha'); }
  if (!(o.Ha < d.G)) { geoOk = false; msgs.push(id + ' Ha above wall'); }
}
t('geometry: 13 sizes build with positive volumes, five groups, Table 1 dimensions at the right places, water not above Ha', geoOk, msgs.join(' '));
const dm24 = P.pfDimensions(data, '24in'); t('dimensions: 24 in flume D = 58 7/8 in = 1.4954 m, throat width 0.6096 m', near(dm24.D, 58.875 * IN, 1e-9) && near(dm24.W, 0.6096, 1e-9));

// the model page
const html = readFileSync(new URL('../../' + PAGE, import.meta.url), 'utf8');
t('page is up to date with the engine, data and template (run node tools/build-parshall-page.mjs if not)', html === buildParshallPage());
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const API = new Function(scripts[0] + '\nreturn { PF_DATA, pfFreeFlow, pfHeadForFlow, pfInstallation, pfSelect, pfChecks, pfDimensions, pfBuild, pfMesh };')();
t('page: embedded data equals core/library/wtp/data/parshall.json', JSON.stringify(API.PF_DATA) === JSON.stringify(data));
t('page: bundled engine gives the same results as core/engine', ids.every(id => near(API.pfFreeFlow(API.PF_DATA, id, 0.8 * FT).Q_m3s, P.pfFreeFlow(data, id, 0.8 * FT).Q_m3s, 1e-15)) && API.pfSelect(API.PF_DATA, { Qmax_m3s: 10 * CFS, downstreamDepth_m: 0.8 * FT, allowedLoss_m: 0.5 * FT }).id === '24in');
t('page: bundled geometry equals core/engine geometry', JSON.stringify(API.pfBuild(Object.fromEntries(Object.entries(API.pfDimensions(API.PF_DATA, '12in')).map(([k, v]) => [k, v * 1000])), { channelW: 900, approachLen: 3000, tailLen: 800, wall: 150, slab: 150, Ha: 300, Hd: 100, withWater: true }).bbox) === JSON.stringify(G.pfBuild(Object.fromEntries(Object.entries(P.pfDimensions(data, '12in')).map(([k, v]) => [k, v * 1000])), { channelW: 900, approachLen: 3000, tailLen: 800, wall: 150, slab: 150, Ha: 300, Hd: 100, withWater: true }).bbox));
let syntax = true; try { new Function(scripts[1]); } catch (e) { syntax = false; console.log(e.message); }
t('page: 3D and UI script parses', syntax && html.includes('evlab-kit.js') && html.includes('Parshall Flume'));
t('page: states that submerged flow and structural design are not covered', /Submerged-flow discharge needs the report/.test(html) && /not structural design/.test(html));

// library state
const errs = validate(reg); t('library validates with the Parshall type at model3d', errs.length === 0 && reg.types.get(K).status === 'model3d', errs.slice(0, 2).join(' | '));
console.log(fail ? `\n${fail} FAILED` : '\nALL PARSHALL TESTS PASSED'); process.exit(fail ? 1 : 0);
