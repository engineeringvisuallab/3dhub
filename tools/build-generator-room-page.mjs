// Builds models/electrical/generator-room/parametric/generator-room.html from tools/generator-room-page.template.html
// by inlining the engine modules (so the page and the Studio use ONE geometry source: core/engine/gen/genroom.js and core/engine/visual/genroom.js).
// Run from the repo root:  node tools/build-generator-room-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
const ROOT = new URL('../', import.meta.url), rd = p => readFileSync(new URL(p, ROOT), 'utf8').replace(/\r\n/g, '\n');
const MODULES = ['math3', 'mesh', 'gen/genroom', 'visual/util', 'visual/genroom'];   // dependency order
let out = 'window.GR=(function(){const MOD={};\n';
for (const m of MODULES) {
  const dir = posix.dirname(m), names = [];
  let src = rd('core/engine/' + m + '.js');
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?$/gm, (_, list, spec) => `const {${list}} = MOD['${posix.normalize(posix.join(dir, spec)).replace(/\.js$/, '')}'];`);
  src = src.replace(/^export\s*\{([^}]*)\};?$/gm, (_, list) => { list.split(',').map(s => s.trim()).filter(Boolean).forEach(n => names.push(n)); return ''; });
  src = src.replace(/^export\s+(const|function|class)\s+([A-Za-z_$][\w$]*)([^\n]*)$/gm, (line, kind, name, rest) => {
    names.push(name);
    if (kind === 'const' && !/=>|function/.test(rest)) for (const x of rest.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=/g)) names.push(x[1]);   // export const A = 1, B = 2;
    return line.replace(/^export\s+/, '');
  });
  out += `MOD['${m}']=(()=>{\n${src}\nreturn {${[...new Set(names)].join(',')}};})();\n`;
}
out += `const G=MOD['gen/genroom'],V=MOD['visual/genroom'];return {plan:G.plan,describe:G.describe,SETS:G.SETS,RULE:G.RULE,genRoom:V.genRoom};})();`;
const html = rd('tools/generator-room-page.template.html').replace('/*ENGINE*/', () => out);
writeFileSync(new URL('models/electrical/generator-room/parametric/generator-room.html', ROOT), html);
console.log('written generator-room.html', Math.round(html.length / 1024), 'KB');
