// Builds the example designs "Clear water reservoir 70 x 70 m with pump sump, pump house and electrical control room" from library components only.
//
//   node tools/build-pump-house.mjs                 -> writes all example files (combined, separate, control room alone)
//   node tools/build-pump-house.mjs combined|separate|control-room [--dry]
//
//   combined      pump hall and electrical control room in ONE building on the CWR roof
//   separate      pump house and electrical control room as TWO buildings on the CWR roof
//   control-room  the electrical control room building alone (floor at Z = 0), to use or move on its own
//
// Every number that defines the design is in the object D below. Change it, run the script, load the result in the Studio.
// Pipe lines are built with the same attach logic as the Studio (core/engine/snap.js autoAttach), so every flange meets its partner exactly.
// Walls, columns, beams and slabs are placed by position (the Studio has no corner part yet).
// Axes: X, Y = plan, Z = up. Z = 0 is the underside of the pump sump slab. Plan origin = centre of the reservoir. Units: mm.
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
  // clear water reservoir (CWR): inside 70 x 70 m, water 3 m, clear height 5 m (main floor to underside of roof beams), pump sump 1.5 m deeper than the floor
  cwr: { inner: 70000, wallT: 500, raftT: 400, sumpSlabT: 400, sumpDepth: 1500, water: 3000, clearH: 5000, grid: 7000, colSize: 500, beamB: 400, beamD: 600, roofT: 300,
         sumpX: 6500, sumpY: 6500, sumpWallT: 400 },          // sump pit: 13.0 m (X) x 6.5 m (Y) inside, against the south wall, centred on X = 0
  // buildings on the CWR roof (framed: RCC columns + beams + roof slab, brick infill walls)
  hall: { col: 300, wallT: 230, bay: 3500, W: 7000, wallH: 4000, beamB: 300, beamD: 500, roofT: 150, overhang: 150 },
  // pumps: 2 duty + 1 standby, same size, vertical in-line sets on RCC plinths
  pump: { n: 3, DN: 300, PN: 16, plinthT: 300, grout: 15, plinthL: 1000, plinthW: 1300, djFTF: 250, lenDischarge: 500, bendOffset: 630 },   // bendOffset: suction bend centre from the inner face of the south wall
  header: { DN: 500, airDN: 250, exitDJ: 300, exitPipe: 1500 },
  inlet: { DN: 500, z: 5500, len: 2500 },
  bellDN: 500, bellClear: 450,                               // reducer used as bell mouth, big end down, this far above the sump floor
  controlRoomGap: 4200                                       // separate layout: clear distance between the two buildings
};
const r = v => Math.round(v * 1000) / 1000;
const C = D.cwr, P = D.hall, PU = D.pump, H = D.header;
const hx = C.inner / 2, outer = hx + C.wallT;                                          // 35000, 35500
const zSumpTop = C.sumpSlabT, zFloorCWR = zSumpTop + C.sumpDepth + 0;                    // main floor top: sump floor top + 1500
const zRaftUnder = zFloorCWR - C.raftT, zSoffit = zFloorCWR + C.clearH, zBeamTop = zSoffit + C.beamD, zRoofTop = zBeamTop + C.roofT;
const yc = -(outer - P.W / 2);                                                          // plan centre line of the buildings: flush with the south outer face

// ------------------------------------------------------------------------------------------------ helpers
let asm, mark;
const reset = name => { asm = { name, units: 'mm', links: [], instances: [] }; };
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
const portAt = (comp, params, id) => materialize(lib[comp], resolveParams(lib[comp], params)).ports.find(q => q.id === id).at;
const redLen = (big, small) => Math.max(300, Math.round(250 + 1.5 * (big - small)));   // same rule as the reducer generator
const pumpHalf = resolveParams(lib['vertical-inline-pump'], { DN: PU.DN }).L / 2;
const bendArm = Math.abs(portAt('di-bend-90', { DN: PU.DN, turn: 'down' }, 'B')[2]);
const teeArm = Math.abs(portAt('di-tee', { DN: H.DN }, 'B')[0]);
function joinTo(fromInst, toInst, toPortId) {                      // the free end of fromInst must sit exactly on toInst.toPortId: record the link
  const f = freePort(fromInst), q = port(toInst, toPortId);
  if (!f || dist(f.p, q.p) > 0.5) throw new Error(`${fromInst}.${f && f.id} does not meet ${toInst}.${toPortId} (gap ${f && dist(f.p, q.p).toFixed(1)} mm)`);
  link(`${fromInst}.${f.id}`, `${toInst}.${toPortId}`);
}
const shiftSince = (n, dx, dy) => { for (const i of asm.instances.slice(n)) { i.pos = [r(i.pos[0] + dx), r(i.pos[1] + dy), i.pos[2]]; } };

// ------------------------------------------------------------------------------------------------ 1. clear water reservoir with pump sump
const sx = C.sumpX, sy = -hx + C.sumpY;                              // sump inside: x in [-sx, sx], y in [-hx, sy]
const swT = C.sumpWallT, pitOutX = sx + swT, pitOutY = sy + swT;     // outer face of the sump walls
function buildCWR(withInlet = true) {
  // floors: sump slab (deep), main raft in three pieces around the sump
  add('sump-slab', 'rcc-slab', { L: 2 * pitOutX, W: r(pitOutY + outer), T: C.sumpSlabT }, [0, (-outer + pitOutY) / 2, 0]);
  add('raft-main', 'rcc-slab', { L: 2 * outer, W: outer - pitOutY, T: C.raftT }, [0, (outer + pitOutY) / 2, zRaftUnder]);
  const wx = outer - pitOutX;
  add('raft-west', 'rcc-slab', { L: wx, W: pitOutY + outer, T: C.raftT }, [-(outer + pitOutX) / 2, (-outer + pitOutY) / 2, zRaftUnder]);
  add('raft-east', 'rcc-slab', { L: wx, W: pitOutY + outer, T: C.raftT }, [(outer + pitOutX) / 2, (-outer + pitOutY) / 2, zRaftUnder]);
  // sump walls (retain the main floor, 1.5 m high)
  add('sump-wall-north', 'rcc-wall', { L: 2 * pitOutX, T: swT, H: C.sumpDepth }, [0, sy + swT / 2, zSumpTop]);
  add('sump-wall-west', 'rcc-wall', { L: sy + hx, T: swT, H: C.sumpDepth }, [-(sx + swT / 2), (sy - hx) / 2, zSumpTop], [0, 0, 90]);
  add('sump-wall-east', 'rcc-wall', { L: sy + hx, T: swT, H: C.sumpDepth }, [sx + swT / 2, (sy - hx) / 2, zSumpTop], [0, 0, 90]);
  // outer walls: 5 m high on the main floor; south wall in front of the sump goes down to the sump floor
  const wallH = C.clearH, wc = outer - C.wallT / 2;
  add('cwr-wall-north', 'rcc-wall', { L: 2 * outer, T: C.wallT, H: wallH }, [0, wc, zFloorCWR]);
  add('cwr-wall-west', 'rcc-wall', { L: C.inner, T: C.wallT, H: wallH }, [-wc, 0, zFloorCWR], [0, 0, 90]);
  add('cwr-wall-south-west', 'rcc-wall', { L: outer - pitOutX, T: C.wallT, H: wallH }, [-(outer + pitOutX) / 2, -wc, zFloorCWR]);
  add('cwr-wall-south-sump', 'rcc-wall', { L: 2 * pitOutX, T: C.wallT, H: wallH + C.sumpDepth }, [0, -wc, zSumpTop]);
  add('cwr-wall-south-east', 'rcc-wall', { L: outer - pitOutX, T: C.wallT, H: wallH }, [(outer + pitOutX) / 2, -wc, zFloorCWR]);
  if (withInlet) { // east wall in three pieces: the middle one carries the inlet opening
    const a = 1000;
    add('cwr-wall-east-1', 'rcc-wall', { L: hx - a, T: C.wallT, H: wallH }, [wc, -(hx + a) / 2, zFloorCWR], [0, 0, 90]);
    add('cwr-wall-east-inlet', 'rcc-wall-opening', { L: 2 * a, T: C.wallT, H: wallH, openDia: 700, openZ: D.inlet.z - zFloorCWR, openX: 0 }, [wc, 0, zFloorCWR + wallH / 2], [0, 0, 90]);
    add('cwr-wall-east-2', 'rcc-wall', { L: hx - a, T: C.wallT, H: wallH }, [wc, (hx + a) / 2, zFloorCWR], [0, 0, 90]);
    add('inlet-pipe', 'di-pipe-fl', { DN: D.inlet.DN, PN: 16, len: D.inlet.len }, [wc, 0, D.inlet.z], [0, 0, 90]);
    const a1 = port('inlet-pipe', 'A'), b1 = port('inlet-pipe', 'B'), far = a1.p[0] > b1.p[0] ? 'A' : 'B';   // the end outside (larger X)
    attach('inlet-pipe', 'gate-valve', { fromPort: far, id: 'inlet-gate-valve' });
    attach('inlet-gate-valve', 'blind-flange', { id: 'inlet-blind-flange' });
  } else add('cwr-wall-east', 'rcc-wall', { L: C.inner, T: C.wallT, H: wallH }, [wc, 0, zFloorCWR], [0, 0, 90]);
  // roof structure: 9 x 9 interior columns on a 7 m grid, beams both ways, roof slab in strips
  const g = C.grid, lines = [-hx - C.wallT / 2, ...Array.from({ length: 9 }, (_, i) => (i - 4) * g), hx + C.wallT / 2];   // beam lines; the outer ones sit on the wall centre lines
  for (let i = 1; i <= 9; i++) for (let j = 1; j <= 9; j++)
    add(`cwr-col-${i}-${j}`, 'rcc-column', { b: C.colSize, h: C.colSize, H: C.clearH }, [lines[i], lines[j], zFloorCWR + C.clearH / 2]);
  for (let j = 0; j < 11; j++) for (let i = 0; i < 10; i++) {
    const x0 = lines[i], x1 = lines[i + 1];
    add(`cwr-beam-x-${j}-${i}`, 'rcc-beam', { L: x1 - x0, b: C.beamB, d: C.beamD }, [(x0 + x1) / 2, lines[j], zSoffit]);
  }
  for (let i = 0; i < 11; i++) for (let j = 0; j < 10; j++) {
    const y0 = lines[j], y1 = lines[j + 1];
    add(`cwr-beam-y-${i}-${j}`, 'rcc-beam', { L: y1 - y0 - C.beamB, b: C.beamB, d: C.beamD }, [lines[i], (y0 + y1) / 2, zSoffit], [0, 0, 90]);
  }
  return lines;
}
function buildRoof(lines, openings) {                                // strips along X; the south strip (over the sump) has the three pipe openings
  for (let j = 0; j < 10; j++) {
    const y0 = j === 0 ? -outer : lines[j], y1 = j === 9 ? outer : lines[j + 1];
    if (j === 0 && openings) add('cwr-roof-1', 'rcc-slab-openings', { L: 2 * outer, W: y1 - y0, T: C.roofT, openDia: 500, kerbH: 150,
      o1x: openings[0][0], o1y: r(openings[0][1] - (y0 + y1) / 2), o2x: openings[1][0], o2y: r(openings[1][1] - (y0 + y1) / 2), o3x: openings[2][0], o3y: r(openings[2][1] - (y0 + y1) / 2) }, [0, (y0 + y1) / 2, zBeamTop]);
    else add(`cwr-roof-${j + 1}`, 'rcc-slab', { L: 2 * outer, W: y1 - y0, T: C.roofT }, [0, (y0 + y1) / 2, zBeamTop]);
  }
}

// ------------------------------------------------------------------------------------------------ 2. buildings (frame + walls), local coordinates, then shifted
const col = P.col, wt = P.wallT, halfW = P.W / 2;
const unitWidth = (comp, params) => 2 * Math.max(...materialize(lib[comp], resolveParams(lib[comp], params)).ports.map(p => Math.abs(p.at[0])));
const DOOR1 = (zH) => ({ design: 'stflush', finish: 'grey', W: 1000, doorH: 2200, leaves: 1, t: wt, H: P.wallH });
const DOOR2 = { design: 'stflush', finish: 'grey', W: 2000, doorH: 2500, leaves: 2, t: wt, H: P.wallH };
const WIN = { W: 1500, sill: 1200, wH: 1500, t: wt, H: P.wallH };
function chain(zF, id, start, theta, span, pieces, ctx) {
  const dir = [Math.cos(theta * Math.PI / 180), Math.sin(theta * Math.PI / 180)].map(v => (Math.abs(v) < 1e-9 ? 0 : v));
  const sized = pieces.map(p => ({ ...p, w: p.c === 'door' ? unitWidth('door', p.params) : p.c === 'window' ? p.params.W : p.L }));
  const fixed = sized.filter(p => !p.fill).reduce((s, p) => s + p.w, 0), nf = sized.filter(p => p.fill).length;
  if (!nf) { if (Math.abs(fixed - span) > 0.5) throw new Error(`${id}: pieces ${fixed} mm <> span ${span} mm`); }
  else { const share = (span - fixed) / nf; if (share < 100) throw new Error(`${id}: pieces are ${fixed} mm, span only ${span} mm`); sized.filter(p => p.fill).forEach(p => { p.w = share; }); }
  let cur = 0, prev = null;
  sized.forEach((p, k) => {
    const mid = cur + p.w / 2, pos = [start[0] + dir[0] * mid, start[1] + dir[1] * mid, zF], pid = `${id}-${k + 1}`;
    if (p.c === 'wall') add(pid, 'brick-wall', { L: p.w, t: wt, H: P.wallH }, pos, [0, 0, theta]);
    else if (p.c === 'window') add(pid, 'window', p.params, pos, [0, 0, theta]);
    else if (p.c === 'door') add(pid, 'door', p.params, pos, [0, 0, theta]);
    else if (p.c === 'rcc-open') {
      const openX = (p.at[0] - pos[0]) * dir[0] + (p.at[1] - pos[1]) * dir[1];
      add(pid, 'rcc-wall-opening', { L: p.w, T: wt, H: P.wallH, openDia: p.dia, openZ: p.zAxis - zF, openX: r(openX) }, [pos[0], pos[1], zF + P.wallH / 2], [0, 0, theta]);
    }
    const hasPorts = p.c !== 'rcc-open';
    if (prev && hasPorts && prev.hasPorts) link(`${prev.id}.R`, `${pid}.L`);
    prev = { id: pid, hasPorts }; cur += p.w;
  });
}
// need `start` visible inside chain(): small wrapper keeps the signature short
let start = [0, 0];
const run = (zF, id, st, theta, span, pieces) => { start = st; chain(zF, id, st, theta, span, pieces); };
const wall = L => ({ c: 'wall', L }), fillWall = { c: 'wall', fill: true }, win = { c: 'window', params: WIN };
const door1 = { c: 'door', params: DOOR1() }, door2 = { c: 'door', params: DOOR2 };

// frame: columns, beams, roof slab. xCols = column centre lines. Returns nothing; everything is added with prefix.
function frame(pre, zF, xCols, rebar) {
  const yCols = [-(halfW - col / 2), halfW - col / 2], x0 = xCols[0] - col / 2, x1 = xCols.at(-1) + col / 2, nb = xCols.length - 1;
  for (const [i, x] of xCols.entries()) for (const [j, y] of yCols.entries()) {
    add(`${pre}col-${i + 1}${j ? 'N' : 'S'}`, 'rcc-column', { b: col, h: col, H: P.wallH }, [x, y, zF + P.wallH / 2]);
    if (rebar) asm.rebarSets.push({ id: `${pre}col-${i + 1}${j ? 'N' : 'S'}-cage`, host: `${pre}col-${i + 1}${j ? 'N' : 'S'}`, template: 'column-cage', minCover: 40, params: { cover: 40, mainDia: 16, nx: 2, ny: 2, tieDia: 8, tieSpacing: 150 } });
  }
  const zW = zF + P.wallH;
  for (const [j, y] of yCols.entries()) for (let i = 0; i < nb; i++) {
    const a = i === 0 ? x0 : xCols[i], b = i === nb - 1 ? x1 : xCols[i + 1];
    add(`${pre}beam-long-${j ? 'N' : 'S'}${i + 1}`, 'rcc-beam', { L: b - a, b: P.beamB, d: P.beamD }, [(a + b) / 2, y, zW]);
  }
  for (const [i, x] of xCols.entries()) add(`${pre}beam-cross-${i + 1}`, 'rcc-beam', { L: P.W - 2 * col, b: P.beamB, d: P.beamD }, [x, 0, zW], [0, 0, 90]);
  add(`${pre}roof-slab`, 'rcc-slab', { L: x1 - x0 + 2 * P.overhang, W: P.W + 2 * P.overhang, T: P.roofT }, [(x0 + x1) / 2, 0, zW + P.beamD]);
}
const bayX = (xCols, i) => [xCols[i] + col / 2, xCols[i + 1] - col / 2];
const yS = -(halfW - wt / 2), yN = halfW - wt / 2, yClear = [-(halfW - col), halfW - col];

// walls of one building. roles[i] = 'pump' | 'ctrl' for every bay; west / east = kind of the end gables; partition = column index of an inner wall (or null)
function walls(pre, zF, xCols, roles, west, east, partition, hdr) {
  const nb = roles.length, xW = xCols[0] - col / 2 + wt / 2, xE = xCols.at(-1) + col / 2 - wt / 2;
  for (let i = 0; i < nb; i++) {                                    // south wall: a window in the middle of every bay
    const [a, b] = bayX(xCols, i); run(zF, `${pre}wall-S${i + 1}`, [a, yS], 0, b - a, [fillWall, win, fillWall]);
  }
  for (let i = nb - 1; i >= 0; i--) {                               // north wall (outside = +Y, chain runs -X from the east end of the bay)
    const [a, b] = bayX(xCols, i), lastPump = roles[i] === 'pump' && roles[i + 1] !== 'pump';
    if (roles[i] === 'ctrl') run(zF, `${pre}wall-N${i + 1}`, [b, yN], 180, b - a, [fillWall]);                    // panels stand against it: no window
    else if (lastPump && west === 'pump' && east !== 'pump-exit') run(zF, `${pre}wall-N${i + 1}`, [b, yN], 180, b - a, [door1, fillWall]);   // personal door into the pump hall
    else run(zF, `${pre}wall-N${i + 1}`, [b, yN], 180, b - a, [fillWall, win, fillWall]);
  }
  // west gable (outside = -X, chain runs -Y from the north corner)
  if (west === 'pump') run(zF, `${pre}wall-W`, [xW, yClear[1]], -90, yClear[1] - yClear[0], [wall(900), { c: 'rcc-open', L: 1600, dia: 700, at: [xW, hdr.y], zAxis: hdr.z }, wall(500), door2, fillWall]);
  else run(zF, `${pre}wall-W`, [xW, yClear[1]], -90, yClear[1] - yClear[0], [fillWall, win, fillWall]);
  // east gable (outside = +X, chain runs +Y from the south corner)
  if (east === 'ctrl') run(zF, `${pre}wall-E`, [xE, yClear[0]], 90, yClear[1] - yClear[0], [wall(600), door1, wall(800), win, fillWall]);
  else if (east === 'pump-exit') run(zF, `${pre}wall-E`, [xE, yClear[0]], 90, yClear[1] - yClear[0], [wall(700), door1, fillWall]);
  else run(zF, `${pre}wall-E`, [xE, yClear[0]], 90, yClear[1] - yClear[0], [fillWall, win, fillWall]);
  if (partition !== null) run(zF, `${pre}wall-P`, [xCols[partition], yClear[0]], 90, yClear[1] - yClear[0], [wall(800), door1, fillWall]);
}
// control room equipment: starter / PLC panels along the north wall (fronts face -Y) and an operator desk
function equipment(pre, zF, xFrom, xTo, xCols) {
  const yP = yN - wt / 2 - 300, free = x => xCols.every(c => Math.abs(x - c) > col / 2 + 400 + 100);     // keep panels clear of the columns on the north wall
  let k = 0;
  for (let x = xFrom + 600; x < xTo - 600 && k < 6; x += 900) if (free(x)) add(`${pre}panel-${++k}`, 'control-panel', { W: 800, D: 600, H: 2000 }, [x, yP, zF]);
  add(`${pre}desk`, 'table', { W: 1400, D: 700, Ht: 750 }, [xTo - 1300, -800, zF]);
}

// ------------------------------------------------------------------------------------------------ 3. pumps and piping (pump hall, local coordinates)
function pumpLine(zF, xPump, xColsWest) {
  const yBend = -halfW + wt + PU.bendOffset, yp = yBend + bendArm + ftf('gate-valve', PU.DN) + PU.djFTF + pumpHalf;
  const zPumpBase = zF + PU.plinthT + PU.grout, zAxis = zPumpBase + PU.DN * 0.8;
  const headerY = yp + pumpHalf + PU.djFTF + ftf('check-valve', PU.DN) + ftf('butterfly-valve', PU.DN) + PU.lenDischarge + redLen(H.DN, PU.DN) + teeArm;
  const teeIds = [];
  for (let k = 0; k < PU.n; k++) {
    const n = k + 1, x = xPump[k];
    add(`plinth-${n}`, 'pump-plinth', { L: PU.plinthL, W: PU.plinthW, T: PU.plinthT }, [x, yp, zF]);
    const pump = add(`pump-${n}`, 'vertical-inline-pump', { DN: PU.DN, PN: PU.PN }, [x, yp, zPumpBase], [0, 0, 90]);
    // suction (south): pump A - dismantling joint - gate valve - bend down - two pipes down through the roof opening - reducer used as bell mouth
    let s = attach(pump, 'dismantling-joint', { fromPort: 'A', params: { FTF: PU.djFTF }, id: `suction-dj-${n}` });
    s = attach(s, 'gate-valve', { id: `suction-gate-valve-${n}` });
    s = attach(s, 'di-bend-90', { params: { turn: 'down' }, id: `suction-bend-${n}` });
    const zBendFace = port(s, 'B').p[2], bellTop = zSumpTop + D.bellClear + redLen(D.bellDN, PU.DN), total = zBendFace - bellTop, l1 = Math.floor(total / 2 / 5) * 5;
    s = attach(s, 'di-pipe-fl', { params: { len: l1 }, id: `suction-pipe-${n}a` });
    s = attach(s, 'di-pipe-fl', { params: { len: r(total - l1) }, id: `suction-pipe-${n}b` });
    s = attach(s, 'di-reducer', { params: { DN: D.bellDN, DN2: PU.DN }, id: `suction-bell-${n}` });
    // discharge (north): pump B - dismantling joint - check valve - butterfly valve - pipe - reducer up to the header DN - tee on the header
    let q = attach(pump, 'dismantling-joint', { fromPort: 'B', params: { FTF: PU.djFTF }, id: `discharge-dj-${n}` });
    q = attach(q, 'check-valve', { id: `check-valve-${n}` });
    q = attach(q, 'butterfly-valve', { id: `isolating-valve-${n}` });
    q = attach(q, 'di-pipe-fl', { params: { len: PU.lenDischarge }, id: `discharge-pipe-${n}` });
    q = attach(q, 'di-reducer', { params: { DN: H.DN, DN2: PU.DN }, id: `discharge-reducer-${n}` });
    const rA = freePort(q);
    const tee = add(`header-tee-${n}`, 'di-tee', { DN: H.DN, PN: PU.PN, branch: 'right' }, [rA.p[0], rA.p[1] + teeArm, rA.p[2]]);
    joinTo(q, tee, 'C'); teeIds.push(tee);
    if (Math.abs(rA.p[1] + teeArm - headerY) > 0.01) throw new Error('header y does not match the discharge chain');
  }
  const spanLen = xPump[1] - xPump[0] - 2 * teeArm, hp = (id, from, fromPort, len) => attach(from, 'di-pipe-fl', { fromPort, params: { len }, id });
  for (let k = 0; k < PU.n - 1; k++) {
    const a = teeIds[k], b = teeIds[k + 1], n = k + 1;
    if (k === 1) {                                                  // between pump 2 and pump 3: pipe - air valve tee (branch up) - pipe
      const half = (spanLen - 2 * teeArm) / 2, p1 = hp(`header-pipe-${n}a`, a, 'B', half);
      const air = attach(p1, 'di-tee', { params: { branch: 'up' }, toPort: 'A', id: 'air-valve-tee' });
      const p2 = attach(air, 'di-pipe-fl', { fromPort: 'B', params: { len: half }, id: `header-pipe-${n}b` });
      joinTo(p2, b, 'A');
      const red = attach(air, 'di-reducer', { fromPort: 'C', params: { DN2: H.airDN }, id: 'air-valve-reducer' });
      attach(red, 'air-valve', { id: 'air-valve-1' });
    } else { const p1 = hp(`header-pipe-${n}`, a, 'B', spanLen); joinTo(p1, b, 'A'); }
  }
  attach(teeIds[PU.n - 1], 'blind-flange', { fromPort: 'B', id: 'header-end-flange' });
  // outlet (west): dismantling joint - butterfly valve - pipe through the gable - flow meter - blind flange (connection of the rising main)
  let o = attach(teeIds[0], 'dismantling-joint', { fromPort: 'A', params: { FTF: H.exitDJ }, id: 'outlet-dj' });
  o = attach(o, 'butterfly-valve', { id: 'outlet-valve' });
  o = attach(o, 'di-pipe-fl', { params: { len: H.exitPipe }, id: 'outlet-pipe' });
  o = attach(o, 'flow-meter', { id: 'outlet-flow-meter' });
  attach(o, 'blind-flange', { id: 'outlet-blind-flange' });
  return { yBend, headerY, zAxis };
}

// ------------------------------------------------------------------------------------------------ 4. the three layouts
const COMBINED_COLS = [-7000, -3500, 0, 3500, 7000, 10500], PUMP_X = [-5250, -1750, 1750];
function pumpBuilding(zF, xCols, roles, east, partition, pre = '') {
  const n0 = asm.instances.length;
  frame(pre, zF, xCols, true);
  const pl = pumpLine(zF, PUMP_X, xCols[0]);
  walls(pre, zF, xCols, roles, 'pump', east, partition, { y: pl.headerY, z: pl.zAxis });
  return { n0, pl };
}
function controlRoomBuilding(pre, zF, xCols, roles, west) {
  frame(pre, zF, xCols, true);
  walls(pre, zF, xCols, roles, west, 'ctrl', null, null);
  equipment(pre, zF, xCols[0] + col / 2, xCols.at(-1) - col / 2, xCols);
}
export function build(layout) {
  const names = { combined: 'CWR 70 x 70 m with pump sump, pump house and electrical control room (one building)',
    separate: 'CWR 70 x 70 m with pump sump, pump house and a separate electrical control room', 'control-room': 'Electrical control room (stand-alone building)' };
  reset(names[layout]); asm.rebarSets = [];
  if (layout === 'control-room') {
    controlRoomBuilding('', 0, [0, 3500, 7000], ['ctrl', 'ctrl'], 'ctrl');
  } else {
    const lines = buildCWR(true);
    const zF = zRoofTop, yBend = -halfW + wt + PU.bendOffset;
    buildRoof(lines, PUMP_X.map(x => [x, yc + yBend]));
    let n0 = asm.instances.length;
    if (layout === 'combined') {
      const b = pumpBuilding(zF, COMBINED_COLS, ['pump', 'pump', 'pump', 'ctrl', 'ctrl'], 'ctrl', 3);
      equipment('', zF, COMBINED_COLS[3] + col / 2, COMBINED_COLS.at(-1) - col / 2, COMBINED_COLS);
      shiftSince(n0, 0, yc);
    } else {
      const cols = [-7000, -3500, 0, 3500];
      pumpBuilding(zF, cols, ['pump', 'pump', 'pump'], 'pump-exit', null);
      shiftSince(n0, 0, yc); n0 = asm.instances.length;
      controlRoomBuilding('cr-', zF, [0, 3500, 7000], ['ctrl', 'ctrl'], 'ctrl');
      shiftSince(n0, cols.at(-1) + col / 2 + D.controlRoomGap + col / 2, yc);
    }
    if (asm.instances.some(i => i.id === 'inlet-pipe') === false) throw new Error('no inlet');
  }
  return asm;
}

// ------------------------------------------------------------------------------------------------ 5. checks and output
function report(layout, a, dry) {
  const t0 = Date.now(), broken = brokenLinks(a, lib, prules), res = check(a, lib, crules);
  console.log(`\n== ${layout}: instances ${a.instances.length}, links ${a.links.length}, rebar sets ${a.rebarSets.length}`);
  console.log(`broken links: ${broken.length}`, broken.slice(0, 10));
  console.log(`conflicts: ${res.conflicts.length}`); res.conflicts.slice(0, 30).forEach(c => console.log('  ' + c.msg + `  (${c.depth_mm} mm)`));
  console.log(`warnings: ${res.warnings.length}`); res.warnings.slice(0, 30).forEach(c => console.log('  ' + c.msg));
  console.log(`check took ${Date.now() - t0} ms for ${res.itemCount} shapes`);
  if (!dry) { const f = new URL(`../core/examples/${layout === 'control-room' ? 'control-room' : 'cwr-' + layout}.assembly.json`, import.meta.url); writeFileSync(f, serialize(a) + '\n'); console.log('written', f.pathname); }
  return !broken.length && !res.conflicts.length;
}
if (process.argv[1] && process.argv[1].endsWith('build-pump-house.mjs')) {
  const dry = process.argv.includes('--dry'), want = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const layouts = want.length ? want : ['combined', 'separate', 'control-room'];
  console.log(`levels: sump floor top ${zSumpTop}, main floor top ${zFloorCWR}, water ${zFloorCWR + C.water}, soffit ${zSoffit}, roof top / building floor ${zRoofTop}, building centre y ${yc}`);
  let ok = true;
  for (const l of layouts) ok = report(l, build(l), dry) && ok;
  process.exitCode = ok ? 0 : 1;
}
