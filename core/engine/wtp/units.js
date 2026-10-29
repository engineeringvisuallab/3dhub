// Unit conversion for the water treatment library. Pure JS, no I/O.
// Factors are exact definitions (ft, in, acre, US gallon, lb, psi) to SI base units, so US-customary references
// (for example the Utah Parshall flume report in ft and cfs) and SI references (Arkon, TU Delft) can be used together.
export const DIMENSIONS = {
  length: { m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254 },
  area: { m2: 1, acre: 4046.8564224, ha: 10000 },
  volume: { m3: 1, L: 0.001, gal_us: 0.003785411784, ft3: 0.028316846592 },
  flow: { 'm3/s': 1, 'L/s': 0.001, 'm3/d': 1 / 86400, MLD: 1000 / 86400, cfs: 0.028316846592, gpm_us: 0.003785411784 / 60, mgd_us: 3785.411784 / 86400 },
  mass: { kg: 1, g: 0.001, lb: 0.45359237 },
  pressure: { Pa: 1, kPa: 1000, bar: 100000, psi: 6894.757293168, m_head: 9806.65 },
};
export function dimensionOf(unit) { for (const d in DIMENSIONS) if (unit in DIMENSIONS[d]) return d; return null; }
export function convert(value, from, to) {
  if (from === to) return value;
  const df = dimensionOf(from), dt = dimensionOf(to);
  if (!df) throw new Error('unknown unit: ' + from);
  if (!dt) throw new Error('unknown unit: ' + to);
  if (df !== dt) throw new Error(`cannot convert ${df} (${from}) to ${dt} (${to})`);
  return value * DIMENSIONS[df][from] / DIMENSIONS[df][to];
}
export const degFtoC = f => (f - 32) * 5 / 9;
export const degCtoF = c => c * 9 / 5 + 32;
