// Library check: node tools/check-library.mjs
// 1. every models/**/parametric/*.html page is listed in commerce/catalog/catalog.json and in the site fallback list
// 2. every page can show plan / elevations / sections and export (own code, or the shared kit models/_shared/evlab-kit.js)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const pages = walk(path.join(root, 'models')).filter(f => /[\\/]parametric[\\/][^\\/]+\.html$/.test(f)).map(f => path.relative(root, f).replace(/\\/g, '/'));
const cat = JSON.parse(fs.readFileSync(path.join(root, 'commerce/catalog/catalog.json'), 'utf8')).items;
const site = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');
const inCat = new Set(cat.map(i => i.path + '/' + i.page));
let bad = 0;
const row = (...a) => console.log(a.map((x, i) => String(x).padEnd([46, 9, 9, 22][i] || 10)).join(' '));
row('page', 'catalog', 'site', 'drawings / export'); 
for (const p of pages) {
  const h = fs.readFileSync(path.join(root, p), 'utf8');
  const id = p.split('/').pop().replace('.html', '');
  const okCat = cat.some(i => i.page.endsWith("/" + id + ".html") && p.startsWith(i.path + "/"));
  const okSite = site.includes('id:"' + id + '"');
  const kit = h.includes('_shared/evlab-kit.js');
  const own = /DXF/.test(h) && /Section/i.test(h) && (/Elevation/i.test(h) || /long section/i.test(h));
  const state = kit ? 'shared kit' : own ? 'own code' : 'MISSING';
  if (!okCat || !okSite || state === 'MISSING') bad++;
  row(p.replace(/^models\//, '').replace('/parametric', ''), okCat ? 'yes' : 'NO', okSite ? 'yes' : 'NO', state);
}
console.log(bad ? '\n' + bad + ' page(s) need attention' : '\nAll ' + pages.length + ' model pages are in the library and have drawings + export.');
process.exit(bad ? 1 : 0);
