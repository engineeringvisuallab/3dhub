// Builds the example design "Pump house on a clear water reservoir (3 pumps)" from library components only.
//
//   node tools/build-pump-house.mjs            -> writes core/examples/pump-house-cwr.assembly.json and prints the checks
//
// Every number that defines the design is in the object D below. Change it, run the script, load the result in the Studio.
// Pipe lines are built with the same attach logic as the Studio (core/engine/snap.js autoAttach), so every flange meets its
// partner exactly. Walls, columns, beams and slabs are placed by position (the Studio has no corner part yet).
// Axes: X = length of the building, Y = width, Z = up. Z = 0 is the underside of the reservoir base slab. Units: mm.
import { readFileSync, writeFileSync } from 'node:fs';
import { autoAttach, brokenLinks, worldPorts } from '../core/engine/snap.js';
import { check } from '../core/engine/collision.js';
import { resolveParams } from '../core/engine/assembly.js';
import { materialize } from '../core/engine/generate.js';
import { serialize } from '../core/engine/io.js';

const core = new URL('../core/', import.meta.url);
const J = p => JSON.parse(readFileSync(new URL(p, core)));
const lib = {};
for (const id of J('library/components/manifest.json').components) lib[id] = J('library/components/' + id + '.json');
const prules = J('rules/port-rules.json'), crules = J('rules/conflict-rules.json');

// ------------------------------------------------------------------------------------------------ design data
export const D = {
  // clear water reservoir (CWR)
  cwr: { L: 15000, W: 8000, baseT: 300, wallT: 300, wallH: 3500, roofT: 300 },
  // pump house on the CWR roof (framed: RCC columns + beams + roof slab, brick infill walls)
  ph: { L: 12000, W: 6000, col: 300, wallT: 230, bay: 2925, bays: 4, wallH: 4000, beamB: 300, beamD: 500, roofT: 150, overhang: 150 },
  // pumps: 2 duty + 1 standby, same size, vertical in-line sets on RCC plinths in bays 1 to 3 (bay 4 = control room)
  pump: { n: 3, DN: 200, PN: 16, y: -850, plinthT: 300, grout: 15, plinthL: 700, plinthW: 1000, djFTF: 250, lenDischarge: 500 },
  // common discharge header (DN300) along X on the north side; leaves the building through the west gable
  header: { DN: 300, airDN: 150, exitDJ: 300, exitPipe: 1200 },
  inlet: { DN: 300, x: -5000, z: 3450, len: 2000 },
  bellClear: 300                                                                              // bell mouth bottom above the reservoir floor
};
const r = v => Math.round(v * 1000) / 1000;
const C = D.cwr, P = D.ph, PU = D.pump, H = D.header;
const zFloorCWR = C.baseT, zRoofUnder = zFloorCWR + C.wallH, zFloor = zRoofUnder + C.roofT;       // 300, 3800, 4100
const zPumpBase = zFloor + PU.plinthT + PU.grout;
const zAxis = zPumpBase + PU.DN * 0.8;                                                           // flange axis of the pumps (port height 0.8 DN)
const zWallTop = zFloor + P.wallH, zBeamTop = zWallTop + P.beamD;
const halfL = P.L / 2, halfW = P.W / 2, col = P.col, wt = P.wallT;
const xCols = Array.from({ length: P.bays + 1 }, (_, i) => -halfL + col / 2 + i * P.bay);       // -5850 .. 5850
const yCols = [-(halfW - col / 2), halfW - col / 2];                                            // -2850, 2850
const xPump = Array.from({ length: PU.n }, (_, i) => (xCols[i] + xCols[i + 1]) / 2);            // bay centres of bays 1 to 3
// header height above the pump house floor is the pump flange axis; header y is derived from the discharge chain (see below)

// ------------------------------------------------------------------------------------------------ helpers
let asm = { name: 'Pump house on clear water reservoir (3 pumps)', units: 'mm', links: [], instances: [] };
const add = (id, component, params, pos, rot = [0, 0, 0]) => { asm.instances.push({ id, component, params, pos: pos.map(r), rot }); return id; };
const link = (a, b) => asm.links.push({ a, b });
const attach = (sel, comp, opts = {}) => {
  const res = autoAttach(asm, lib, sel, comp, prules, opts);
  if (res.error) throw new Error(`${sel} + ${comp}: ${res.error} ${(res.reasons || []).join('; ')}`);
  asm = res.assembly; return res.instance.id;
};
const port = (id, p) => worldPorts(asm, id, lib).find(q => q.id === p);
const freePort = id => { const used = new Set(asm.links.flatMap(l => [l.a, l.b])); return worldPorts(asm, id, lib).find(q => !used.has(id + '.' + q.id)); };
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const ftf = (comp, DN) => resolveParams(lib[comp], { DN }).FTF;
const portAt = (comp, params, id) => materialize(lib[comp], resolveParams(lib[comp], params)).ports.find(q => q.id === id).at;   // port position in the part's own frame
const pumpHalf = resolveParams(lib['vertical-inline-pump'], { DN: PU.DN }).L / 2;                // pump face to centre (port to port / 2)
const bendArm = Math.abs(portAt('di-bend-90', { DN: PU.DN, turn: 'down' }, 'B')[2]);          // bend face to centre
const teeArm = Math.abs(portAt('di-tee', { DN: H.DN }, 'B')[0]);                              // tee face to centre
const bellDN = 300;                                                                         // reducer used as bell mouth: big end DN300 down, DN200 up
const redLen = (big, small) => Math.max(300, Math.round(250 + 1.5 * (big - small)));         // same rule as the reducer generator
function joinTo(fromInst, toInst, toPortId) {                      // the free end of fromInst must sit exactly on toInst.toPortId: record the link
  const f = freePort(fromInst), q = port(toInst, toPortId);
  if (!f || dist(f.p, q.p) > 0.5) throw new Error(`${fromInst}.${f && f.id} does not meet ${toInst}.${toPortId} (gap ${f && dist(f.p, q.p).toFixed(1)} mm)`);
  link(`${fromInst}.${f.id}`, `${toInst}.${toPortId}`);
}

// ------------------------------------------------------------------------------------------------ 1. clear water reservoir
const hx = C.L / 2, hy = C.W / 2, ySouth = -(hy - C.wallT / 2);
add('cwr-base', 'rcc-slab', { L: C.L, W: C.W, T: C.baseT }, [0, 0, 0]);
add('cwr-wall-north', 'rcc-wall', { L: C.L, T: C.wallT, H: C.wallH }, [0, hy - C.wallT / 2, zFloorCWR]);
add('cwr-wall-west', 'rcc-wall', { L: C.W - 2 * C.wallT, T: C.wallT, H: C.wallH }, [-(hx - C.wallT / 2), 0, zFloorCWR], [0, 0, 90]);
add('cwr-wall-east', 'rcc-wall', { L: C.W - 2 * C.wallT, T: C.wallT, H: C.wallH }, [hx - C.wallT / 2, 0, zFloorCWR], [0, 0, 90]);
{ // south wall in three pieces: the middle one has the round inlet opening (accepts pipe)
  const a = -hx, b = D.inlet.x - 1000, c2 = D.inlet.x + 1000, d = hx;
  add('cwr-wall-south-1', 'rcc-wall', { L: b - a, T: C.wallT, H: C.wallH }, [(a + b) / 2, ySouth, zFloorCWR]);
  add('cwr-wall-south-inlet', 'rcc-wall-opening', { L: 2000, T: C.wallT, H: C.wallH, openDia: 400, openZ: D.inlet.z - zFloorCWR, openX: 0 }, [D.inlet.x, ySouth, zFloorCWR + C.wallH / 2]);
  add('cwr-wall-south-2', 'rcc-wall', { L: d - c2, T: C.wallT, H: C.wallH }, [(c2 + d) / 2, ySouth, zFloorCWR]);
}
// the suction pipes stand in the roof openings: centre of the suction bend of every pump
const ySuction = PU.y - pumpHalf - PU.djFTF - ftf('gate-valve', PU.DN) - bendArm;
add('cwr-roof', 'rcc-slab-openings', { L: C.L, W: C.W, T: C.roofT, openDia: 400, kerbH: 150,
  o1x: xPump[0], o1y: r(ySuction), o2x: xPump[1], o2y: r(ySuction), o3x: xPump[2], o3y: r(ySuction) }, [0, 0, zRoofUnder]);
// inlet: pipe through the wall, gate valve outside, blind flange = connection point of the inlet main
add('inlet-pipe', 'di-pipe-fl', { DN: D.inlet.DN, PN: 16, len: D.inlet.len }, [D.inlet.x, ySouth, D.inlet.z]);
attach('inlet-pipe', 'gate-valve', { fromPort: 'A', id: 'inlet-gate-valve' });
attach('inlet-gate-valve', 'blind-flange', { id: 'inlet-blind-flange' });

// ------------------------------------------------------------------------------------------------ 2. pump house structure
for (const [i, x] of xCols.entries()) for (const [j, y] of yCols.entries())
  add(`col-${i + 1}${j ? 'N' : 'S'}`, 'rcc-column', { b: col, h: col, H: P.wallH }, [x, y, zFloor + P.wallH / 2]);
// beams along X on the two long sides: the end bays run out to the outer face of the corner columns
for (const [j, y] of yCols.entries()) for (let i = 0; i < P.bays; i++) {
  const x0 = i === 0 ? -halfL : xCols[i], x1 = i === P.bays - 1 ? halfL : xCols[i + 1];
  add(`beam-long-${j ? 'N' : 'S'}${i + 1}`, 'rcc-beam', { L: x1 - x0, b: P.beamB, d: P.beamD }, [(x0 + x1) / 2, y, zWallTop]);
}
// cross beams along Y on every column line, between the long beams
for (const [i, x] of xCols.entries()) add(`beam-cross-${i + 1}`, 'rcc-beam', { L: P.W - 2 * col, b: P.beamB, d: P.beamD }, [x, 0, zWallTop], [0, 0, 90]);
add('roof-slab', 'rcc-slab', { L: P.L + 2 * P.overhang, W: P.W + 2 * P.overhang, T: P.roofT }, [0, 0, zBeamTop]);

// ---- walls, doors and windows: chains of pieces laid between the columns.
// A piece is { c: 'wall' | 'window' | 'door' | 'rcc-open', ... }. Walls with fill:true share what is left of the span equally.
const unitWidth = (comp, params) => 2 * Math.max(...materialize(lib[comp], resolveParams(lib[comp], params)).ports.map(p => Math.abs(p.at[0])));
const DOOR1 = { design: 'stflush', finish: 'grey', W: 1000, doorH: 2200, leaves: 1, t: wt, H: P.wallH };
const DOOR2 = { design: 'stflush', finish: 'grey', W: 2000, doorH: 2500, leaves: 2, t: wt, H: P.wallH };
const WIN = { W: 1200, sill: 1200, wH: 1500, t: wt, H: P.wallH };
function chain(id, start, theta, span, pieces) {
  const dir = [Math.cos(theta * Math.PI / 180), Math.sin(theta * Math.PI / 180)].map(v => (Math.abs(v) < 1e-9 ? 0 : v));
  const sized = pieces.map(p => ({ ...p, w: p.c === 'door' ? unitWidth('door', p.params) : p.c === 'window' ? p.params.W : p.L }));
  const fixed = sized.filter(p => !p.fill).reduce((s, p) => s + p.w, 0), nf = sized.filter(p => p.fill).length;
  if (!nf) { if (Math.abs(fixed - span) > 0.5) throw new Error(`${id}: pieces ${fixed} mm <> span ${span} mm`); }
  else { const share = (span - fixed) / nf; if (share < 100) throw new Error(`${id}: pieces are ${fixed} mm, span only ${span} mm`); sized.filter(p => p.fill).forEach(p => { p.w = share; }); }
  let cur = 0, prev = null;
  sized.forEach((p, k) => {
    const mid = cur + p.w / 2, pos = [start[0] + dir[0] * mid, start[1] + dir[1] * mid, zFloor], pid = `${id}-${k + 1}`;
    if (p.c === 'wall') add(pid, 'brick-wall', { L: p.w, t: wt, H: P.wallH }, pos, [0, 0, theta]);
    else if (p.c === 'window') add(pid, 'window', p.params, pos, [0, 0, theta]);
    else if (p.c === 'door') add(pid, 'door', p.params, pos, [0, 0, theta]);
    else if (p.c === 'rcc-open') {                                  // RCC wall piece with a round pipe opening on the pipe axis (world point p.at)
      const openX = (p.at[0] - pos[0]) * dir[0] + (p.at[1] - pos[1]) * dir[1];
      add(pid, 'rcc-wall-opening', { L: p.w, T: wt, H: P.wallH, openDia: p.dia, openZ: zAxis - zFloor, openX: r(openX) }, [pos[0], pos[1], zFloor + P.wallH / 2], [0, 0, theta]);
    }
    const hasPorts = p.c !== 'rcc-open';
    if (prev && hasPorts && prev.hasPorts) link(`${prev.id}.R`, `${pid}.L`);
    prev = { id: pid, hasPorts }; cur += p.w;
  });
}
const wall = L => ({ c: 'wall', L }), fillWall = { c: 'wall', fill: true }, win = { c: 'window', params: WIN };
const door1 = { c: 'door', params: DOOR1 }, door2 = { c: 'door', params: DOOR2 };
const yS = -(halfW - wt / 2), yN = halfW - wt / 2, xW = -(halfL - wt / 2), xE = halfL - wt / 2;   // wall centre lines (outer faces flush with the columns)
const bay = i => [xCols[i] + col / 2, xCols[i + 1] - col / 2];                                  // clear span between two columns (bay i, 0 based)
const yClear = [-(halfW - col), halfW - col];                                                     // clear span of a gable between the corner columns

// the discharge chain decides where the header runs (y of the header), so it is built first and the walls follow
// ------------------------------------------------------------------------------------------------ 3. pumps and piping
const yp = PU.y;
const headerY = yp + pumpHalf + PU.djFTF + ftf('check-valve', PU.DN) + ftf('butterfly-valve', PU.DN) + PU.lenDischarge + redLen(H.DN, PU.DN) + teeArm;   // pump half + DJ + check + butterfly + pipe + reducer + tee arm
const teeIds = [], pumpIds = [];
for (let k = 0; k < PU.n; k++) {
  const n = k + 1, x = xPump[k];
  add(`plinth-${n}`, 'pump-plinth', { L: PU.plinthL, W: PU.plinthW, T: PU.plinthT }, [x, yp, zFloor]);
  const pump = add(`pump-${n}`, 'vertical-inline-pump', { DN: PU.DN, PN: PU.PN }, [x, yp, zPumpBase], [0, 0, 90]);
  pumpIds.push(pump);
  // suction side (south): pump A - dismantling joint - gate valve - bend down - pipe down through the roof - reducer used as bell mouth
  let s = attach(pump, 'dismantling-joint', { fromPort: 'A', params: { FTF: PU.djFTF }, id: `suction-dj-${n}` });
  s = attach(s, 'gate-valve', { id: `suction-gate-valve-${n}` });
  s = attach(s, 'di-bend-90', { params: { turn: 'down' }, id: `suction-bend-${n}` });
  const zBendFace = port(s, 'B').p[2];                              // lower flange face of the bend
  const bellTop = zFloorCWR + D.bellClear + redLen(bellDN, PU.DN);
  s = attach(s, 'di-pipe-fl', { params: { len: r(zBendFace - bellTop) }, id: `suction-pipe-${n}` });
  s = attach(s, 'di-reducer', { id: `suction-bell-${n}` });
  // discharge side (north): pump B - dismantling joint - check valve - butterfly valve - pipe - reducer up to the header DN - tee on the header
  let q = attach(pump, 'dismantling-joint', { fromPort: 'B', params: { FTF: PU.djFTF }, id: `discharge-dj-${n}` });
  q = attach(q, 'check-valve', { id: `check-valve-${n}` });
  q = attach(q, 'butterfly-valve', { id: `isolating-valve-${n}` });
  q = attach(q, 'di-pipe-fl', { params: { len: PU.lenDischarge }, id: `discharge-pipe-${n}` });
  q = attach(q, 'di-reducer', { id: `discharge-reducer-${n}` });
  const rA = freePort(q);                                           // big end (DN300) of the reducer faces the header
  const tee = add(`header-tee-${n}`, 'di-tee', { DN: H.DN, PN: PU.PN, branch: 'right' }, [rA.p[0], rA.p[1] + teeArm, rA.p[2]]);   // branch (right = -Y) points back to the pump
  joinTo(q, tee, 'C'); teeIds.push(tee);
  if (Math.abs(rA.p[1] + teeArm - headerY) > 0.01) throw new Error('header y does not match the discharge chain');
}
// header pipes between the tees; an air valve tee in the middle of the longer span
const teeX = xPump, spanLen = teeX[1] - teeX[0] - 2 * teeArm;
const hp = (id, from, fromPort, len) => attach(from, 'di-pipe-fl', { fromPort, params: { len }, id });
for (let k = 0; k < PU.n - 1; k++) {
  const a = teeIds[k], b = teeIds[k + 1], n = k + 1;
  if (k === 1) {                                                    // between tee 2 and tee 3: pipe - air tee (branch up) - pipe
    const half = (spanLen - 2 * teeArm) / 2;
    let p1 = hp(`header-pipe-${n}a`, a, 'B', half);
    const air = attach(p1, 'di-tee', { params: { branch: 'up' }, toPort: 'A', id: 'air-valve-tee' });
    const p2 = attach(air, 'di-pipe-fl', { fromPort: 'B', params: { len: half }, id: `header-pipe-${n}b` });
    joinTo(p2, b, 'A');
    const red = attach(air, 'di-reducer', { fromPort: 'C', params: { DN2: H.airDN }, id: 'air-valve-reducer' });
    attach(red, 'air-valve', { id: 'air-valve-1' });
  } else { const p1 = hp(`header-pipe-${n}`, a, 'B', spanLen); joinTo(p1, b, 'A'); }
}
attach(teeIds[PU.n - 1], 'blind-flange', { fromPort: 'B', id: 'header-end-flange' });
// header outlet (west): dismantling joint - butterfly valve - pipe through the gable - flow meter - blind flange (connection of the rising main)
let o = attach(teeIds[0], 'dismantling-joint', { fromPort: 'A', params: { FTF: H.exitDJ }, id: 'outlet-dj' });
o = attach(o, 'butterfly-valve', { id: 'outlet-valve' });
o = attach(o, 'di-pipe-fl', { params: { len: H.exitPipe }, id: 'outlet-pipe' });
o = attach(o, 'flow-meter', { id: 'outlet-flow-meter' });
attach(o, 'blind-flange', { id: 'outlet-blind-flange' });

// ------------------------------------------------------------------------------------------------ 4. walls, doors, windows
// south long wall: one window in the middle of every bay
for (let i = 0; i < P.bays; i++) { const [a, b] = bay(i); chain(`wall-S${i + 1}`, [a, yS], 0, b - a, [fillWall, win, fillWall]); }
// north long wall (outside = +Y, chain runs -X, starting at the east end)
{ const [a4, b4] = bay(3); chain('wall-N4', [b4, yN], 180, b4 - a4, [fillWall]);                  // control room: plain wall (panels stand against it)
  const [a3, b3] = bay(2); chain('wall-N3', [b3, yN], 180, b3 - a3, [door1, fillWall]);           // personal door into the pump hall
  for (const i of [1, 0]) { const [a, b] = bay(i); chain(`wall-N${i + 1}`, [b, yN], 180, b - a, [fillWall, win, fillWall]); } }
// west gable (outside = -X, chain runs -Y from the north corner): header outlet opening and the equipment door
chain('wall-W', [xW, yClear[1]], -90, yClear[1] - yClear[0],
  [wall(596), { c: 'rcc-open', L: 1200, dia: 400, at: [xW, headerY] }, wall(500), door2, fillWall]);
// east gable (outside = +X, chain runs +Y): control room door and window
chain('wall-E', [xE, yClear[0]], 90, yClear[1] - yClear[0], [wall(600), door1, wall(800), win, fillWall]);
// partition between pump hall and control room (on the column line of bay 4), door near the south wall
chain('wall-P', [xCols[3], yClear[0]], 90, yClear[1] - yClear[0], [wall(800), door1, fillWall]);
// control room equipment: starter / PLC panels along the north wall, fronts face -Y
[3500, 4350, 5200].forEach((x, i) => add(`panel-${i + 1}`, 'control-panel', { W: 800, D: 600, H: 2000 }, [x, yN - wt / 2 - 300, zFloor]));

// ------------------------------------------------------------------------------------------------ 5. reinforcement (cages generated from the shared rebar library)
asm.rebarSets = [];
for (const ins of asm.instances) if (ins.component === 'rcc-column') asm.rebarSets.push({ id: ins.id + '-cage', host: ins.id, template: 'column-cage', minCover: 40,
  params: { cover: 40, mainDia: 16, nx: 2, ny: 2, tieDia: 8, tieSpacing: 150 } });
// beams get no cage: rcc-beam has its origin at the bottom face, the beam-cage template expects the centre (open item, see docs)

// ------------------------------------------------------------------------------------------------ 6. checks and output
const t0 = Date.now();
const broken = brokenLinks(asm, lib, prules);
const res = check(asm, lib, crules);
console.log(`instances ${asm.instances.length}, links ${asm.links.length}, rebar sets ${asm.rebarSets.length}`);
console.log(`broken links: ${broken.length}`, broken.slice(0, 10));
console.log(`conflicts: ${res.conflicts.length}`); res.conflicts.slice(0, 40).forEach(c => console.log('  ' + c.msg + `  (${c.depth_mm} mm)`));
console.log(`warnings: ${res.warnings.length}`); res.warnings.slice(0, 40).forEach(c => console.log('  ' + c.msg));
console.log(`check took ${Date.now() - t0} ms for ${res.itemCount} shapes`);
console.log(`levels: floor of CWR ${zFloorCWR}, roof underside ${zRoofUnder}, pump house floor ${zFloor}, pump axis ${zAxis}, header y ${headerY}, suction bend y ${r(ySuction)}`);
const out = new URL('../core/examples/pump-house-cwr.assembly.json', import.meta.url);
if (!process.argv.includes('--dry')) { writeFileSync(out, serialize(asm) + '\n'); console.log('written', out.pathname); }
process.exitCode = broken.length || res.conflicts.length ? 1 : 0;
