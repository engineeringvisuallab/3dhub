// Drawing sheet (plan, 4 elevations, up to 2 sections) generated from the assembly's world-space items.
// The line work (hidden-line removal, section cut, hatch, DXF) comes from docs/vdraw-engine.js; this file only
//  1. turns the assembly into the meshes that engine wants (millimetres, Y up - same convention as the GLB export),
//  2. maps the user's cut planes (Studio axes, Z up) to the engine's cuts,
//  3. writes an SVG of the finished sheet.
import { worldMeshes } from './export.js';

// engine frame (x, y = up, z) <-> Studio frame (x, y, z = up):  Studio (x, y, z) = engine (x, -z, y)
export function drawingMeshes(items) {
  return worldMeshes(items).map(m => {
    const P = new Float64Array(m.pos.length * 3);
    m.pos.forEach((v, i) => { P[3 * i] = v[0] * 1000; P[3 * i + 1] = v[1] * 1000; P[3 * i + 2] = v[2] * 1000; });
    return { P, T: m.idx, glass: false };
  });
}
// overall size of the assembly in Studio axes (mm)
export function assemblyBounds(items) {
  const min = [1e18, 1e18, 1e18], max = [-1e18, -1e18, -1e18];
  for (const m of drawingMeshes(items)) for (let i = 0; i < m.P.length; i += 3) {
    const s = [m.P[i], -m.P[i + 2], m.P[i + 1]];
    for (let k = 0; k < 3; k++) { if (s[k] < min[k]) min[k] = s[k]; if (s[k] > max[k]) max[k] = s[k]; }
  }
  return { min, max };
}
// one cut plane, given in Studio axes (axis x | y | z, position in mm), as the engine's cut (point in metres, engine frame)
export function cutToEngine(axis, pos, n) {
  const m = pos / 1000, at = { x: 'X', y: 'Y', z: 'Z' }[axis], p = Math.round(pos);
  if (axis === 'x') return { n, label: `SECTION ${n}-${n} (plane across X at ${p} mm)`, d: [1, 0, 0], up: [0, 1, 0], p: [m, 0, 0] };
  if (axis === 'y') return { n, label: `SECTION ${n}-${n} (plane across Y at ${p} mm)`, d: [0, 0, 1], up: [0, 1, 0], p: [0, 0, -m] };
  if (axis === 'z') return { n, label: `SECTION ${n}-${n} (horizontal at Z ${p} mm)`, d: [0, 1, 0], up: [0, 0, -1], p: [0, m, 0] };
  throw new Error('cut axis must be x, y or z (got ' + axis + ')');
}
// opts: { title, name, cuts: [{axis, pos}] (max 2), parts: { componentId: count } }.  engine: { vdBuild } from docs/vdraw-engine.js
export function buildSheet(items, opts, engine) {
  if (!engine || typeof engine.vdBuild !== 'function') throw new Error('The drawing engine (docs/vdraw-engine.js) is not loaded.');
  const cuts = opts.cuts || [];
  if (cuts.length > 2) throw new Error('A sheet holds at most 2 sections.');
  const meshes = drawingMeshes(items);
  if (!meshes.length) throw new Error('Nothing to draw: the assembly has no solid parts.');
  const b = assemblyBounds(items);
  const cfg = {
    title: opts.title || 'ASSEMBLY', name: opts.name || 'Untitled',
    spec: { design: opts.name || 'Untitled', size_mm: [0, 1, 2].map(k => Math.round(b.max[k] - b.min[k])), parts: opts.parts || {} },
    ground: { y: 0, label: 'Z = 0' },
    cuts: cuts.map((c, i) => cutToEngine(c.axis, c.pos, 'AB'[i]))
  };
  return engine.vdBuild(meshes, cfg);
}

// ---- SVG of a finished sheet (same layers and line styles as the engine's PNG / DXF) ----
const STYLE = { 'A-VIS': ['#000', 1.6, null], 'A-CUT': ['#c00', 3.2, null], 'A-HATCH': ['#0a7', 0.9, null], 'A-DIM': ['#00a', 1, null],
  'A-TEXT': ['#000', 1, null], 'A-SECT': ['#c00', 1.8, [30, 8, 4, 8]], 'A-GROUND': ['#555', 2, [16, 6]], 'A-FRAME': ['#999', 1, null] };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function sheetSVG(sh) {
  const k = sh.N / 6, f = v => (+v).toFixed(2), Y = v => sh.H - v; // 1 px of the 2520 x 1782 px canvas = N/6 sheet units
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 ${f(sh.W)} ${f(sh.H)}">`, `<rect width="100%" height="100%" fill="#fff"/>`];
  const layers = {};
  for (const it of sh.items) if (it.t === 'L') (layers[it.l] ||= []).push(`M${f(it.x1)} ${f(Y(it.y1))}L${f(it.x2)} ${f(Y(it.y2))}`);
  for (const [l, d] of Object.entries(layers)) {
    const [c, w, dash] = STYLE[l] || STYLE['A-VIS'];
    out.push(`<path d="${d.join('')}" fill="none" stroke="${c}" stroke-width="${f(w * k)}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash.map(v => f(v * k)).join(' ')}"` : ''}/>`);
  }
  for (const it of sh.items) if (it.t === 'T') {
    const c = (STYLE[it.l] || STYLE['A-TEXT'])[0];
    out.push(`<text transform="translate(${f(it.x)} ${f(Y(it.y))})${it.rot ? ` rotate(${-it.rot})` : ''}" font-family="Arial, sans-serif" font-size="${f(it.h)}" fill="${c}">${esc(it.s)}</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
