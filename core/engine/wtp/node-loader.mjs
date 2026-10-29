// Node-only loader: reads core/library/wtp/** into the plain object that registry.js expects.
import { readFileSync, readdirSync } from 'node:fs';
export function loadWtp(libDir = new URL('../../library/wtp/', import.meta.url)) {
  const J = p => JSON.parse(readFileSync(new URL(p, libDir), 'utf8'));
  const idx = J('stages/index.json');
  const stages = idx.stages.map(id => J(`stages/${id}.json`));
  const calcs = {}, rules = [];
  for (const id of idx.stages) { calcs[id] = J(`calcs/${id}.json`).calculations; rules.push(...J(`rules/${id}.json`).rules); }
  const assessments = J('assessments/index.json').assessments.map(id => J(`assessments/${id}.json`));
  const pIndex = J('profiles/index.json'), files = {};
  for (const p of pIndex.profiles) if (p.file) files[p.file] = J('profiles/' + p.file);
  return { stages, refs: J('references.json').references, rules, calcs, assessments, profiles: { index: pIndex, files }, statusLevels: idx.statusLevels };
}
