// Exports of the CWR / pump house designs: BOM (CSV + XLSX) and drawing sheet (SVG + DXF) for every layout.
//   node tools/export-pump-house.mjs     -> exports/pump-house-cwr/
// (run node tools/build-pump-house.mjs first)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { flatten } from '../core/engine/assembly.js';
import { parse } from '../core/engine/io.js';
import { buildBOM, toCSV, toXLSX } from '../core/engine/bom.js';
import { assemblyBounds, buildSheet, sheetSVG } from '../core/engine/drawing.js';
const J = p => JSON.parse(readFileSync(new URL('../core/' + p, import.meta.url)));
const lib = {}; for (const id of J('library/components/manifest.json').components) lib[id] = J('library/components/' + id + '.json');
const engine = new Function(readFileSync(new URL('../docs/vdraw-engine.js', import.meta.url), 'utf8') + '\n;return { vdBuild, vdDXF };')();
const dir = new URL('../exports/pump-house-cwr/', import.meta.url); mkdirSync(dir, { recursive: true });
const sheets = {
  combined: { file: 'cwr-combined', title: 'CWR 70x70 + PUMP HOUSE + CONTROL ROOM', cuts: [{ axis: 'x', pos: -1750 }, { axis: 'z', pos: 8800 }] },
  separate: { file: 'cwr-separate', title: 'CWR 70x70 + PUMP HOUSE, SEPARATE CONTROL ROOM', cuts: [{ axis: 'x', pos: -1750 }, { axis: 'z', pos: 8800 }] },
  'control-room': { file: 'control-room', title: 'ELECTRICAL CONTROL ROOM', cuts: [{ axis: 'x', pos: 3500 }, { axis: 'z', pos: 1200 }] }
};
for (const [layout, s] of Object.entries(sheets)) {
  const asm = parse(readFileSync(new URL(`../core/examples/${s.file}.assembly.json`, import.meta.url), 'utf8'), lib);
  const bom = buildBOM(asm, lib), { items } = flatten(asm, lib), b = assemblyBounds(items);
  writeFileSync(new URL(`${s.file}-bom.csv`, dir), toCSV(bom));
  writeFileSync(new URL(`${s.file}-bom.xlsx`, dir), toXLSX(bom));
  const sh = buildSheet(items, { name: asm.name, title: s.title, cuts: s.cuts }, engine);
  writeFileSync(new URL(`${s.file}-drawing.svg`, dir), sheetSVG(sh));
  writeFileSync(new URL(`${s.file}-drawing.dxf`, dir), engine.vdDXF(sh));
  console.log(layout, '| size mm', [0, 1, 2].map(k => Math.round(b.max[k] - b.min[k])).join(' x '), '| parts', bom.totals.parts, '| pipe m', bom.totals.pipeLength_m, '| rebar kg', (bom.rebar?.totals ?? bom.rebar)?.kg);
}
