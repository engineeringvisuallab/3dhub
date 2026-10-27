// Builds the model page  models/water-supply/pump-houses/cwr-pump-house/parametric/cwr-pump-house.html
//   node tools/build-cwr-page.mjs
// The page is ONE self-contained file (opens by double click, like every other model page): it embeds the engine (core/engine, bundled
// without any tool: ES modules are wrapped in a tiny module registry), the drawing engine (docs/vdraw-engine.js), the library
// components and the three designs of core/examples. Template: tools/cwr-page.template.html. Run this again after you change the
// designs (node tools/build-pump-house.mjs) or the engine.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const eng = path.join(root, 'core/engine');
const ENTRY = ['visual/index', 'io', 'assembly', 'bom', 'drawing', 'collision'];
const mods = new Map();   // key -> transformed source
function load(key) {
  if (mods.has(key)) return;
  mods.set(key, null);
  let src = readFileSync(path.join(eng, key + '.js'), 'utf8').replace(/\r\n/g, '\n');
  const exportsList = [];
  const req = rel => path.posix.normalize(path.posix.join(path.posix.dirname(key), rel)).replace(/\.js$/, '');
  src = src.replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+'([^']+)';?[ \t]*$/gm, (_, n, f) => { load(req(f)); return `const ${n} = __r(${JSON.stringify(req(f))});`; });
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s+'([^']+)';?[ \t]*$/gm, (_, names, f) => {
    load(req(f));
    return `const { ${names.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2')).join(', ')} } = __r(${JSON.stringify(req(f))});`;
  });
  src = src.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_, names) => { names.split(',').map(s => s.trim()).filter(Boolean).forEach(n => exportsList.push(n)); return ''; });
  src = src.replace(/^export\s+(?:async\s+)?(function|class)\s+(\w+)/gm, (_, k, n) => { exportsList.push(n); return `${k === 'class' ? 'class' : 'function'} ${n}`; });
  src = src.replace(/^export\s+(const|let)\s+(\w+)/gm, (_, k, n) => { exportsList.push(n); return `${k} ${n}`; });
  if (/^\s*(import|export)\s/m.test(src.replace(/^\s*\/\/.*$/gm, ''))) throw new Error('module ' + key + ' still has import/export syntax');
  mods.set(key, `__d[${JSON.stringify(key)}] = function (__e) {\n${src}\n${[...new Set(exportsList)].map(n => `__e.${n} = ${n};`).join('\n')}\n};`);
}
ENTRY.forEach(load);
const bundle = `const __d = {}, __c = {};\nfunction __r(k) { if (__c[k]) return __c[k]; const e = __c[k] = {}; __d[k](e); return e; }\n` + [...mods.values()].join('\n') + `
window.EVE = Object.assign({}, __r('visual/index'), __r('io'), __r('assembly'), __r('bom'), __r('drawing'), __r('collision'));`;
const J = p => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const lib = {}; for (const id of J('core/library/components/manifest.json').components) lib[id] = J(`core/library/components/${id}.json`);
const designs = {};
for (const [k, f] of [['combined', 'cwr-combined'], ['separate', 'cwr-separate'], ['control-room', 'control-room']]) designs[k] = J(`core/examples/${f}.assembly.json`);
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(path.join(root, 'tools/cwr-page.template.html'), 'utf8').replace(/\r\n/g, '\n');
const html = tpl
  .replace('/*@@BUNDLE@@*/', () => safe(bundle))
  .replace('/*@@VD@@*/', () => safe(readFileSync(path.join(root, 'docs/vdraw-engine.js'), 'utf8')))
  .replace('/*@@LIB@@*/', () => safe(JSON.stringify(lib)))
  .replace('/*@@ASM@@*/', () => safe(JSON.stringify(designs)));
const dir = path.join(root, 'models/water-supply/pump-houses/cwr-pump-house/parametric');
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'cwr-pump-house.html'), html);
console.log('written cwr-pump-house.html', Math.round(html.length / 1024) + ' KB,', mods.size, 'engine modules');
