// Parshall flume solids for the 3D page. Pure JS, no imports. Units mm; x = flow direction, y = up, z = across; crest at x = 0, y = 0.
// A solid is a prism: four top points (x,y,z) in a ring and one flat bottom level yb. toMesh() gives vertices and triangle indices
// with outward winding (checked by signed volume).
export function pfSolid(group, name, color, top, yb, opts = {}) { return { group, name, color, top, yb, ...opts }; }

export function pfMesh(s) {
  // ring order must be counter-clockwise seen from +y; decide from the signed area in the x-z plane
  let a = 0; const T = s.top;
  for (let i = 0; i < 4; i++) { const p = T[i], q = T[(i + 1) % 4]; a += p[0] * q[2] - q[0] * p[2]; }
  const ring = a > 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
  const t = ring.map(i => T[i]), b = t.map(p => [p[0], s.yb, p[2]]);
  const v = [...t, ...b], idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; idx.push(4 + i, 4 + j, j, 4 + i, j, i); }
  let vol = 0; for (let i = 0; i < idx.length; i += 3) { const p = v[idx[i]], q = v[idx[i + 1]], r = v[idx[i + 2]]; vol += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6; }
  if (vol < 0) { for (let i = 0; i < idx.length; i += 3) { const k = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = k; } vol = -vol; }
  return { v, idx, volume: vol };
}

// d = dimensions in mm {W,A,B,D,E,F,G,H,K,X,Y}. o = { channelW, approachLen, tailLen, wall, slab, Ha, Hd, withWater }
export function pfBuild(d, o) {
  const S = [], hw = x => x <= -d.D ? d.A / 2 : x <= 0 ? d.A / 2 + (d.W / 2 - d.A / 2) * (x + d.D) / d.D : x <= d.E ? d.W / 2 : d.W / 2 + (d.B / 2 - d.W / 2) * (x - d.E) / d.F;
  const flo = x => x <= 0 ? 0 : x <= d.E ? -d.H * x / d.E : -d.H + (d.H - d.K) * (x - d.E) / d.F;
  const t = o.wall, yf = -(d.H + o.slab), yc = -o.slab;
  const quad = (x0, y0, h0, x1, y1, h1) => [[x0, y0, -h0], [x0, y0, h0], [x1, y1, h1], [x1, y1, -h1]];
  const wall = (g, nm, x0, h0, x1, h1, yb, col) => { for (const sg of [-1, 1]) S.push(pfSolid(g, nm + (sg < 0 ? ' left' : ' right'), col, [[x0, d.G, sg * h0], [x0, d.G, sg * (h0 + t)], [x1, d.G, sg * (h1 + t)], [x1, d.G, sg * h1]], yb)); };
  const conc = 0xb4b4b0, concD = 0xa4a49f, water = 0x3a8fd8;
  // flume body
  S.push(pfSolid('Flume', 'Converging floor', conc, quad(-d.D, 0, d.A / 2, 0, 0, d.W / 2), yf));
  S.push(pfSolid('Flume', 'Throat floor', conc, quad(0, 0, d.W / 2, d.E, -d.H, d.W / 2), yf));
  S.push(pfSolid('Flume', 'Diverging floor', conc, quad(d.E, -d.H, d.W / 2, d.E + d.F, -d.K, d.B / 2), yf));
  wall('Flume', 'Converging wall', -d.D, d.A / 2, 0, d.W / 2, yf, concD);
  wall('Flume', 'Throat wall', 0, d.W / 2, d.E, d.W / 2, yf, concD);
  wall('Flume', 'Diverging wall', d.E, d.W / 2, d.E + d.F, d.B / 2, yf, concD);
  // approach channel: straight length, then a narrowing transition (30 degrees to the axis, inside the 45 degree limit of the Arkon guide)
  const Wc = Math.max(o.channelW, d.A), Lt = (Wc - d.A) / 2 / Math.tan(30 * Math.PI / 180), xT = -d.D - Lt, xA = xT - o.approachLen;
  S.push(pfSolid('Approach channel', 'Approach floor', conc, quad(xA, 0, Wc / 2, xT, 0, Wc / 2), yc));
  wall('Approach channel', 'Approach wall', xA, Wc / 2, xT, Wc / 2, yc, concD);
  if (Lt > 1) { S.push(pfSolid('Approach channel', 'Transition floor', conc, quad(xT, 0, Wc / 2, -d.D, 0, d.A / 2), yc)); wall('Approach channel', 'Transition wall', xT, Wc / 2, -d.D, d.A / 2, yc, concD); }
  // tail channel
  const xE = d.E + d.F, xL = xE + o.tailLen;
  S.push(pfSolid('Tail channel', 'Tail floor', conc, quad(xE, -d.K, d.B / 2, xL, -d.K, d.B / 2), -d.K - o.slab));
  wall('Tail channel', 'Tail wall', xE, d.B / 2, xL, d.B / 2, -d.K - o.slab, concD);
  // water (schematic: levels are Ha upstream and Hd downstream, the surface in between is drawn as a straight line)
  if (o.withWater) {
    const Ha = o.Ha, Hd = Math.min(o.Hd, Ha);
    S.push(pfSolid('Water (schematic)', 'Water approach', water, quad(xA, Ha, Wc / 2 - 1, xT, Ha, Wc / 2 - 1), 0, { transparent: true }));
    if (Lt > 1) S.push(pfSolid('Water (schematic)', 'Water transition', water, quad(xT, Ha, Wc / 2 - 1, -d.D, Ha, d.A / 2 - 1), 0, { transparent: true }));
    S.push(pfSolid('Water (schematic)', 'Water converging', water, quad(-d.D, Ha, d.A / 2 - 1, 0, Ha, d.W / 2 - 1), 0, { transparent: true }));
    S.push(pfSolid('Water (schematic)', 'Water throat', water, quad(0, Ha, d.W / 2 - 1, d.E, Hd, d.W / 2 - 1), -d.H, { transparent: true }));
    S.push(pfSolid('Water (schematic)', 'Water diverging', water, quad(d.E, Hd, d.W / 2 - 1, xE, Hd, d.B / 2 - 1), -d.H, { transparent: true }));
    S.push(pfSolid('Water (schematic)', 'Water tail', water, quad(xE, Hd, d.B / 2 - 1, xL, Hd, d.B / 2 - 1), -d.K, { transparent: true }));
  }
  // gauges: staff gauge for Ha at two thirds of the converging section, stilling well for Hb with a connecting pipe at (X, Y) from Table 1
  const xa = -2 * d.D / 3, ya = Math.max(o.Ha * 1.2, 150);
  S.push(pfSolid('Gauges', 'Ha staff gauge', 0xd33a3a, [[xa - 15, ya, -hw(xa) + 2], [xa - 15, ya, -hw(xa) + 22], [xa + 15, ya, -hw(xa) + 22], [xa + 15, ya, -hw(xa) + 2]], 0));
  const xb = d.E - d.X, yb2 = -d.H + d.Y, zw = d.W / 2 + t + 100;
  S.push(pfSolid('Gauges', 'Hb stilling well', 0x7a8088, [[xb - 100, d.G + 150, zw - 100], [xb - 100, d.G + 150, zw + 100], [xb + 100, d.G + 150, zw + 100], [xb + 100, d.G + 150, zw - 100]], yb2 - 150));
  S.push(pfSolid('Gauges', 'Hb connecting pipe', 0x7a8088, [[xb - 15, yb2 + 15, d.W / 2 - 5], [xb - 15, yb2 + 15, zw - 100], [xb + 15, yb2 + 15, zw - 100], [xb + 15, yb2 + 15, d.W / 2 - 5]], yb2 - 15));
  const bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const s of S) { for (const p of s.top) { bb.x0 = Math.min(bb.x0, p[0]); bb.x1 = Math.max(bb.x1, p[0]); bb.z0 = Math.min(bb.z0, p[2]); bb.z1 = Math.max(bb.z1, p[2]); bb.y1 = Math.max(bb.y1, p[1]); bb.y0 = Math.min(bb.y0, p[1]); } bb.y0 = Math.min(bb.y0, s.yb); }
  return { solids: S, bbox: bb, approach: { channelW: Wc, transitionLen: Lt, startX: xA }, gauges: { Ha_x: xa, Hb_x: xb, Hb_y: yb2 } };
}
