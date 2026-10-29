// Shared by the page builders: inlines ES-module engine files into one classic script (one geometry source for the Studio and the library pages).
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
export const ROOT = new URL('../', import.meta.url);
export const rd = p => readFileSync(new URL(p, ROOT), 'utf8').replace(/\r\n/g, '\n');
// modules: engine file names without .js in dependency order, e.g. ['math3', 'mesh', 'gen/genroom']; expose: JS object literal text built from MOD['..'], e.g. "{plan:MOD['gen/genroom'].plan}"
export function bundle(modules, expose, globalName) {
  let out = `window.${globalName}=(function(){const MOD={};\n`;
  for (const m of modules) {
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
  return out + `return ${expose};})();`;
}
