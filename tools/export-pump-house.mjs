// Exports of the pump house design: BOM (CSV + XLSX), drawing sheet (SVG + DXF).
//   node tools/export-pump-house.mjs     -> exports/pump-house-cwr/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { flatten } from '../core/engine/assembly.js';
import { parse } from '../core/engine/io.js';
import { buildBOM, toCSV, toXLSX } from '../core/engine/bom.js';
import { assemblyBounds, buildSheet, sheetSVG } from '../core/engine/drawing.js';
const J = p => JSON.parse(readFileSync(new URL('../core/' + p, import.meta.url)));
const lib = {}; for (const id of J('library/components/manifest.json').components) lib[id] = J('library/components/' + id + '.json');
const engine = new Function(readFileSync(new URL('../docs/vdraw-engine.js', import.meta.url), 'utf8') + '\n;return { vdBuild, vdDXF };')();
const asm = parse(readFileSync(new URL('../core/examples/pump-house-cwr.assembly.json', import.meta.url), 'utf8'), lib);
const dir = new URL('../exports/pump-house-cwr/', import.meta.url); mkdirSync(dir, { recursive: true });
const bom = buildBOM(asm, lib);
writeFileSync(new URL('pump-house-cwr-bom.csv', dir), toCSV(bom));
writeFileSync(new URL('pump-house-cwr-bom.xlsx', dir), toXLSX(bom));
const { items } = flatten(asm, lib), b = assemblyBounds(items);
const sh = buildSheet(items, { name: asm.name, title: 'PUMP HOUSE ON CWR', cuts: [{ axis: 'x', pos: -1462.5 }, { axis: 'z', pos: 4700 }] }, engine);
writeFileSync(new URL('pump-house-cwr-drawing.svg', dir), sheetSVG(sh));
writeFileSync(new URL('pump-house-cwr-drawing.dxf', dir), engine.vdDXF(sh));
console.log('model size mm', [0, 1, 2].map(k => Math.round(b.max[k] - b.min[k])).join(' x '), '| BOM lines', bom.rows.length, '| totals', JSON.stringify(bom.totals), '| rebar', bom.rebar ? JSON.stringify(bom.rebar.totals ?? bom.rebar).slice(0, 200) : 'none');
