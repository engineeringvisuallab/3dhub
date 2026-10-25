// Drawing sheet tests: assembly -> meshes -> sheet (plan, elevations, sections) -> DXF / SVG.
import { readFileSync } from 'node:fs';
import { flatten } from '../engine/assembly.js';
import { assemblyBounds, buildSheet, cutToEngine, drawingMeshes, sheetSVG } from '../engine/drawing.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const lib = {}; for (const id of J('library/components/manifest.json').components) lib[id] = J('library/components/' + id + '.json');
// the engine is a plain browser script (globals); load it here the same way
const engine = new Function(readFileSync(new URL('../../docs/vdraw-engine.js', import.meta.url), 'utf8') + '\n;return { vdBuild, vdDXF };')();
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const count = (sh, layer, vi) => sh.items.filter(i => i.t === 'L' && i.l === layer && (vi === undefined || i.vi === vi)).length;

// cut plane mapping (Studio Z-up -> engine Y-up)
t('cut x', JSON.stringify(cutToEngine('x', 1500, 'A').p) === '[1.5,0,0]');
t('cut y (engine z = -y)', JSON.stringify(cutToEngine('y', 1500, 'A').p) === '[0,0,-1.5]');
t('cut z (horizontal)', JSON.stringify(cutToEngine('z', 1000, 'B').d) === '[0,1,0]');
try { cutToEngine('w', 0, 'A'); t('bad axis rejected', false); } catch { t('bad axis rejected', true); }

// a single wall 3000 x 230 x 2000 at the origin: section sizes are known
const wall = { name: 'Wall', units: 'mm', links: [], instances: [{ id: 'W1', component: 'brick-wall', params: { L: 3000, t: 230, H: 2000 }, pos: [0, 0, 1000], rot: [0, 0, 0] }] };
const wItems = flatten(wall, lib).items, wb = assemblyBounds(wItems);
t('bounds of the wall (mm)', [3000, 230, 2000].every((v, k) => Math.abs(wb.max[k] - wb.min[k] - v) < 0.5), JSON.stringify(wb));
let sh = buildSheet(wItems, { name: 'Wall', cuts: [{ axis: 'x', pos: 0 }, { axis: 'y', pos: 0 }], parts: { 'brick-wall': 1 } }, engine);
t('7 views: plan, 4 elevations, 2 sections', sh.views.length === 7, sh.views.map(v => v.n).join(' | '));
const [plan, front] = sh.views;
t('plan is 3000 wide x 230 deep', Math.abs(plan.w - 3000) < 1 && Math.abs(plan.h - 230) < 1, `${plan.w} x ${plan.h}`);
t('front elevation is 3000 wide x 2000 high', Math.abs(front.w - 3000) < 1 && Math.abs(front.h - 2000) < 1, `${front.w} x ${front.h}`);
for (let i = 0; i < 7; i++) t(`view ${i} (${sh.views[i].n.slice(0, 22)}) has outline`, count(sh, 'A-VIS', i) + count(sh, 'A-CUT', i) > 0);
t('section across X has cut outline and hatch', count(sh, 'A-CUT', 5) > 0 && count(sh, 'A-HATCH', 5) > 0, `${count(sh, 'A-CUT', 5)} cut, ${count(sh, 'A-HATCH', 5)} hatch`);
t('section across Y has cut outline and hatch', count(sh, 'A-CUT', 6) > 0 && count(sh, 'A-HATCH', 6) > 0, `${count(sh, 'A-CUT', 6)} cut, ${count(sh, 'A-HATCH', 6)} hatch`);
t('section marks (line + arrows + letters) are drawn on the other views', count(sh, 'A-SECT') >= 6 && sh.items.some(i => i.t === 'T' && i.s === 'A') && sh.items.some(i => i.t === 'T' && i.s === 'B'));
t('a cut outside the model has no cut outline', count(buildSheet(wItems, { cuts: [{ axis: 'x', pos: 9000 }] }, engine), 'A-CUT') === 0);

// DXF and SVG
const dxf = engine.vdDXF(sh), nLines = sh.items.filter(i => i.t === 'L').length;
t('DXF has the entities section and ends with EOF', dxf.includes('ENTITIES') && dxf.trimEnd().endsWith('EOF'));
t('DXF has one LINE per line', (dxf.match(/\nLINE\n/g) || []).length === nLines, `${nLines}`);
const svg = sheetSVG(sh);
t('SVG is one closed document', svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>') && (svg.match(/<svg/g) || []).length === 1);
t('SVG has a path per layer and the sheet text', svg.includes('stroke="#c00"') && svg.includes('SECTION A-A') && svg.includes('EVLab 3D Hub'));

// a real assembly: the pump station example
const pump = J('examples/pump-station-line.assembly.json'), pItems = flatten(pump, lib).items, pb = assemblyBounds(pItems);
sh = buildSheet(pItems, { name: pump.name, cuts: [{ axis: 'y', pos: (pb.min[1] + pb.max[1]) / 2 }, { axis: 'z', pos: 1000 }] }, engine);
t('pump station: sheet builds, ' + drawingMeshes(pItems).length + ' meshes, ' + sh.items.length + ' items', sh.items.length > 100);
t('pump station: plan size equals the model size', Math.abs(sh.views[0].w - (pb.max[0] - pb.min[0])) < 1 && Math.abs(sh.views[0].h - (pb.max[1] - pb.min[1])) < 1);
try { buildSheet(pItems, { cuts: [{ axis: 'x', pos: 0 }, { axis: 'y', pos: 0 }, { axis: 'z', pos: 0 }] }, engine); t('3 sections rejected', false); } catch { t('3 sections rejected', true); }
try { buildSheet([], {}, engine); t('empty assembly rejected', false); } catch { t('empty assembly rejected', true); }
console.log(fail ? `\n${fail} FAILED` : '\nall drawing tests passed'); process.exit(fail ? 1 : 0);
