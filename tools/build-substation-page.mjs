// Builds models/electrical/substation/parametric/substation.html from tools/substation-page.template.html
// by inlining the engine modules (ONE geometry source: core/engine/gen/substation.js and core/engine/visual/substation.js).
// Run from the repo root:  node tools/build-substation-page.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { ROOT, rd, bundle } from './_bundle.mjs';
const G = "MOD['gen/substation']";
const engine = bundle(['math3', 'mesh', 'gen/genroom', 'gen/substation', 'visual/util', 'visual/substation'],
  `{plan:${G}.plan,describe:${G}.describe,TYPES:${G}.TYPES,ALLOWED:${G}.ALLOWED,substation:MOD['visual/substation'].substation}`, 'SUB');
const html = rd('tools/substation-page.template.html').replace('/*ENGINE*/', () => engine);
mkdirSync(new URL('models/electrical/substation/parametric/', ROOT), { recursive: true });
writeFileSync(new URL('models/electrical/substation/parametric/substation.html', ROOT), html);
console.log('written substation.html', Math.round(html.length / 1024), 'KB');
