// The model page models/water-supply/pump-houses/cwr-pump-house is ONE file with the engine bundled in.
// This test runs the bundle from the page and checks that it is not stale: same designs as core/examples, same result as the engine.
import { readFileSync } from 'node:fs';
import { visualItems } from '../engine/visual/index.js';
import { buildBOM } from '../engine/bom.js';
import { parse } from '../engine/io.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const lib = {}; for (const id of J('library/components/manifest.json').components) lib[id] = J('library/components/' + id + '.json');
const html = readFileSync(new URL('../../models/water-supply/pump-houses/cwr-pump-house/parametric/cwr-pump-house.html', import.meta.url), 'utf8');
const first = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])[0];
globalThis.window = globalThis;
const P = new Function(first + '\nreturn { LIB, DESIGNS, VD, EVE: window.EVE };')();
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
for (const [k, f] of [['combined', 'cwr-combined'], ['separate', 'cwr-separate'], ['control-room', 'control-room']]) {
  const ex = J('examples/' + f + '.assembly.json');
  ok(JSON.stringify(P.DESIGNS[k]) === JSON.stringify(ex), `page ${k}: embedded design equals core/examples/${f}.assembly.json (run node tools/build-cwr-page.mjs if not)`);
  const a = parse(JSON.stringify(ex), lib), b = P.EVE.parse(JSON.stringify(ex), P.LIB);
  const tris = (v, l, as) => v(as, l).reduce((s, i) => s + i.part.idx.length / 3, 0);
  ok(tris(visualItems, lib, a) === tris(P.EVE.visualItems, P.LIB, b), `page ${k}: bundled engine gives the same triangles as core/engine`);
  ok(buildBOM(a, lib).totals.parts === P.EVE.buildBOM(b, P.LIB).totals.parts, `page ${k}: same BOM part count`);
}
ok(Object.keys(P.LIB).length === J('library/components/manifest.json').components.length, 'page: all library components embedded');
if (bad) process.exit(1);
console.log('all cwr page tests passed');
