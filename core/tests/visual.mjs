// Visual mesh tests: every component in manifest.json has a real, valid visual mesh (non-empty, finite, sane bounding box),
// triangle winding agrees with the normals, end faces sit on the ports, the flange table equals library/standards, and
// GLB / OBJ export use the visual mesh.
import { readFileSync } from 'node:fs';
import { visualOf, visualItems, partsBounds, BUILDERS } from '../engine/visual/index.js';
import { flange } from '../engine/visual/flange.js';
import { FLANGE } from '../engine/visual/flange-data.js';
import { resolveParams, flatten } from '../engine/assembly.js';
import { materialize } from '../engine/generate.js';
import { evalExpr } from '../engine/expr.js';
import { autoAttach } from '../engine/snap.js';
import { toGLB, toOBJ } from '../engine/export.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const ids = J('library/components/manifest.json').components, lib = {}; for (const id of ids) lib[id] = J('library/components/' + id + '.json');
const prules = J('rules/port-rules.json');

function meshStats(parts) {
  let tris = 0, agree = 0, nonFinite = 0, unit = 0, verts = 0;
  for (const p of parts) {
    for (const v of p.pos) if (!Number.isFinite(v)) nonFinite++;
    for (let i = 0; i < p.nor.length; i += 3) { verts++; if (Math.abs(Math.hypot(p.nor[i], p.nor[i + 1], p.nor[i + 2]) - 1) < 1e-3) unit++; }
    for (const k of p.idx) if (!(k < p.pos.length / 3)) nonFinite++;
    for (let i = 0; i < p.idx.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map(q => p.idx[i + q] * 3);
      const u = [0, 1, 2].map(k => p.pos[b + k] - p.pos[a + k]), v = [0, 1, 2].map(k => p.pos[c + k] - p.pos[a + k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], L = Math.hypot(...n);
      if (L < 1e-9) continue; tris++;
      const vn = [0, 1, 2].map(k => p.nor[a + k] + p.nor[b + k] + p.nor[c + k]);
      if (n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2] > 0) agree++;
    }
  }
  return { tris, windingOK: tris ? agree / tris : 0, nonFinite, unitNormals: verts ? unit / verts : 0 };
}

// 1. every component of the manifest, default size
for (const id of ids) {
  const c = lib[id], p = resolveParams(c, {}); let parts;
  try { parts = visualOf(c, p); } catch (e) { t(`${id}: visual mesh builds`, false, e.message); continue; }
  const b = partsBounds(parts), s = meshStats(parts), size = b.max.map((v, k) => v - b.min[k]);
  t(`${id}: non-empty visual mesh (${parts.length} parts, ${s.tris} triangles)${BUILDERS[c.visual || id] ? ' [real shape]' : ' [from solid shapes]'}`, parts.length > 0 && s.tris > 0);
  t(`${id}: valid bounding box`, size.every(v => Number.isFinite(v) && v > 1 && v < 20000), size.map(Math.round).join(' x '));
  t(`${id}: finite numbers, unit normals, winding matches normals`, s.nonFinite === 0 && s.unitNormals > 0.999 && s.windingOK > 0.995, `winding ${(s.windingOK * 100).toFixed(1)}%`);
}

// 2. the water-supply parts with a real shape build at every table size and both pressure classes
const REAL = Object.keys(BUILDERS);
let built = 0, tried = 0;
for (const id of REAL) {
  const c = lib[id], opts = [{}];
  if (id === 'di-reducer') for (const [DN, DN2] of [[150, 100], [250, 150], [300, 200], [400, 200], [600, 400]]) for (const PN of [10, 16]) opts.push({ DN, DN2, PN });
  else if (c.parameters?.DN) for (const key of Object.keys(Object.values(c.derived || {})[0]?.table || { 100: 1, 150: 1, 200: 1, 250: 1, 300: 1, 400: 1, 500: 1, 600: 1 })) if (c.parameters.DN.min <= +key && +key <= c.parameters.DN.max) for (const PN of [10, 16]) opts.push({ DN: +key, PN });
  for (const o of opts) { tried++; try { const parts = visualOf(c, resolveParams(c, o)); if (parts.length && meshStats(parts).windingOK > 0.995) built++; else t(`${id} ${JSON.stringify(o)} bad mesh`, false); } catch (e) { t(`${id} ${JSON.stringify(o)}`, false, e.message); } }
}
t(`real-shape parts build at all table sizes and PN10 / PN16 (${built} of ${tried})`, built === tried);
for (const d of [{ turn: 'down' }, { turn: 'left' }, { turn: 'right' }]) { const c = lib['di-bend-90']; t('bend turn ' + d.turn, visualOf(c, resolveParams(c, d)).length === 3); }
for (const d of [{ branch: 'down' }, { branch: 'left' }]) { const c = lib['di-tee']; t('tee branch ' + d.branch, visualOf(c, resolveParams(c, d)).length === 4); }
{ const c = lib['gate-valve']; const a = partsBounds(visualOf(c, resolveParams(c, { open: 0 }))), b = partsBounds(visualOf(c, resolveParams(c, { open: 1 }))); t('gate valve stem rises when open', b.max[2] > a.max[2]); }

// 3. the pressure-bearing mesh (flanges, barrels, bodies) ends exactly on every port face: nothing beyond the port plane, the flange touches it.
//    Operators (handwheel, lever, gearbox, motor ...) may reach sideways, they are not checked here.
for (const id of REAL) {
  const c = lib[id], p = resolveParams(c, {}), parts = visualOf(c, p), m = materialize(c, p), num = v => (typeof v === 'string' ? evalExpr(v, p) : v);
  for (const pt of m.ports) {
    const at = pt.at.map(num), dir = pt.dir.map(num); let reach = -Infinity;
    for (const q of parts) if (/^(flange|barrel|body|tube|cone|suction|disc$)/.test(q.name)) for (let i = 0; i < q.pos.length; i += 3) reach = Math.max(reach, (q.pos[i] - at[0]) * dir[0] + (q.pos[i + 1] - at[1]) * dir[1] + (q.pos[i + 2] - at[2]) * dir[2]);
    t(`${id} port ${pt.id}: flange face lies on the port plane`, Math.abs(reach) < 0.5, `reach ${reach.toFixed(2)} mm`);
  }
}
// 4. flange: real holes (count), table equals library/standards
const std = J('../library/standards/en1092-2-flanges.json');
let same = true; for (const PN of ['PN10', 'PN16']) for (const [dn, row] of Object.entries(std[PN])) if (JSON.stringify(FLANGE[PN][dn]) !== JSON.stringify(row)) { same = false; console.log('  differs', PN, dn); }
t('flange table in visual/flange-data.js equals library/standards/en1092-2-flanges.json', same);
{ const f = flange(300, 16), holeWalls = f.verts; const solid = flange(300, 16, { blind: true });
  // area of the back face (z = T): ring minus bolt holes
  let area = 0; for (let i = 0; i < f.idx.length; i += 3) { const P = k => [f.pos[f.idx[i + k] * 3], f.pos[f.idx[i + k] * 3 + 1], f.pos[f.idx[i + k] * 3 + 2]], [a, b, c] = [P(0), P(1), P(2)]; if ([a, b, c].every(q => Math.abs(q[2] - 24.5) < 1e-6)) area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; }
  const expect = Math.PI * (230 ** 2 - 150 ** 2) - 12 * Math.PI * 12 ** 2;
  t('DN300 PN16 flange: back face = ring minus 12 bolt holes of 24 mm', Math.abs(area - expect) / expect < 0.01, `${area.toFixed(0)} vs ${expect.toFixed(0)} mm2`);
  t('blind flange has no bore', solid.verts > 0 && solid.verts < f.verts); }

// 5. assembly level: instances get the visual mesh; export uses it
const start = { name: 't', units: 'mm', links: [], instances: [{ id: 'p1', component: 'di-pipe-fl', params: {}, pos: [0, 0, 0], rot: [0, 0, 0] }] };
{ const r = autoAttach(start, lib, 'p1', 'gate-valve', prules); t('gate valve attaches to the pipe', !r.error, r.error || ''); const asm = r.assembly;
  const vis = visualItems(asm, lib), items = flatten(asm, lib).items;
  t('visualItems: every instance has parts with its transform', vis.length > 5 && vis.every(v => v.T && v.part));
  const glb = toGLB(items, 'x', vis), obj = toOBJ(items, 'x', vis), glbOld = toGLB(items, 'x');
  const head = new DataView(glb.buffer); const jl = head.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(glb.slice(20, 20 + jl)));
  t('GLB export starts with glTF and uses the visual mesh', head.getUint32(0, true) === 0x46546C67 && json.meshes.length === vis.length && json.meshes.length > items.filter(i => i.role === 'solid').length);
  t('GLB materials are double sided (hollow parts)', json.materials.every(m => m.doubleSided));
  t('OBJ export has one object per visual part', (obj.match(/^o /gm) || []).length === vis.length);
  t('old export (no visuals) still works', glbOld.length > 100);
  // a part must not be bigger than its collision envelope by more than a flange or handwheel
  const env = flatten(asm, lib).items.filter(i => i.role === 'solid'); t('assembly still flattens for collision', env.length > 0); }
console.log(fail ? `\n${fail} FAILED` : '\nvisual tests passed'); process.exit(fail ? 1 : 0);
