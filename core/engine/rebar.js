// Rebar is NOT modelled inside each component. A component only says "I am a host" and
// a rebar SET (template + params) is generated from the shared rebar library.
// Output = list of bar elements { id, kind, dia, grade, path:[[x,y,z]...] } in HOST-LOCAL mm
// (host origin = centre of host box). Path is the bar centreline.
export function columnCage(p) {
  // p: b,h (section, X and Y), H (height, Z), cover, mainDia, nx, ny (bars per face incl. corners),
  //    tieDia, tieSpacing, grade
  const { b, h, H, cover = 40, mainDia = 16, nx = 2, ny = 2, tieDia = 8, tieSpacing = 150, grade = 'tmt500' } = p;
  const bars = [];
  const off = cover + tieDia + mainDia / 2;           // main bar centre from face
  const x0 = -b/2 + off, x1 = b/2 - off, y0 = -h/2 + off, y1 = h/2 - off;
  const z0 = -H/2 + cover, z1 = H/2 - cover;
  const pts = [];
  for (let i = 0; i < nx; i++) pts.push([x0 + (x1-x0)*i/(nx-1), y0], [x0 + (x1-x0)*i/(nx-1), y1]);
  for (let j = 1; j < ny - 1; j++) pts.push([x0, y0 + (y1-y0)*j/(ny-1)], [x1, y0 + (y1-y0)*j/(ny-1)]);
  pts.forEach(([x, y], k) => bars.push({ id: 'main-' + (k+1), kind: 'straight', dia: mainDia, grade, path: [[x, y, z0], [x, y, z1]] }));
  const sx0 = -b/2 + cover + tieDia/2, sx1 = b/2 - cover - tieDia/2;
  const sy0 = -h/2 + cover + tieDia/2, sy1 = h/2 - cover - tieDia/2;
  let n = 0;
  for (let z = z0 + tieSpacing/2; z <= z1 - tieDia; z += tieSpacing) {
    n++;
    bars.push({ id: 'stirrup-' + n, kind: 'stirrup', dia: tieDia, grade,
      path: [[sx0, sy0, z], [sx1, sy0, z], [sx1, sy1, z], [sx0, sy1, z], [sx0, sy0, z]] });
  }
  return bars;
}
export function beamCage(p) { // along X: L, b (Y), h (Z)
  const { L, b, h, cover = 30, topDia = 12, botDia = 16, nBot = 3, nTop = 2, tieDia = 8, tieSpacing = 150, grade = 'tmt500' } = p;
  const bars = [], zb = -h/2 + cover + tieDia + botDia/2, zt = h/2 - cover - tieDia - topDia/2;
  const row = (n, z, dia, tag) => { for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : -b/2 + cover + tieDia + dia/2 + (b - 2*(cover + tieDia + dia/2)) * i/(n-1);
    bars.push({ id: tag + '-' + (i+1), kind: 'straight', dia, grade, path: [[-L/2 + cover, y, z], [L/2 - cover, y, z]] }); } };
  row(nBot, zb, botDia, 'bot'); row(nTop, zt, topDia, 'top');
  const sy0 = -b/2 + cover + tieDia/2, sy1 = b/2 - cover - tieDia/2, sz0 = -h/2 + cover + tieDia/2, sz1 = h/2 - cover - tieDia/2;
  let n = 0;
  for (let x = -L/2 + cover + tieSpacing/2; x <= L/2 - cover; x += tieSpacing) { n++;
    bars.push({ id: 'stirrup-' + n, kind: 'stirrup', dia: tieDia, grade,
      path: [[x, sy0, sz0], [x, sy1, sz0], [x, sy1, sz1], [x, sy0, sz1], [x, sy0, sz0]] }); }
  return bars;
}
export const TEMPLATES = { 'column-cage': columnCage, 'beam-cage': beamCage };
// Bar weight (kg/m) = d^2/162.2 (d in mm). Used for bar-bending schedule / quantity export.
export const barWeightPerM = d => (d * d) / 162.2;
export function barLength(path) { let s = 0; for (let i = 1; i < path.length; i++) s += Math.hypot(...path[i].map((v, k) => v - path[i-1][k])); return s; }
export function schedule(bars) {
  const m = new Map();
  for (const b of bars) { const key = b.kind + '|' + b.dia + '|' + b.grade; const L = barLength(b.path);
    const e = m.get(key) || { kind: b.kind, dia: b.dia, grade: b.grade, count: 0, totalLen_mm: 0, kg: 0 };
    e.count++; e.totalLen_mm += L; e.kg += barWeightPerM(b.dia) * L / 1000; m.set(key, e); }
  return [...m.values()];
}
