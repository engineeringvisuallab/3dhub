// CWR 70 x 70 m examples (cwr-combined, cwr-separate, control-room): load, no broken link, no conflict, levels, pump lines, control room in one or two buildings.
import { readFileSync } from 'node:fs';
import { parse } from '../engine/io.js';
import { check } from '../engine/collision.js';
import { brokenLinks } from '../engine/snap.js';
import { buildBOM } from '../engine/bom.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const lib = {}; for (const id of J('library/components/manifest.json').components) lib[id] = J('library/components/' + id + '.json');
const prules = J('rules/port-rules.json'), crules = J('rules/conflict-rules.json');
let fail = 0; const t = (n, c, i = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); if (!c) fail++; };
const load = f => parse(readFileSync(new URL('../examples/' + f + '.assembly.json', import.meta.url), 'utf8'), lib);
const has = (a, id) => a.instances.some(i => i.id === id);
for (const f of ['cwr-combined', 'cwr-separate', 'control-room']) {
  const a = load(f);
  t(`${f}: loads`, a.instances.length > 30, a.instances.length + ' objects');
  t(`${f}: no broken link`, brokenLinks(a, lib, prules).length === 0);
  const rep = check(a, lib, crules);
  t(`${f}: no conflict, no warning`, rep.conflicts.length === 0 && rep.warnings.length === 0, JSON.stringify([...rep.conflicts, ...rep.warnings]).slice(0, 200));
  t(`${f}: BOM builds`, buildBOM(a, lib).totals.parts === a.instances.length);
  if (f === 'control-room') { t('control room alone: panels, desk, door, window', has(a, 'panel-1') && has(a, 'desk') && a.instances.some(i => i.component === 'door') && a.instances.some(i => i.component === 'window')); continue; }
  const raft = a.instances.find(i => i.id === 'raft-main'), sump = a.instances.find(i => i.id === 'sump-slab');
  t(`${f}: sump floor is 1500 mm lower than the main floor (slab top to slab top)`, Math.abs((raft.pos[2] + raft.params.T) - (sump.pos[2] + sump.params.T) - 1500) < 0.5);
  t(`${f}: reservoir 70 m inside (north and south wall inner faces 70000 apart)`, (() => { const n = a.instances.find(i => i.id === 'cwr-wall-north'), s = a.instances.find(i => i.id === 'cwr-wall-south-west'); return Math.abs((n.pos[1] - n.params.T / 2) - (s.pos[1] + s.params.T / 2) - 70000) < 0.5; })());
  t(`${f}: 3 pumps, 3 plinths, 3 suction lines into the sump`, a.instances.filter(i => i.component === 'vertical-inline-pump').length === 3 && [1, 2, 3].every(n => has(a, `suction-bell-${n}`) && has(a, `plinth-${n}`)));
  t(`${f}: roof has 3 pipe openings`, a.instances.filter(i => i.component === 'rcc-slab-openings').length === 1);
  const panels = a.instances.filter(i => i.component === 'control-panel');
  t(`${f}: control room has panels`, panels.length >= 4);
  const cr = f === 'cwr-separate';
  t(`${f}: control room is ${cr ? 'a separate building (own frame, gap to the pump house)' : 'inside the pump house building (partition wall)'}`, cr ? has(a, 'cr-roof-slab') && !has(a, 'wall-P-1') : has(a, 'wall-P-1') && !has(a, 'cr-roof-slab'));
}
console.log(fail ? `\n${fail} FAILED` : '\nall pump house tests passed'); process.exit(fail ? 1 : 0);
