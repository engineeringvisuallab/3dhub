// Generators: some components (door ...) have too many design options for a fixed shape list.
// Their json names a generator ("generator": "door"); the generator turns the resolved parameters into shapes + ports.
// Everything else in the engine only sees plain shapes and ports, so snap, collision, save/load and export work unchanged.
import * as door from './gen/door.js';
import * as pipefit from './gen/pipefit.js';

const GEN = { door, bend: pipefit.bend, tee: pipefit.tee, reducer: pipefit.reducer };
const memo = new Map();

export function validateParams(comp, params) {
  if (!comp.generator) return;
  const g = GEN[comp.generator]; if (!g) throw new Error(`${comp.id}: unknown generator "${comp.generator}"`);
  g.validate(params);
}
// -> { shapes, ports, info[] } with every value already a number (no $expressions left)
export function materialize(comp, params) {
  if (!comp.generator) return { shapes: comp.shapes || [], ports: comp.ports || [], info: [] };
  const key = comp.id + '|' + JSON.stringify(params);
  let r = memo.get(key);
  if (!r) {
    const g = GEN[comp.generator]; if (!g) throw new Error(`${comp.id}: unknown generator "${comp.generator}"`);
    r = g.generate(params);
    if (memo.size > 300) memo.clear();
    memo.set(key, r);
  }
  return r;
}
