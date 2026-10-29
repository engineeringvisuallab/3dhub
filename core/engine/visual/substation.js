// Visual mesh of the substation: what the user SEES and exports. Collision / BOM use the envelopes of gen/substation.js.
// Every equipment item of the plan (kind) has its own real-shape builder: transformers with fins, radiators, conservator and bushings,
// disconnectors, circuit breakers, CTs, CVTs, arresters on stands, lattice gantries and masts, bus tubes on posts, RMU, VCB / LT / relay panel rows,
// battery bank, GIS bays with bus tank, breaker and wall bushings, crane, fence with gate, oil pits, fire walls, trenches, lights, pole, cross arm, fuses.
import { Geo, box, cyl, lathe, tube, hollow } from '../mesh.js';
import { fromEuler, add, sub, scale, norm, len, dot } from '../math3.js';
import { plan, shell, openings, RULE } from '../gen/substation.js';
import { cylAt, hollowAt, along, part } from './util.js';

const mv = (x, y, z) => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [x, y, z] });
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], on = v => +v === 1;
const bxe = (g, x0, x1, y0, y1, z0, z1) => g.merge(box(x1 - x0, y1 - y0, z1 - z0), mv((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
const bxr = (g, size, at, rot) => g.merge(box(size[0], size[1], size[2]), fromEuler(at, rot));
const put = (g, l, x, y, z) => g.merge(l, mv(x, y, z));
const COL = { steel: 0x8a929a, galv: 0xa9b0b6, porc: 0x8b5a3c, porcG: 0xc4c4bd, alu: 0xc9ced3, dark: 0x2c3238, rubber: 0x16181a, copper: 0xb87333, txpaint: 0x7d8a86, red: 0xc0392b, yellow: 0xe0b020, conc: 0x9aa0a6, concD: 0x80868c, glass: 0xaed6e6, white: 0xe8e8e4, blue: 0x2f5fa8, panel: 0x8c9399, panelD: 0x4d5760, gravel: 0xaaa89f, road: 0x55575a, lamp: 0xf4f2d8, green: 0x2fa36b, gis: 0x9aa5a0, mesh: 0x39424a, oil: 0x6d6f4a };

// ---- small shared shapes ----
const memo = new Map();
function insul(h, r, n = 8, seg = 14) {          // porcelain column with sheds
  const key = [h, r, n, seg].join('|'); if (memo.has(key)) return memo.get(key);
  const pr = [[0, 0], [r * 0.85, 0]]; const dz = h / n;
  for (let i = 0; i < n; i++) { const z = i * dz; pr.push([r * 0.85, z + dz * 0.08], [r * 1.6, z + dz * 0.3], [r * 1.6, z + dz * 0.42], [r * 0.85, z + dz * 0.7]); }
  pr.push([r * 0.85, h], [0, h]); const g = lathe(pr, { seg }); memo.set(key, g); return g;
}
function rounded(pts, R, steps = 6) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], u = norm(sub(a, b)), v = norm(sub(c, b)), ang = Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
    if (ang > Math.PI - 1e-3 || ang < 1e-3) { out.push(b); continue; }
    const dd = Math.min(R / Math.tan(ang / 2), len(sub(a, b)) / 2, len(sub(c, b)) / 2), Rr = dd * Math.tan(ang / 2);
    const p1 = add(b, scale(u, dd)), p2 = add(b, scale(v, dd)), Cn = add(b, scale(norm(add(u, v)), Rr / Math.sin(ang / 2)));
    const r1 = sub(p1, Cn), r2 = sub(p2, Cn), phi = Math.acos(Math.max(-1, Math.min(1, dot(norm(r1), norm(r2)))));
    for (let k = 0; k <= steps; k++) { const s = k / steps, w1 = Math.sin((1 - s) * phi) / Math.sin(phi), w2 = Math.sin(s * phi) / Math.sin(phi); out.push(add(Cn, add(scale(r1, w1), scale(r2, w2)))); }
  }
  out.push(pts[pts.length - 1]); return out;
}
const wire = (g, pts, r, R = 500, seg = 8) => { const q = rounded(pts.map(p => p.slice()), R); if (q.length > 1) g.merge(tube(q, r, { seg })); };
function lattice(h, w, w2 = w) {                  // lattice column: 4 legs, rings and diagonals (tapers from w to w2)
  const g = new Geo(), n = Math.max(2, Math.ceil(h / 1800)), dz = h / n, W = z => w + (w2 - w) * z / h;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const pts = [[sx * w / 2, sy * w / 2, 0], [sx * w2 / 2, sy * w2 / 2, h]]; g.merge(tube(pts, 55, { seg: 6 }));
  }
  for (let i = 0; i <= n; i++) { const z = i * dz, ww = W(z); bxe(g, -ww / 2, ww / 2, -ww / 2 - 20, -ww / 2 + 20, z - 25, z + 25); bxe(g, -ww / 2, ww / 2, ww / 2 - 20, ww / 2 + 20, z - 25, z + 25); bxe(g, -ww / 2 - 20, -ww / 2 + 20, -ww / 2, ww / 2, z - 25, z + 25); bxe(g, ww / 2 - 20, ww / 2 + 20, -ww / 2, ww / 2, z - 25, z + 25); }
  for (let i = 0; i < n; i++) {
    const z0 = i * dz, ww = W(z0 + dz / 2), a = Math.atan2(dz, ww) * 180 / Math.PI, L = Math.hypot(ww, dz), sg = i % 2 ? 1 : -1;
    for (const s of [-1, 1]) { bxr(g, [L, 36, 36], [0, s * ww / 2, z0 + dz / 2], [0, -sg * a, 0]); bxr(g, [36, L, 36], [s * ww / 2, 0, z0 + dz / 2], [sg * a, 0, 0]); }
  }
  return g;
}
function girder(span, depth) {                  // lattice beam along Y, centred, top at z = 0 .. depth below
  const g = new Geo(), n = Math.max(2, Math.round(span / 1500)), dy = span / n, a = Math.atan2(depth, dy) * 180 / Math.PI, L = Math.hypot(dy, depth);
  bxe(g, -150, 150, -span / 2, span / 2, -60, 0); bxe(g, -150, 150, -span / 2, span / 2, -depth, -depth + 60);
  for (const sx of [-1, 1]) for (let i = 0; i < n; i++) bxr(g, [30, L, 30], [sx * 150, -span / 2 + dy * (i + 0.5), -depth / 2], [(i % 2 ? 1 : -1) * a, 0, 0]);
  return g;
}
function ped(g, y, h, wx, wy = 300) {            // equipment pedestal on four legs
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) bxe(g, sx * wx / 2 - 60, sx * wx / 2 + 60, y + sy * wy / 2 - 60, y + sy * wy / 2 + 60, 0, h);
  bxe(g, -wx / 2 - 80, wx / 2 + 80, y - wy / 2 - 80, y + wy / 2 + 80, h - 80, h);
  bxe(g, -wx / 2, wx / 2, y - wy / 2 - 20, y - wy / 2 + 20, h * 0.4, h * 0.4 + 50); bxe(g, -wx / 2, wx / 2, y + wy / 2 - 20, y + wy / 2 + 20, h * 0.4, h * 0.4 + 50);
}
const D = () => { const d = {}; d.g = (k) => d[k] || (d[k] = new Geo()); return d; };

// ---- yard equipment (three phases along Y) ----
function eqIso(it) { const o = it.opts, sx = it.size[0], d = D(), k33 = o.kv === 33, ri = k33 ? 60 : 100;
  for (const k of [-1, 0, 1]) { const y = k * o.pitch; ped(d.g('galv'), y, o.stand, sx * 0.7);
    for (const s of [-1, 1]) put(d.g('porc'), insul(o.body * 0.9, ri, k33 ? 4 : 8), s * sx * 0.28, y, o.stand);
    bxe(d.g('alu'), -sx * 0.4, sx * 0.4, y - 40, y + 40, o.stand + o.body * 0.9, o.stand + o.body * 0.9 + 70); bxe(d.g('alu'), -sx * 0.5, -sx * 0.3, y - 60, y + 60, o.stand + o.body * 0.9 + 70, o.stand + o.body * 0.9 + 110); }
  return d; }
function eqCb(it) { const o = it.opts, sx = it.size[0], d = D(), k33 = o.kv === 33, tr = k33 ? 150 : 300, ri = k33 ? 60 : 110, zt = o.stand + tr + 150;
  for (const k of [-1, 0, 1]) { const y = k * o.pitch; ped(d.g('galv'), y, o.stand, sx * 0.8);
    d.g('steel').merge(cylAt(tr, sx * 0.8, X, [0, y, zt])); for (const s of [-1, 1]) { put(d.g('porc'), insul(o.body - tr * 2 - 200, ri, k33 ? 4 : 9), s * sx * 0.32, y, zt + tr * 0.6); bxe(d.g('alu'), s * sx * 0.32 - 100, s * sx * 0.32 + 100, y - 50, y + 50, o.stand + o.body - 60, o.stand + o.body); } }
  bxe(d.g('panel'), -250, 250, -250, 250, 0, 900); bxe(d.g('panelD'), -250, 250, -255, -250, 100, 800);
  return d; }
function eqCt(it) { const o = it.opts, sx = it.size[0], d = D(), k33 = o.kv === 33, ri = k33 ? 75 : 110;
  for (const k of [-1, 0, 1]) { const y = k * o.pitch; ped(d.g('galv'), y, o.stand, sx * 0.9); put(d.g('porc'), insul(o.body * 0.72, ri, k33 ? 4 : 8), 0, y, o.stand);
    d.g('steel').merge(cylAt(ri * 2.3, o.body * 0.26, Z, [0, y, o.stand + o.body * 0.86])); bxe(d.g('alu'), -sx * 0.4, sx * 0.4, y - 40, y + 40, o.stand + o.body - 50, o.stand + o.body); }
  return d; }
function eqLa(it) { const o = it.opts, d = D(), k33 = o.kv === 33, r = k33 ? 45 : 75;
  for (const k of [-1, 0, 1]) { const y = k * o.pitch; ped(d.g('galv'), y, o.stand, 300, 250); put(d.g('porcG'), insul(o.body, r, k33 ? 6 : 14), 0, y, o.stand);
    if (!k33) d.g('alu').merge(hollowAt(340, 300, 30, Z, [0, y, o.stand + o.body - 60])); bxe(d.g('panelD'), 160, 300, y - 60, y + 60, o.stand - 300, o.stand - 100); bxe(d.g('alu'), -60, 60, y - 40, y + 40, o.stand + o.body, o.stand + o.body + 40); }
  return d; }
function eqPt(it) { const o = it.opts, d = D(), k33 = o.kv === 33, r = k33 ? 80 : 130;
  for (const k of [-1, 0, 1]) { const y = k * o.pitch; ped(d.g('galv'), y, o.stand, 500, 400); put(d.g('porcG'), insul(o.body * 0.5, r, 5), 0, y, o.stand); put(d.g('porcG'), insul(o.body * 0.38, r * 0.9, 4), 0, y, o.stand + o.body * 0.5);
    d.g('steel').merge(cylAt(r * 1.6, 120, Z, [0, y, o.stand + o.body * 0.9])); bxe(d.g('panel'), 250, 650, y - 200, y + 200, o.stand - 500, o.stand); bxe(d.g('alu'), -60, 60, y - 40, y + 40, o.stand + o.body * 0.9 + 60, o.stand + o.body * 0.9 + 100); }
  return d; }
function busbar(it) { const o = it.opts, d = D(), L = o.len;
  for (const k of [-1, 0, 1]) { d.g('alu').merge(cylAt(o.busR, L, Y, [k * o.pitch, 0, 0]));
    for (let i = 0; i <= o.slots; i++) { const y = -L / 2 + i * (L / o.slots), h = o.post.h; put(d.g('porc'), insul(Math.min(1500, h * 0.25), o.busR * 1.5, 7), k * o.pitch, y, -Math.min(1500, h * 0.25));
      bxe(d.g('galv'), k * o.pitch - 100, k * o.pitch + 100, y - 100, y + 100, -h, -Math.min(1500, h * 0.25)); } }
  return d; }
function gcol(it) { const d = D(); d.g('galv').merge(lattice(it.opts.h, it.opts.w, it.opts.w * 0.6)); return d; }
function gbeam(it) { const o = it.opts, d = D(); put(d.g('galv'), girder(o.span, 800), 0, 0, 500);
  for (const k of [-1, 0, 1]) { const y = k * o.pitch; put(d.g('porcG'), insul(1400, 80, 10), 0, y, -900 - 1400 + 500); bxe(d.g('alu'), -50, 50, y - 40, y + 40, -900 - 1400 + 500 - 60, -900 - 1400 + 500); wire(d.g('alu'), [[0, y, -900 - 1400 + 440], [-4000, y, -900 - 1400 + 200], [-9000, y, -900 - 1400 + 700]], 22, 2000); }
  return d; }
function mast(it) { const d = D(), h = it.opts.h; d.g('galv').merge(lattice(h * 0.55, 700, 400)); put(d.g('galv'), lattice(h * 0.45, 400, 200), 0, 0, h * 0.55); d.g('steel').merge(cylAt(40, 1500, Z, [0, 0, h - 200])); return d; }
function floodPole(it) { const d = D(), h = it.opts.h; d.g('galv').merge(lathe([[0, 0], [150, 0], [150, 400], [70, h], [0, h]], { seg: 14 })); bxr(d.g('dark'), [900, 700, 120], [350, 0, h + 100], [0, -15, 0]); bxr(d.g('lamp'), [820, 640, 20], [380, 0, h + 40], [0, -15, 0]); return d; }

// ---- transformers ----
function txPower(it) { const [L, W, H] = it.size, o = it.opts, d = D(), th = H * 0.58, tw = W * 0.5, k132 = o.kv === 132, bp = k132 ? 1500 : 900;
  bxe(d.g('txpaint'), -L / 2 + 300, L / 2 - 300, -tw / 2, tw / 2, 0, th); bxe(d.g('txpaint'), -L / 2 + 250, L / 2 - 250, -tw / 2 - 30, tw / 2 + 30, th, th + 50);
  bxe(d.g('galv'), -L / 2 + 200, L / 2 - 200, -tw / 2 - 40, tw / 2 + 40, -0, 0 + 1);
  const nrad = Math.max(6, Math.floor((L * 0.66) / 130)), rd = (W - tw) / 2 - 150, rh = th * 0.8;
  for (const s of [-1, 1]) { for (let i = 0; i < nrad; i++) { const x = -L * 0.33 + i * (L * 0.66 / (nrad - 1)); bxe(d.g('txpaint'), x - 28, x + 28, s * (tw / 2 + 120) - (s > 0 ? 0 : rd), s * (tw / 2 + 120) + (s > 0 ? rd : 0), th * 0.1, th * 0.1 + rh); }
    d.g('txpaint').merge(cylAt(60, L * 0.66, X, [0, s * (tw / 2 + 140 + rd / 2), th * 0.1 + rh + 40])); d.g('txpaint').merge(cylAt(60, L * 0.66, X, [0, s * (tw / 2 + 140 + rd / 2), th * 0.1 - 40])); }
  const cr = H * 0.09; d.g('txpaint').merge(cylAt(cr, L * 0.56, X, [0, tw / 4, th + cr + 450])); for (const x of [-L * 0.2, L * 0.2]) bxe(d.g('txpaint'), x - 60, x + 60, tw / 4 - 60, tw / 4 + 60, th + 50, th + 450);
  d.g('txpaint').merge(cylAt(cr * 0.6, 200, X, [L * 0.28 + cr * 0.3, tw / 4, th + cr + 450]));
  bxe(d.g('panel'), -250, 250, -tw / 2 - 330, -tw / 2 - 30, th * 0.15, th * 0.15 + 700); bxe(d.g('panelD'), 0 - 300, 300, tw / 2 + 30, tw / 2 + 300, th * 0.2, th * 0.2 + 800);
  d.g('galv').merge(cylAt(90, 360, Y, [-L * 0.25, tw / 4 - 100, th + cr + 250]));
  for (const k of [-1, 0, 1]) { put(d.g('porc'), insul(H - th, k132 ? 120 : 80, k132 ? 10 : 6), -L / 2 + 500, k * bp, th + 50); bxe(d.g('alu'), -L / 2 + 460, -L / 2 + 540, k * bp - 40, k * bp + 40, H - 50, H); }
  for (const k of [-1.5, -0.5, 0.5, 1.5]) { put(d.g('porc'), insul(H * 0.22, 60, 4), L / 2 - 600, k * 650, th + 50); bxe(d.g('alu'), L / 2 - 650, L / 2 - 550, k * 650 - 30, k * 650 + 30, th + 50 + H * 0.22, th + 50 + H * 0.22 + 40); }
  for (const s of [-1, 1]) for (const x of [-1, 1]) d.g('dark').merge(cylAt(140, 120, Y, [x * L * 0.3, s * (tw / 2 + 60), -0]));
  return d; }
function txDist(it) { const [L, W, H] = it.size, o = it.opts, d = D(), th = H * (o.rating >= 500 ? 0.62 : 0.7), tw = W * 0.7;
  bxe(d.g('txpaint'), -L / 2, L / 2, -tw / 2, tw / 2, 80, th); bxe(d.g('txpaint'), -L / 2 - 10, L / 2 + 10, -tw / 2 - 10, tw / 2 + 10, th, th + 40);
  const nf = Math.floor(L / 70); for (const s of [-1, 1]) for (let i = 0; i < nf; i++) { const x = -L / 2 + 40 + i * (L - 80) / (nf - 1); bxe(d.g('txpaint'), x - 12, x + 12, s * (tw / 2 + 60) - 60, s * (tw / 2 + 60) + 60, 140, th - 60); }
  bxe(d.g('galv'), -L / 2, L / 2, -tw / 2 - 40, -tw / 2 - 10, 0, 80); bxe(d.g('galv'), -L / 2, L / 2, tw / 2 + 10, tw / 2 + 40, 0, 80);
  if (o.rating >= 200 && !o.pole) { const cr = H * 0.1; d.g('txpaint').merge(cylAt(cr, L * 0.6, X, [0, 0, th + cr + 120])); bxe(d.g('txpaint'), -80, 80, -40, 40, th + 40, th + 120); }
  for (const k of [-1, 0, 1]) { put(d.g('porc'), insul(o.hv + 120, 32, 4, 12), -L * 0.18, k * tw * 0.28, th + 40); bxe(d.g('alu'), -L * 0.18 - 25, -L * 0.18 + 25, k * tw * 0.28 - 25, k * tw * 0.28 + 25, th + 40 + o.hv + 120, th + 40 + o.hv + 150); }
  for (const k of [-1.5, -0.5, 0.5, 1.5]) { put(d.g('porc'), insul(H * 0.16, 28, 3, 12), L * 0.2, k * tw * 0.2, th + 40); }
  d.g('galv').merge(cylAt(30, 100, Z, [0, tw * 0.4, th + 90])); if (o.wheels) for (const sx of [-1, 1]) for (const sy of [-1, 1]) d.g('dark').merge(cylAt(70, 50, Y, [sx * L * 0.35, sy * (tw / 2 + 60), -20]));
  return d; }
// ---- switchgear and panels ----
function panelRow(it) { const o = it.opts, d = D(), n = o.n, w = o.w, depth = o.along === 'y' ? it.size[0] : it.size[1], h = it.size[2], along = o.along === 'y';
  const lt = it.kind === 'lt-row', rel = it.kind === 'relay-row';
  for (let i = 0; i < n; i++) { const c = -(n * w) / 2 + w * (i + 0.5);
    const B = (x0, x1, y0, y1, z0, z1, m) => along ? bxe(d.g(m), x0, x1, c + y0, c + y1, z0, z1) : bxe(d.g(m), c + y0, c + y1, x0, x1, z0, z1);   // (depth, across)
    const f = along ? -depth / 2 : -depth / 2;       // front face at -depth/2
    B(-depth / 2, depth / 2, -w / 2 + 3, w / 2 - 3, 0, h, 'panel');
    B(f - 8, f, -w / 2 + 30, w / 2 - 30, h * 0.12, h * 0.62, 'panelD'); B(f - 8, f, -w / 2 + 30, w / 2 - 30, h * 0.66, h * 0.94, 'panelD');
    if (o.bus && !lt && !rel) { B(f - 14, f - 8, -w * 0.3, w * 0.3, h * 0.74, h * 0.88, 'glass'); }
    B(f - 20, f - 8, -w * 0.08, w * 0.08, h * 0.3, h * 0.36, 'red'); B(f - 18, f - 8, w * 0.25, w * 0.3, h * 0.4, h * 0.55, 'dark');
    B(f - 14, f - 8, -w * 0.3, -w * 0.18, h * 0.2, h * 0.24, 'green');
  }
  if (o.bus && !lt && !rel) { const B2 = (a, b, z0, z1) => along ? bxe(d.g('copper'), depth / 2 - 60, depth / 2 - 20, -(n * w) / 2, (n * w) / 2, z0, z1) : bxe(d.g('copper'), -(n * w) / 2, (n * w) / 2, depth / 2 - 60, depth / 2 - 20, z0, z1); B2(0, 0, h - 160, h - 120); }
  return d; }
function rmu(it) { const [L, W, H] = it.size, d = D(); bxe(d.g('panel'), -L / 2, L / 2, -W / 2, W / 2, 0, H); bxe(d.g('panelD'), -L / 2, L / 2, -W / 2 - 10, -W / 2, 120, H * 0.45);
  for (let i = 0; i < 3; i++) { const x = -L / 3 + i * L / 3; bxe(d.g('panelD'), x - L * 0.14, x + L * 0.14, -W / 2 - 10, -W / 2, H * 0.52, H * 0.9); d.g('red').merge(cylAt(30, 40, Y, [x, -W / 2 - 25, H * 0.35])); bxe(d.g('glass'), x - 80, x + 80, -W / 2 - 14, -W / 2 - 10, H * 0.62, H * 0.82); bxe(d.g('dark'), x - 180, x + 180, -W / 2 - 14, -W / 2, 0, 120); }
  return d; }
function ltPanel(it) { const [L, W, H] = it.size, d = D(), n = it.opts.ways || 4; bxe(d.g('panel'), -L / 2, L / 2, -W / 2, W / 2, 0, H); for (let i = 0; i < n; i++) { const z = 150 + i * (H - 300) / n; bxe(d.g('panelD'), -L / 2 + 40, L / 2 - 40, -W / 2 - 8, -W / 2, z, z + (H - 300) / n - 30); bxe(d.g('alu'), L * 0.3, L * 0.38, -W / 2 - 16, -W / 2 - 8, z + 60, z + 160); } return d; }
function plainBox(it, m = 'panel') { const [L, W, H] = it.size, d = D(); bxe(d.g(m), -L / 2, L / 2, -W / 2, W / 2, 0, H); return d; }
function battery(it) { const [L, W, H] = it.size, d = D(); for (const z of [0, H * 0.5]) bxe(d.g('galv'), -L / 2, L / 2, -W / 2, W / 2, z, z + 60); for (const sx of [-1, 1]) for (const sy of [-1, 1]) bxe(d.g('galv'), sx * (L / 2 - 30) - 30, sx * (L / 2 - 30) + 30, sy * (W / 2 - 30) - 30, sy * (W / 2 - 30) + 30, 0, H);
  for (const z of [60, H * 0.5 + 60]) for (let i = 0; i < 12; i++) { const y = -W / 2 + 120 + i * (W - 240) / 11; bxe(d.g('blue'), -L / 2 + 80, L / 2 - 80, y - 90, y + 90, z, z + H * 0.38); d.g('dark').merge(cylAt(18, 40, Z, [-L * 0.2, y, z + H * 0.38 + 20])); d.g('dark').merge(cylAt(18, 40, Z, [L * 0.2, y, z + H * 0.38 + 20])); }
  return d; }
function capYard(it) { const [L, W, H] = it.size, d = D(); for (const sx of [-1, 1]) for (const sy of [-1, 1]) bxe(d.g('galv'), sx * (L / 2 - 100) - 80, sx * (L / 2 - 100) + 80, sy * (W / 2 - 100) - 80, sy * (W / 2 - 100) + 80, 0, H);
  for (const z of [H * 0.35, H * 0.7, H - 80]) { bxe(d.g('galv'), -L / 2, L / 2, -W / 2, -W / 2 + 160, z, z + 120); bxe(d.g('galv'), -L / 2, L / 2, W / 2 - 160, W / 2, z, z + 120); }
  for (const z of [H * 0.35 + 120, H * 0.7 + 120]) for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) d.g('steel').merge(cylAt(110, H * 0.28, Z, [-L / 2 + 400 + i * (L - 800) / 9, -W / 2 + 500 + j * (W - 1000) / 3, z]));
  return d; }
function capPanel(it) { return ltPanel({ ...it, opts: { ways: it.opts.stages || 6 } }); }
// ---- other site items ----
function oilPitG(it) { const [L, W] = it.size, d = D(), c = 150; bxe(d.g('conc'), -L / 2, L / 2, -W / 2, -W / 2 + c, 0, 150); bxe(d.g('conc'), -L / 2, L / 2, W / 2 - c, W / 2, 0, 150); bxe(d.g('conc'), -L / 2, -L / 2 + c, -W / 2 + c, W / 2 - c, 0, 150); bxe(d.g('conc'), L / 2 - c, L / 2, -W / 2 + c, W / 2 - c, 0, 150); bxe(d.g('gravel'), -L / 2 + c, L / 2 - c, -W / 2 + c, W / 2 - c, 0, 110); return d; }
function fireWall(it) { const [L, W, H] = it.size, d = D(); bxe(d.g('conc'), -L / 2, L / 2, -W / 2, W / 2, 0, H); bxe(d.g('concD'), -L / 2 - 60, L / 2 + 60, -W / 2 - 60, W / 2 + 60, H - 120, H); for (let i = 0; i < 4; i++) bxe(d.g('concD'), -L / 2 + (i + 0.5) * L / 4 - 200, -L / 2 + (i + 0.5) * L / 4 + 200, -W / 2 - 40, W / 2 + 40, 0, H - 120); return d; }
function trenchRun(it) { const o = it.opts, d = D(), L = o.len; bxe(d.g('conc'), -L / 2, L / 2, -300, 300, 0, 150); const n = Math.floor(L / 700); for (let i = 0; i < n; i++) { const x = -L / 2 + (i + 0.5) * L / n; bxe(d.g('steel'), x - L / n / 2 + 10, x + L / n / 2 - 10, -260, 260, 150, 175); bxe(d.g('galv'), x - 30, x + 30, -120, 120, 175, 185); } return d; }
function earthPit(it) { const d = D(); bxe(d.g('conc'), -200, 200, -200, 200, 0, 25); d.g('steel').merge(cylAt(90, 40, Z, [0, 0, 25])); bxe(d.g('copper'), -20, 20, -500, 0, 25, 40); return d; }
function earthGrid(it) { const o = it.opts, d = D(), s = o.step, z = 12; for (let x = o.x0; x <= o.x1 + 1; x += s) bxe(d.g('copper'), x - it.at[0] - 25, x - it.at[0] + 25, o.y0 - it.at[1], o.y1 - it.at[1], 0, 15); for (let y = o.y0; y <= o.y1 + 1; y += s) bxe(d.g('copper'), o.x0 - it.at[0], o.x1 - it.at[0], y - it.at[1] - 25, y - it.at[1] + 25, 0, 15); return d; }
function earthStrip(it) { const o = it.opts, d = D(), cx = it.at[0], cy = it.at[1]; for (const y of [o.y0 + 30, o.y1 - 30]) bxe(d.g('copper'), o.x0 - cx, o.x1 - cx, y - cy - 20, y - cy + 20, 0, 30); for (const x of [o.x0 + 30, o.x1 - 30]) bxe(d.g('copper'), x - cx - 20, x - cx + 20, o.y0 - cy, o.y1 - cy, 0, 30); return d; }
function lights(it) { const o = it.opts, d = D(), cx = it.at[0], cy = it.at[1]; for (const y of o.rows) for (let x = o.x0 + 600; x < o.x1 - 600; x += o.zStep) bxe(d.g('lamp'), x - cx - 600, x - cx + 600, y - 45, y + 45, 0, 50); return d; }
function hoistG(it) { const [L, W, H] = it.size, d = D(); bxe(d.g('yellow'), -60, 60, -W / 2, W / 2, 0, H * 0.9); bxe(d.g('yellow'), -90, 90, -W / 2, W / 2, H * 0.8, H * 0.9); bxe(d.g('dark'), -140, 140, -120, 120, -260, 0); wire(d.g('dark'), [[0, 0, -260], [0, 0, -900]], 8, 100); bxe(d.g('steel'), -40, 40, -30, 30, -1000, -900); return d; }
function fenceRun(it) { const o = it.opts, d = D(), L = o.len, H = RULE.fenceH, ax = o.ax === 'x';
  const B = (a0, a1, b0, b1, z0, z1, m) => ax ? bxe(d.g(m), a0, a1, b0, b1, z0, z1) : bxe(d.g(m), b0, b1, a0, a1, z0, z1);
  B(-L / 2, L / 2, -8, 8, 150, H - 150, 'mesh'); B(-L / 2, L / 2, -30, 30, 0, 150, 'conc'); B(-L / 2, L / 2, -20, 20, H - 150, H, 'galv');
  const n = Math.max(1, Math.round(L / 3000)); for (let i = 0; i <= n; i++) { const a = -L / 2 + i * L / n; B(a - 50, a + 50, -50, 50, 0, H + 350, 'galv'); B(a - 30, a + 30, -200, 200, H + 250, H + 290, 'galv'); }
  for (const z of [H + 270, H + 310]) B(-L / 2, L / 2, -200, -196, z, z + 4, 'dark'); return d; }
function gate(it) { const o = it.opts, d = D(), gw = it.size[0], H = RULE.fenceH, sh = gw * o.open, L = gw;
  bxe(d.g('galv'), -gw / 2 - sh, gw / 2 - sh, -40, 40, H - 150, H); bxe(d.g('galv'), -gw / 2 - sh, gw / 2 - sh, -40, 40, 150, 250); bxe(d.g('mesh'), -gw / 2 - sh, gw / 2 - sh, -10, 10, 250, H - 150);
  for (const x of [-gw / 2 - sh, gw / 2 - sh - 80]) bxe(d.g('galv'), x, x + 80, -40, 40, 150, H); for (const x of [-gw / 2 - 60, gw / 2 - 60 + 60]) bxe(d.g('galv'), x - 70, x + 70, -100, 100, 0, H + 300);
  for (let i = 0; i < 6; i++) d.g('dark').merge(cylAt(40, 90, Y, [-gw / 2 - sh + 200 + i * (gw * 0.8 / 5), 0, 90])); return d; }
function bayConn(it) { const o = it.opts, d = D(); for (const pp of o.paths) wire(d.g('alu'), pp.map(q => [q[0] - it.at[0], q[1] - it.at[1], q[2] - it.at[2]]), o.r, 600); return d; }
function roadG(it) { const [L, W, H] = it.size, d = D(); bxe(d.g('road'), -L / 2, L / 2, -W / 2, W / 2, 0, H); return d; }
function pole(it) { const o = it.opts, d = D(), h = it.size[2]; d.g('conc').merge(lathe([[0, 0], [o.r0, 0], [o.r1, h], [0, h]], { seg: 16 })); return d; }
function crossarm(it) { const L = it.size[1], d = D(); bxe(d.g('galv'), -75, 75, -L / 2, L / 2, 0, 100); for (const k of [-1, 0, 1]) put(d.g('porcG'), insul(230, 45, 3, 12), 0, k * L * 0.36, 100); return d; }
function doFuse(it) { const o = it.opts, d = D(); for (const k of [-1, 0, 1]) { const y = k * o.pitch; bxe(d.g('galv'), -250, 250, y - 25, y + 25, 650, 700); put(d.g('porcG'), insul(450, 38, 4, 12), -100, y, 200); bxr(d.g('red'), [60, 60, 380], [150, y, 380], [0, 20, 0]); wire(d.g('alu'), [[-100, y, 650], [-100, y, 1000], [-1200, y, 1000]].slice(0, 2), 12, 60); } return d; }
function laPole(it) { const o = it.opts, d = D(); for (const k of [-1, 0, 1]) { const y = k * o.pitch; put(d.g('porcG'), insul(450, 30, 6, 12), 0, y, 150); bxe(d.g('galv'), -80, 80, y - 20, y + 20, 100, 150); } return d; }
function simpleBox(m) { return it => plainBox(it, m); }
function stayWire(it) { const o = it.opts, d = D(); wire(d.g('steel'), [[o.from[0] - it.at[0], o.from[1] - it.at[1], o.from[2] - it.at[2]], [o.to[0] - it.at[0], o.to[1] - it.at[1], 0]], 10, 10); bxe(d.g('conc'), o.to[0] - it.at[0] - 250, o.to[0] - it.at[0] + 250, -250, 250, -50, 100); return d; }
function ner(it) { const [L, W, H] = it.size, d = D(); bxe(d.g('panel'), -L / 2, L / 2, -W / 2, W / 2, 0, H); put(d.g('porc'), insul(500, 40, 3, 12), 0, 0, H); for (let i = 0; i < 6; i++) bxe(d.g('dark'), -L / 2 + 120 + i * (L - 240) / 5, -L / 2 + 150 + i * (L - 240) / 5, -W / 2 - 6, -W / 2, 200, H - 200); return d; }
// ---- GIS ----
function gisBay(it) { const [L, W, H] = it.size, o = it.opts, d = D(), k33 = o.kv === 33, br = H * (k33 ? 0.11 : 0.1);
  bxe(d.g('galv'), -L / 2, L / 2, -W / 2, W / 2, 0, 250);
  d.g('gis').merge(cylAt(br * 1.1, W + 200, Y, [-L * 0.3, 0, H * 0.78])); d.g('gis').merge(cylAt(br * 1.1, W + 200, Y, [-L * 0.12, 0, H * 0.78 + 0]));
  for (const x of [-L * 0.3, -L * 0.12]) { d.g('gis').merge(cylAt(br * 0.65, H * 0.4, Z, [x, 0, H * 0.58])); d.g('alu').merge(hollowAt(br * 1.3, br * 1.1, 60, Y, [x, W / 2 + 70, H * 0.78])); }
  d.g('gis').merge(cylAt(br * 1.2, L * 0.55, X, [L * 0.12, 0, H * 0.38])); d.g('steel').merge(hollowAt(br * 1.5, br * 1.2, 160, X, [L * 0.05, 0, H * 0.38])); d.g('gis').merge(cylAt(br * 0.55, H * 0.28, Z, [L * 0.38, 0, H * 0.22 + 120]));
  d.g('gis').merge(cylAt(br * 0.7, L * 0.3, X, [(o.role === 'line' ? -1 : 1) * L * 0.35, 0, H * 0.38]));
  bxe(d.g('panelD'), -L / 2 + 100, -L / 2 + 700, -W * 0.45, W * 0.45, 250, 2200); bxe(d.g('glass'), -L / 2 + 95, -L / 2 + 100, -W * 0.3, W * 0.3, 1500, 1900);
  for (const s of [-1, 1]) bxe(d.g('blue'), L * 0.45 - 20, L * 0.45 + 20, s * W * 0.4 - 60, s * W * 0.4 + 60, 250, H * 0.35);
  return d; }
function wallBush(it) { const o = it.opts, d = D(); for (const k of [-1, 0, 1]) { d.g('porcG').merge(along(insul(1700, 105, 9), X, [-300, k * o.pitch, 0])); d.g('alu').merge(cylAt(40, 200, X, [1500, k * o.pitch, 0])); } return d; }
function duct(it) { const o = it.opts, d = D(); d.g('gis').merge(tube(rounded(o.pts.map(p => [p[0] - it.at[0], p[1] - it.at[1], p[2] - it.at[2]]), 900, 8), o.r, { seg: 20 })); for (let i = 0; i < o.pts.length - 1; i++) { const a = o.pts[i], b = o.pts[i + 1], m = [(a[0] + b[0]) / 2 - it.at[0], (a[1] + b[1]) / 2 - it.at[1], (a[2] + b[2]) / 2 - it.at[2]]; const dir = norm(sub(b, a)); d.g('steel').merge(hollowAt(o.r * 1.35, o.r * 0.9, 90, dir, m)); } return d; }
function lineTower(it) { const o = it.opts, d = D(), h = o.h, py = o.pitch * 3; d.g('galv').merge(lattice(h, 800, 400)); bxe(d.g('galv'), -100, 100, -py - 600, py + 600, h - 200, h);
  for (const k of [-1, 0, 1]) { const y = k * py; put(d.g('porcG'), insul(1400, 80, 10), 0, y, h - 1600); wire(d.g('alu'), [[0, y, h - 1650], [-3000, y, h - 1850], [-8000, y, h - 1300]], 22, 2000); } return d; }
function craneG(it) { const o = it.opts, d = D(), s = o.span; bxe(d.g('yellow'), -s / 2, s / 2, -150, 150, 0, 500); bxe(d.g('yellow'), -s / 2 - 100, -s / 2 + 300, -400, 400, -100, 600); bxe(d.g('yellow'), s / 2 - 300, s / 2 + 100, -400, 400, -100, 600);
  for (const sx of [-1, 1]) bxe(d.g('galv'), sx * (s / 2 + 200) - 60, sx * (s / 2 + 200) + 60, -o.len / 2, o.len / 2, 300, 420); bxe(d.g('dark'), -300, 300, -250, 250, -500, 0); wire(d.g('dark'), [[0, 0, -500], [0, 0, -1500]], 10, 100); bxe(d.g('steel'), -50, 50, -40, 40, -1600, -1500); return d; }
const KIND = { 'eq-iso': eqIso, 'eq-cb': eqCb, 'eq-ct': eqCt, 'eq-la': eqLa, 'eq-pt': eqPt, busbar, 'gantry-col': gcol, 'gantry-beam': gbeam, mast, 'flood-pole': floodPole, 'tx-power': txPower, 'tx-dist': txDist, 'vcb-row': panelRow, 'lt-row': panelRow, 'relay-row': panelRow, rmu, 'lt-panel': ltPanel,
  'battery-bank': battery, 'capbank-yard': capYard, 'capbank-panel': capPanel, 'oil-pit': oilPitG, 'fire-wall': fireWall, 'trench-run': trenchRun, 'earth-pit': earthPit, 'earth-grid': earthGrid, 'earth-strip': earthStrip, lights, hoist: hoistG, 'fence-run': fenceRun, gate, road: roadG, 'bay-conn': bayConn, pole, crossarm, 'do-fuse': doFuse, 'la-pole': laPole,
  'lt-box': simpleBox('panel'), charger: simpleBox('panel'), desk: simpleBox('panelD'), plinth: simpleBox('conc'), platform: simpleBox('galv'), bracket: simpleBox('galv'), stay: stayWire, ner, 'gis-bay': gisBay, 'wall-bushings': wallBush, duct, 'line-tower': lineTower, crane: craneG };
// names for the exported parts
const PART = { eq: 'yard-equipment', gantry: 'gantry', tx: 'transformer' };

// ---- doors, louvres (world placement from the building openings) ----
function leaf(w, h, ysign, color) { const g = new Geo(), y0 = ysign > 0 ? 0 : -w, y1 = ysign > 0 ? w : 0; bxe(g, -50, 0, y0, y1, 0, h); bxe(g, 0, 14, y0 + 60, y1 - 60, h * 0.1, h * 0.9 - 0); bxe(g, 0, 14, y0 + w / 2 - 30, y0 + w / 2 + 30, 60, h - 60); g.merge(cylAt(14, 160, Z, [30, y0 + (ysign > 0 ? w - 90 : 90), 1000])); return g; }
function building(P, b, cut, open) {
  const out = D(), wallC = { grey: 0xb4b8bc, cream: 0xe0d4b4, white: 0xe8e8e4 }[P.p.wallColor] ?? 0xb4b8bc;
  const mat = { floor: 'conc', roof: 'conc', wall: 'wall', part: 'wall' };
  for (const s of shell({ ...b, noRoof: cut })) {
    if (cut && s.kind === 'wall' && (Math.abs(s.c[1] - (b.y0 + b.t / 2)) < 1)) continue;          // the front (-Y) wall is not drawn in the cutaway
    bxe(out.g(mat[s.kind]), s.c[0] - s.s[0] / 2, s.c[0] + s.s[0] / 2, s.c[1] - s.s[1] / 2, s.c[1] + s.s[1] / 2, s.c[2] - s.s[2] / 2, s.c[2] + s.s[2] / 2);
  }
  const doors = new Geo(), lou = new Geo(), ang = 110 * open;
  for (const o of openings(b)) {
    if (cut && o.wall === 'negy') continue;
    const fr = { R: fromEuler([0, 0, 0], [0, 0, o.yaw]).R, t: o.c };
    if (o.kind === 'door') {
      const g = new Geo();
      if (o.w > 1300) { const wl = (o.w - 20) / 2; for (const sd of [1, -1]) g.merge(leaf(wl, o.h - 20, -sd), { R: fromEuler([0, 0, 0], [0, 0, sd * ang]).R, t: [-0, sd * (o.w / 2 - 10), 10] }); }
      else g.merge(leaf(o.w - 20, o.h - 20, -1), { R: fromEuler([0, 0, 0], [0, 0, ang]).R, t: [0, o.w / 2 - 10, 10] });
      doors.merge(g, fr);
    } else if (o.kind === 'louvre') {
      const g = new Geo(), n = Math.max(1, Math.floor((o.h - 80) / 70));
      for (let i = 0; i < n; i++) bxr(g, [80, o.w - 80, 5], [-t0(b) / 2, 0, 40 + 35 + i * (o.h - 80) / n], [0, 40, 0]);
      bxe(g, -60, 0, -o.w / 2, -o.w / 2 + 40, 0, o.h); bxe(g, -60, 0, o.w / 2 - 40, o.w / 2, 0, o.h); bxe(g, -60, 0, -o.w / 2, o.w / 2, o.h - 40, o.h); bxe(g, -60, 0, -o.w / 2, o.w / 2, 0, 40);
      lou.merge(g, fr);
    }
  }
  return { out, doors, lou, wallC };
}
const t0 = b => b.t;

export function substation({ params: p }) {
  const P = plan(p), parts = [], cut = on(p.cutaway), open = Math.max(0, Math.min(100, +p.open || 0)) / 100;
  const wallC = { grey: 0xb4b8bc, cream: 0xe0d4b4, white: 0xe8e8e4 }[p.wallColor] ?? 0xb4b8bc;
  const bag = new Map();    // part name -> { geo, color }
  const into = (name, color) => { let e = bag.get(name); if (!e) { e = { geo: new Geo(), color }; bag.set(name, e); } return e.geo; };
  // ground plate and road
  const g0 = into('ground-gravel', COL.gravel), pl = P.plot; bxe(g0, pl.x0, pl.x1, pl.y0, pl.y1, 0, P.gT);
  // equipment items
  for (const it of P.items) {
    const fn = KIND[it.kind]; if (!fn) continue;
    const d = fn(it), fr = { R: fromEuler([0, 0, 0], [0, 0, it.yaw || 0]).R, t: it.at };
    for (const [m, geo] of Object.entries(d)) { if (m === 'g' || !geo || !geo.pos || !geo.pos.length) continue; into(`${it.kind.replace(/^eq-/, 'yard-')}-${m}`, COL[m] ?? COL.steel).merge(geo, fr); }
  }
  // buildings
  for (const b of P.blds) {
    const B = building(P, b, cut && (b.kind === 'kiosk' || b.kind === 'indoor' || b.kind === 'control' || b.kind === 'gis'), open);
    const nm = b.id;
    if (B.out.conc) into(nm + '-floor-roof', COL.conc).merge(B.out.conc); if (B.out.wall) into(nm + '-walls', wallC).merge(B.out.wall);
    if (B.doors.pos && B.doors.pos.length) into(nm + '-doors', 0x5e6a74).merge(B.doors); if (B.lou.pos && B.lou.pos.length) into(nm + '-louvres', 0x8a949c).merge(B.lou);
  }
  for (const [name, e] of bag) if (e.geo.pos && e.geo.pos.length) parts.push(part(name, e.geo, e.color, name.includes('mesh') ? { opacity: 0.45 } : {}));
  return parts;
}
