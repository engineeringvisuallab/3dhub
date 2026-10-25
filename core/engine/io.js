// Save / load of an assembly (core/schema/assembly.schema.json). Pure functions: no DOM, runs in Node and in the browser.
import { resolveParams } from './assembly.js';

const isVec3 = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

export function serialize(asm) {
  const out = { name: asm.name || 'Untitled', units: 'mm', instances: asm.instances, links: asm.links || [] };
  if (asm.rebarSets?.length) out.rebarSets = asm.rebarSets;
  if (asm.bars?.length) out.bars = asm.bars;
  return JSON.stringify(out, null, 2);
}

// Returns a clean assembly or throws Error with an English message that tells the user what is wrong.
export function parse(text, library) {
  let o;
  try { o = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!o || typeof o !== 'object' || !Array.isArray(o.instances)) throw new Error('This file is not an EVLab assembly (no "instances" list).');
  if (o.units !== 'mm') throw new Error('Unsupported units "' + o.units + '". Assemblies must use mm.');
  const ids = new Set();
  for (const i of o.instances) {
    if (!i || typeof i.id !== 'string' || !i.id) throw new Error('An object has no id.');
    if (ids.has(i.id)) throw new Error('Duplicate object id: ' + i.id);
    ids.add(i.id);
    if (!library[i.component]) throw new Error(`Object ${i.id} uses an unknown model "${i.component}".`);
    if (!isVec3(i.pos)) throw new Error(`Object ${i.id} has an invalid position.`);
    if (i.rot !== undefined && !isVec3(i.rot)) throw new Error(`Object ${i.id} has an invalid rotation.`);
    try { resolveParams(library[i.component], i.params || {}); } catch (e) { throw new Error(`Object ${i.id}: ${e.message}`); }
  }
  const links = o.links || [];
  for (const l of links) for (const end of [l.a, l.b]) {
    if (typeof end !== 'string' || !ids.has(end.split('.')[0])) throw new Error('A link points to a missing object: ' + end);
  }
  return {
    name: typeof o.name === 'string' ? o.name : 'Untitled', units: 'mm',
    instances: o.instances.map(i => ({ id: i.id, component: i.component, params: i.params || {}, pos: i.pos, rot: i.rot || [0, 0, 0] })),
    links, ...(o.rebarSets ? { rebarSets: o.rebarSets } : {}), ...(o.bars ? { bars: o.bars } : {})
  };
}
