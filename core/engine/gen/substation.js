// Electrical substation generator, five types in one component:
//   pole    pole-mounted 11/0.4 kV (single pole up to 63 kVA, H-pole from 100 kVA)
//   kiosk   compact / packaged 11/0.4 kV (RMU + transformer + LT panel in one enclosure)
//   indoor  indoor 11/0.4 kV building (HT switch room, transformer room(s), LT room)
//   ais     outdoor air-insulated yard 33/11 kV or 132/33 kV with control building (gantries, bus, bays, transformers)
//   gis     indoor GIS hall 33/11 kV or 132/33 kV + outdoor transformers + control building
// plan(p) is the single source of truth: items (equipment with an envelope), building shells (walls with real openings), notes.
// gen/substation.js turns it into collision shapes and ports; visual/substation.js draws the real mesh from the same plan.
// Engine space: X = length, Y = width, Z = up. Origin = bottom centre of the plot. Ground plate top = zf. All sizes in mm.
// Every number below is a generic / indicative value (typical practice), NOT a maker's catalogue or a code. Confirm with the utility standard.
import { rectMinus } from './genroom.js';

export const TYPES = { pole: 'Pole-mounted (11/0.4 kV)', kiosk: 'Compact kiosk (11/0.4 kV)', indoor: 'Indoor building (11/0.4 kV)', ais: 'Outdoor AIS yard with control building', gis: 'Indoor GIS hall + outdoor transformers' };
const S33 = { '33/11': [5000, 8000, 10000, 16000, 20000], '132/33': [20000, 31500, 40000, 50000, 63000] };
export const ALLOWED = { pole: { '11/0.4': [25, 50, 63, 100, 200] }, kiosk: { '11/0.4': [200, 315, 500, 630, 800, 1000, 1250, 1600] }, indoor: { '11/0.4': [500, 630, 800, 1000, 1250, 1600, 2000] }, ais: S33, gis: S33 };
// distribution transformer: [length, width, height, mass kg, oil L, HV bushing height]
export const DIST = { 25: [900, 600, 1050, 300, 35, 120], 50: [1000, 650, 1150, 450, 50, 120], 63: [1050, 700, 1200, 520, 60, 120], 100: [1100, 750, 1300, 700, 85, 150], 200: [1300, 850, 1500, 1000, 150, 150], 315: [1450, 900, 1600, 1350, 220, 180], 500: [1650, 1000, 1750, 1800, 350, 180], 630: [1750, 1050, 1850, 2100, 440, 200], 800: [1850, 1100, 1950, 2500, 560, 200], 1000: [1950, 1200, 2050, 3000, 700, 220], 1250: [2050, 1250, 2150, 3500, 875, 220], 1600: [2250, 1350, 2300, 4300, 1120, 250], 2000: [2400, 1450, 2450, 5200, 1400, 250] };
// power transformer: [length, width, height, mass kg, oil L]
export const POWER = { 5000: [4200, 2800, 3800, 14000, 5000], 8000: [4800, 3000, 4100, 20000, 7500], 10000: [5000, 3100, 4300, 24000, 9000], 16000: [5800, 3500, 4800, 35000, 14000], 20000: [6000, 3600, 5000, 40000, 17000], 31500: [7500, 4500, 5800, 62000, 27000], 40000: [8000, 4800, 6000, 72000, 33000], 50000: [8500, 5000, 6200, 82000, 40000], 63000: [9000, 5200, 6500, 95000, 48000] };
// yard data per voltage: phase spacing, minimum bay width, terminal height Ht, bus height, line gantry beam height, equipment spacings, clearances (Ph-Ph, Ph-E, sectional), fence margin, tx gaps (with / without fire wall), mast height
export const YARD = {
  '33/11': { hv: 33, mv: 11, ph: 1300, bay: 8000, Ht: 3800, Hbus: 6100, Hg: 8000, dIC: 1500, dCI: 2000, dBus: 2500, dGI: 1500, phPh: 430, phE: 500, sect: 2800, margin: 3800, gapFW: 5000, gapNo: 10000, mast: 18000, pole: 450, stand: { iso: 2800, cb: 2400, ct: 2800, la: 3000, pt: 2800 }, body: { iso: 1000, cb: 1400, ct: 1000, la: 800, pt: 1000 }, busR: 50 },
  '132/33': { hv: 132, mv: 33, ph: 3000, bay: 13500, Ht: 5200, Hbus: 8000, Hg: 11000, dIC: 2500, dCI: 3750, dBus: 4500, dGI: 1800, phPh: 1300, phE: 1300, sect: 4000, margin: 5000, gapFW: 8000, gapNo: 15000, mast: 25000, pole: 700, stand: { iso: 2900, cb: 2400, ct: 2900, la: 3300, pt: 2200 }, body: { iso: 2300, cb: 2800, ct: 2300, la: 1900, pt: 3000 }, busR: 75 }
};
export const RULE = {
  gT: 150, floor: 250, floorDeep: 500, roofT: 150, wallT: 230, panelFront: 1500, panelRear: 1000, wallClear: 900, itemClear: 600, aisle: 1200,
  mvPanel: { 11: [800, 1600, 2300], 33: [1000, 2400, 2800] }, ltPanel: [800, 800, 2200], relayPanel: [800, 800, 2200],
  oilVoid: 0.4, oilPitMargin: 1000, fireWallT: 230, fireWallOver: 600, fenceH: 2400, gateW: 6000, roadW: 3500, flood: 12000,
  ground: 'live parts at least 3.7 m (33 kV) / 5.2 m (132 kV) above ground, insulator bottom at least 2.4 m', gis: { '33/11': [900, 3800, 2900], '132/33': [1500, 6000, 4300] }, // GIS bay [width, length, height]
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), up = (v, s) => Math.ceil(v / s - 1e-9) * s, on = v => +v === 1, r1 = v => Math.round(v * 10) / 10;
const nearest = (list, v) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

// ---- building shell: boxes for floor, walls with openings, partitions, roof ----
// spec: { x0, x1, y0, y1 (outer), t, zb (floor top), fl, Hi, roofT, holes: {negx,posx,negy,posy: [{kind,u0,u1,v0,v1}]}, parts: [{axis,pos,from,to,t,holes}], floorHoles: [{x0,x1,y0,y1}] }
// u of a wall hole = distance from the outer corner (x0 for the Y walls, y0 for the X walls)
export function shell(s) {
  const out = [], { x0, x1, y0, y1, t, zb, fl, Hi, roofT } = s, L = x1 - x0, W = y1 - y0, zc = zb + Hi;
  const bx = (kind, cx, cy, cz, sx, sy, sz) => { if (sx > 1e-6 && sy > 1e-6 && sz > 1e-6) out.push({ kind, c: [cx, cy, cz], s: [sx, sy, sz] }); };
  for (const r of rectMinus(L, W, (s.floorHoles || []).map(h => ({ u0: h.x0 - x0, u1: h.x1 - x0, v0: h.y0 - y0, v1: h.y1 - y0 })))) bx('floor', x0 + (r.u0 + r.u1) / 2, y0 + (r.v0 + r.v1) / 2, zb - fl / 2 + (s.floorHoles && s.floorHoles.length ? 0 : 0), r.u1 - r.u0, r.v1 - r.v0, fl);
  const H = s.holes || {};
  for (const [name, side, axis] of [['negx', -1, 'x'], ['posx', 1, 'x'], ['negy', -1, 'y'], ['posy', 1, 'y']]) {
    const full = axis === 'x' ? W : L - 2 * t, off = axis === 'x' ? 0 : t;
    const holes = (H[name] || []).map(h => ({ ...h, u0: h.u0 - off, u1: h.u1 - off }));
    for (const r of rectMinus(full, Hi, holes)) {
      const uc = (r.u0 + r.u1) / 2, z = zb + (r.v0 + r.v1) / 2, sz = r.v1 - r.v0, du = r.u1 - r.u0;
      if (axis === 'x') bx('wall', side < 0 ? x0 + t / 2 : x1 - t / 2, y0 + uc, z, t, du, sz);
      else bx('wall', x0 + t + uc, side < 0 ? y0 + t / 2 : y1 - t / 2, z, du, t, sz);
    }
  }
  for (const p of s.parts || []) {
    const len = p.to - p.from;
    for (const r of rectMinus(len, Hi, p.holes || [])) {
      const uc = p.from + (r.u0 + r.u1) / 2, z = zb + (r.v0 + r.v1) / 2;
      if (p.axis === 'y') bx('part', uc, p.pos, z, r.u1 - r.u0, p.t, r.v1 - r.v0); else bx('part', p.pos, uc, z, p.t, r.u1 - r.u0, r.v1 - r.v0);
    }
  }
  if (!s.noRoof) bx('roof', (x0 + x1) / 2, (y0 + y1) / 2, zc + roofT / 2, L, W, roofT);
  return out;
}
// world placement of a wall hole (centre on the outer face, outward yaw in degrees), used by the visual layer for doors and louvres
export function openings(s) {
  const out = [], { x0, x1, y0, y1, zb } = s;
  for (const [name, side, axis] of [['negx', -1, 'x'], ['posx', 1, 'x'], ['negy', -1, 'y'], ['posy', 1, 'y']]) for (const h of (s.holes || {})[name] || []) {
    const uc = (h.u0 + h.u1) / 2, yaw = axis === 'x' ? (side < 0 ? 180 : 0) : (side < 0 ? -90 : 90);
    out.push({ ...h, wall: name, w: h.u1 - h.u0, h: h.v1 - h.v0, yaw, c: axis === 'x' ? [side < 0 ? x0 : x1, y0 + uc, zb + h.v0] : [x0 + uc, side < 0 ? y0 : y1, zb + h.v0] });
  }
  return out;
}

// ---- the plan ----
export function plan(p) {
  const type = TYPES[p.type] ? p.type : 'ais', notes = [], items = [], blds = [], extra = {};
  let kv = p.kv;
  const okKv = Object.keys(ALLOWED[type]);
  if (!okKv.includes(kv)) { const to = okKv[0]; notes.push(`Note: voltage ${kv} kV is not offered for this type. Using ${to} kV.`); kv = to; }
  const list = ALLOWED[type][kv], rating = nearest(list, +p.rating);
  if (rating !== +p.rating) notes.push(`Note: rating ${p.rating} kVA is not offered for this type and voltage. Using ${rating} kVA.`);
  const maxTx = { pole: 1, kiosk: 1, indoor: 2, ais: 3, gis: 3 }[type], tx = clamp(Math.round(+p.tx || 1), 1, maxTx);
  if (tx !== +p.tx) notes.push(`Note: ${type} type has at most ${maxTx} transformer(s). Using ${tx}.`);
  const feeders = clamp(Math.round(+p.feeders || 0), 0, 12), lines = clamp(Math.round(+p.lines || 1), 1, 2);
  const yard = YARD[kv], gT = RULE.gT, zf = gT, fac = k => on(p[k]);
  const ctx = { type, kv, rating, tx, feeders, lines, yard, zf, gT, notes, items, blds, extra, fac, p, wallT: RULE.wallT };
  let box;
  if (type === 'pole') box = layoutPole(ctx); else if (type === 'kiosk') box = layoutKiosk(ctx); else if (type === 'indoor') box = layoutIndoor(ctx); else box = layoutYard(ctx);
  // plot: ground plate = fence rectangle (or the building / equipment bounds + clearance)
  const plot = box;
  const shift = [-(plot.x0 + plot.x1) / 2, -(plot.y0 + plot.y1) / 2];
  const moveBox = b => ({ ...b, x0: b.x0 + shift[0], x1: b.x1 + shift[0], y0: b.y0 + shift[1], y1: b.y1 + shift[1] });
  for (const it of items) {
    it.at = [it.at[0] + shift[0], it.at[1] + shift[1], it.at[2]];
    const o = it.opts; if (!o) continue;                                  // coordinates stored in opts move with the plot centre
    if (o.x0 !== undefined) { o.x0 += shift[0]; o.x1 += shift[0]; } if (o.y0 !== undefined) { o.y0 += shift[1]; o.y1 += shift[1]; }
    for (const k of ['from', 'to']) if (o[k]) o[k] = [o[k][0] + shift[0], o[k][1] + shift[1], o[k][2]];
    if (o.pts) o.pts = o.pts.map(q => [q[0] + shift[0], q[1] + shift[1], q[2]]);
    if (o.paths) o.paths = o.paths.map(pp => pp.map(q => [q[0] + shift[0], q[1] + shift[1], q[2]]));
  }
  const bl = blds.map(b => { const m = moveBox(b); m.parts = (b.parts || []).map(q => q.axis === 'y' ? { ...q, pos: q.pos + shift[1], from: q.from + shift[0], to: q.to + shift[0] } : { ...q, pos: q.pos + shift[0], from: q.from + shift[1], to: q.to + shift[1] }); m.floorHoles = (b.floorHoles || []).map(h => ({ x0: h.x0 + shift[0], x1: h.x1 + shift[0], y0: h.y0 + shift[1], y1: h.y1 + shift[1] })); return m; });
  const P = { type, kv, rating, tx, feeders, lines, yard, zf, gT, plot: moveBox(plot), items, blds: bl, notes, extra, p, hv: kv === '11/0.4' ? 11 : yard.hv, mv: kv === '11/0.4' ? 0.4 : yard.mv };
  P.Lo = P.plot.x1 - P.plot.x0; P.Wo = P.plot.y1 - P.plot.y0;
  P.top = Math.max(zf + 1, ...items.map(i => i.at[2] + (i.size ? i.size[2] : 0)), ...bl.map(b => b.zb + b.Hi + b.roofT));
  return P;
}

// ---- helpers used by the layouts ----
const add = (c, kind, id, x, y, z, size, o = {}) => { const it = { kind, id, at: [x, y, z], size, yaw: 0, ...o }; c.items.push(it); return it; };
const phases = (sx, pw, sz, pitch) => [-1, 0, 1].map(k => ({ t: 'box', s: [sx, pw, sz], c: [0, k * pitch, sz / 2] }));
const equipDims = (y, kind) => { const b = y.body, st = y.stand, w = y.pole; return { iso: [y.hv === 33 ? 1500 : 2800, w, st.iso + b.iso], cb: [y.hv === 33 ? 1200 : 1800, w + (y.hv === 33 ? 200 : 300), st.cb + b.cb], ct: [y.hv === 33 ? 600 : 800, w, st.ct + b.ct], la: [y.hv === 33 ? 500 : 700, w, st.la + b.la], pt: [y.hv === 33 ? 600 : 900, w, st.pt + b.pt] }[kind]; };
// 3-phase equipment group in a bay: envelope per pole, base at ground
function addEquip(c, kind, id, x, y, yaw = 0) {
  const Y = c.yard, d = equipDims(Y, kind), it = add(c, 'eq-' + kind, id, x, y, c.zf, d, { yaw, ph: Y.ph, col: phases(d[0], d[1], d[2], Y.ph), opts: { kv: Y.hv, stand: Y.stand[kind], body: Y.body[kind], pitch: Y.ph } });
  return it;
}
function oilPit(c, id, x, y, T) {   // soak pit under a transformer: plan = transformer + 1 m each side, depth from the oil volume (void 40 %)
  const m = RULE.oilPitMargin, L = T[0] + 2 * m, W = T[1] + 2 * m, depth = Math.max(300, up(T[4] / 1000 / (RULE.oilVoid * (L / 1000) * (W / 1000)) * 1000, 50));
  c.extra.pits = c.extra.pits || []; c.extra.pits.push({ x, y, L, W, depth, oil: T[4] });
  add(c, 'oil-pit', id, x, y, c.zf, [L, W, 60], { col: [{ t: 'box', s: [L, W, 60], c: [0, 0, 30] }], opts: { depth } });
  return depth;
}
const door = (u0, w, h = 2100) => ({ kind: 'door', u0, u1: u0 + w, v0: 0, v1: h });
const louvre = (u0, w, v0, h) => ({ kind: 'louvre', u0, u1: u0 + w, v0, v1: v0 + h });

// ============ POLE ============
function layoutPole(c) {
  const T = DIST[c.rating], H = c.rating >= 100, zf = c.zf, poleH = 11000, sp = 2500, yp = H ? [-sp / 2, sp / 2] : [0];
  c.extra.hpole = H; c.extra.poleH = poleH;
  yp.forEach((y, i) => add(c, 'pole', 'pole-' + (i + 1), 0, y, zf, [280, 280, poleH], { col: [{ t: 'cyl', r: 140, h: poleH, c: [0, 0, poleH / 2] }], opts: { r0: 140, r1: 90 } }));
  const zTx = H ? 4000 : 4500;
  if (H) add(c, 'platform', 'platform', 0, 0, zf + zTx - 150, [900, sp + 400, 150], { col: [{ t: 'box', s: [900, sp + 400, 150], c: [0, 0, 75] }] });
  else add(c, 'bracket', 'bracket', 330, 0, zf + zTx - 150, [700, 400, 150], { col: [{ t: 'box', s: [700, 400, 150], c: [0, 0, 75] }] });
  const tx = add(c, 'tx-dist', 'transformer', H ? 0 : 330 + 80, 0, zf + zTx, [T[0], T[1], T[2]], { yaw: 90, opts: { rating: c.rating, hv: T[5], pole: true } });
  tx.size = [T[0], T[1], T[2]]; tx.col = [{ t: 'box', s: [T[0], T[1], T[2]], c: [0, 0, T[2] / 2] }];
  const arm = H ? sp + 700 : 2000;
  add(c, 'crossarm', 'ht-crossarm', 0, 0, zf + 9400, [150, arm, 100], { col: [{ t: 'box', s: [150, arm, 100], c: [0, 0, 50] }], opts: { insulators: 3 } });
  add(c, 'do-fuse', 'ht-fuses', 0, 0, zf + 8200, [600, arm, 700], { ph: 700, col: phases(500, 150, 700, 700), opts: { pitch: 700 } });
  add(c, 'la-pole', 'ht-arresters', 220, 0, zf + 8200, [250, arm, 600], { col: phases(250, 150, 600, 700), opts: { pitch: 700 } });
  add(c, 'lt-box', 'lt-fuse-box', 200, H ? -sp / 2 : 0, zf + 1600, [250, 450, 600], { col: [{ t: 'box', s: [250, 450, 600], c: [0, 0, 300] }] });
  c.extra.stay = c.fac('stay');
  if (c.extra.stay) for (const sx of [-1]) add(c, 'stay', 'stay-wire', sx * 3600, 0, zf, [7200, 60, 8500], { col: [{ t: 'box', s: [100, 100, 100], c: [-3600, 0, 50] }], opts: { from: [0, 0, zf + 8500], to: [sx * 7200, 0, zf] } });
  if (c.fac('earth')) { add(c, 'earth-pit', 'earth-pit-1', 1000, 0, zf, [400, 400, 20], { col: [{ t: 'box', s: [400, 400, 20], c: [0, 0, 10] }] }); add(c, 'earth-pit', 'earth-pit-2', -1000, 0, zf, [400, 400, 20], { col: [{ t: 'box', s: [400, 400, 20], c: [0, 0, 10] }] }); }
  const fx = H ? 4200 : 3000, fy = H ? 3600 : 3000;
  if (c.fac('fence')) addFence(c, -fx, fx, -fy, fy, { gate: 'negy', gateU: fx });
  c.notes.push(...[]);
  const b = c.fac('fence') ? { x0: -fx - 300, x1: fx + 300, y0: -fy - 300, y1: fy + 300 } : { x0: -3500, x1: 3500, y0: -3500, y1: 3500 };
  c.extra.hvLine = { z: 9400 };
  return b;
}

// ============ FENCE + GATE ============
function addFence(c, x0, x1, y0, y1, o = {}) {
  const H = RULE.fenceH, t = 80, gw = o.gateW || (c.type === 'pole' ? 1800 : RULE.gateW), z = c.zf;
  c.extra.fence = { x0, x1, y0, y1, H, gw, gate: o.gate || 'negy', gateU: o.gateU ?? (x0 + x1) / 2 };
  // collision: four thin solid boxes; the gate gap is left empty on its side (the leaf is added in the visual layer / as its own item)
  const seg = (id, ax, a0, a1, fixed) => { if (a1 - a0 < 1) return; const cx = ax === 'x' ? (a0 + a1) / 2 : fixed, cy = ax === 'x' ? fixed : (a0 + a1) / 2; add(c, 'fence-run', id, cx, cy, z, [ax === 'x' ? a1 - a0 : t, ax === 'x' ? t : a1 - a0, H], { col: [{ t: 'box', s: [ax === 'x' ? a1 - a0 : t, ax === 'x' ? t : a1 - a0, H], c: [0, 0, H / 2] }], opts: { ax, len: a1 - a0 } }); };
  const g = c.extra.fence, gx0 = g.gateU - gw / 2, gx1 = g.gateU + gw / 2;
  if (g.gate === 'negy') { seg('fence-s1', 'x', x0, gx0, y0); seg('fence-s2', 'x', gx1, x1, y0); } else seg('fence-s', 'x', x0, x1, y0);
  seg('fence-n', 'x', x0, x1, y1); seg('fence-w', 'y', y0, y1, x0); seg('fence-e', 'y', y0, y1, x1);
  const open = clamp(+c.p.open || 0, 0, 100) / 100;
  if (g.gate === 'negy') add(c, 'gate', 'gate', g.gateU, y0, z, [gw, 100, H], { col: [{ t: 'box', s: [gw, 100, H], c: [-gw * open, 0, H / 2] }], opts: { open } });
}

// ============ KIOSK ============
function layoutKiosk(c) {
  const T = DIST[c.rating], zf = c.zf, t = 100, plinth = 600, mvw = 1400, ltw = 1000;
  const cx1 = mvw, cx2 = T[0] + 600, cx3 = ltw;            // compartment lengths: HT (RMU), transformer, LT
  const Lo = cx1 + cx2 + cx3 + 2 * 50 + 2 * t, Wo = Math.max(T[1] + 600, 1700) + 2 * t, Hi = Math.max(T[2] + 500, 2300);
  const x0 = -Lo / 2, x1 = Lo / 2, y0 = -Wo / 2, y1 = Wo / 2, zb = zf + plinth;
  c.extra.kiosk = { Lo, Wo, Hi, plinth, mvw, ltw, cx1, cx2, cx3 };
  const px1 = x0 + t + cx1, px2 = px1 + 50 + cx2;
  const holes = { negy: [door(cx1 / 2 + t - 450, 900), door(t + cx1 + 50 + (cx2 - 1400) / 2, 1400), door(t + cx1 + 50 + cx2 + 50 + (cx3 - 900) / 2, 900)], posy: [louvre(t + 200, cx1 - 400, 300, 900), louvre(t + cx1 + 50 + 200, cx2 - 400, 300, 900), louvre(t + cx1 + 50 + cx2 + 50 + 150, cx3 - 300, 300, 900)], negx: [louvre(Wo / 2 - 400, 800, 600, 700)], posx: [louvre(Wo / 2 - 400, 800, 600, 700)] };
  c.blds.push({ id: 'kiosk', x0, x1, y0, y1, t, zb, fl: 150, Hi, roofT: 100, holes, parts: [{ axis: 'x', pos: px1 + 0, from: y0 + t, to: y1 - t, t: 50, holes: [{ u0: 0, u1: 0, v0: 0, v1: 0 }].slice(1) }, { axis: 'x', pos: px2 + 25, from: y0 + t, to: y1 - t, t: 50, holes: [] }], kind: 'kiosk' });
  c.blds[0].parts[0].pos = x0 + t + cx1 + 25; c.blds[0].parts[1].pos = x0 + t + cx1 + 50 + cx2 + 25;
  // plinth (cable chamber) under the enclosure
  add(c, 'plinth', 'plinth', 0, 0, zf, [Lo + 200, Wo + 200, plinth], { col: [{ t: 'box', s: [Lo + 200, Wo + 200, plinth], c: [0, 0, plinth / 2] }] });
  const xc1 = x0 + t + cx1 / 2, xc2 = x0 + t + cx1 + 50 + cx2 / 2, xc3 = x0 + t + cx1 + 50 + cx2 + 50 + cx3 / 2;
  add(c, 'rmu', 'rmu', xc1, 0, zb, [1300, 800, 1600], { col: [{ t: 'box', s: [1300, 800, 1600], c: [0, 0, 800] }], opts: { ways: 3 } });
  add(c, 'tx-dist', 'transformer', xc2, 0, zb, [T[0], T[1], T[2]], { opts: { rating: c.rating, hv: T[5] }, col: [{ t: 'box', s: [T[0], T[1], T[2]], c: [0, 0, T[2] / 2] }] });
  add(c, 'lt-panel', 'lt-panel', xc3, 0, zb, [800, 600, 1900], { col: [{ t: 'box', s: [800, 600, 1900], c: [0, 0, 950] }], opts: { ways: 6 } });
  if (c.fac('earth')) for (const [i, [ex, ey]] of [[x0 - 600, y0 - 600], [x1 + 600, y1 + 600]].entries()) add(c, 'earth-pit', 'earth-pit-' + (i + 1), ex, ey, zf, [400, 400, 20], { col: [{ t: 'box', s: [400, 400, 20], c: [0, 0, 10] }] });
  const m = 1200;
  if (c.fac('fence')) { addFence(c, x0 - m, x1 + m, y0 - m - 1500, y1 + m, { gate: 'negy', gateU: x0 + Lo / 2, gateW: 3000 }); return { x0: x0 - m - 200, x1: x1 + m + 200, y0: y0 - m - 1700, y1: y1 + m + 200 }; }
  return { x0: x0 - 1500, x1: x1 + 1500, y0: y0 - 1500, y1: y1 + 1500 };
}

// ============ INDOOR 11/0.4 ============
function layoutIndoor(c) {
  const T = DIST[c.rating], zf = c.zf, t = RULE.wallT, R = RULE, deep = c.fac('trench') || c.fac('oilPit');
  const pitD = Math.max(300, up(T[4] / 1000 / (R.oilVoid * ((T[1] + 600) / 1000) * ((T[0] + 600) / 1000)) * 1000, 50));
  const fl = deep ? Math.max(R.floorDeep, c.fac('oilPit') ? up(pitD + 50, 50) : 0) : R.floor, zb = zf + fl;
  const mv = R.mvPanel[11], lt = R.ltPanel, tx = c.tx, extraOut = c.feeders;
  const nMv = (tx > 1 ? 2 : 1) + tx + extraOut + 1 + (tx > 1 ? 1 : 0), nLt = tx * (1 + Math.ceil(c.rating / 315) + (c.fac('capBank') ? 1 : 0)) + (tx > 1 ? 1 : 0), ltw = c.rating >= 1250 ? 1000 : lt[0];
  // rooms along X: HT | TX1 [TX2] | LT. All share the building depth (Y).
  const htL = nMv * mv[0] + 2 * R.wallClear, htD = mv[1] + R.panelFront + R.panelRear;
  const txL = T[1] + 2 * R.wallClear + 600, txD = T[0] + 2 * R.wallClear + 400;          // transformer length runs along Y in its room
  const ltL = nLt * ltw + 2 * R.wallClear, ltD = lt[1] + R.panelFront + R.panelRear;
  const Wi = Math.max(htD, txD, ltD), Hi = Math.max(3600, up(T[2] + 1300, 100), mv[2] + 1000);
  const rooms = [{ id: 'ht', L: htL }, ...Array.from({ length: tx }, (_, i) => ({ id: 'tx' + (i + 1), L: txL })), { id: 'lt', L: ltL }];
  const Li = rooms.reduce((a, r) => a + r.L, 0) + (rooms.length - 1) * t, x0 = -Li / 2 - t, x1 = Li / 2 + t, y0 = -Wi / 2 - t, y1 = Wi / 2 + t;
  let xs = x0 + t; const parts = [], holes = { negy: [], posy: [], negx: [], posx: [] }, floorHoles = [];
  c.extra.rooms = []; rooms.forEach((r, i) => { r.x0 = xs; r.x1 = xs + r.L; xs += r.L; c.extra.rooms.push(r); if (i < rooms.length - 1) { parts.push({ axis: 'x', pos: xs + t / 2, from: y0 + t, to: y1 - t, t, holes: c.fac('trench') ? [{ u0: Wi / 2 + t - 300 - 0 - (y0 + t) * 0 + 0 - 0, u1: Wi / 2 + t + 300, v0: -fl, v1: 0 }].map(h => ({ ...h, u0: Wi / 2 - 300, u1: Wi / 2 + 300, v0: 0, v1: 700 })) : [] }); xs += t; } });
  // doors and louvres (u from the outer corner x0 for the Y walls)
  for (const r of rooms) {
    const u = r.x0 - x0, w = r.L;
    if (r.id === 'ht') { holes.negy.push(door(u + 400, 1800, 2400)); holes.posy.push(louvre(u + w / 2 - 600, 1200, 2400, 700)); }
    else if (r.id === 'lt') { holes.negy.push(door(u + 400, 1000)); holes.posy.push(louvre(u + w / 2 - 600, 1200, 2400, 700)); }
    else { const dw = T[1] + 700; holes.negy.push(door(u + (w - dw) / 2, dw, Math.min(Hi - 400, T[2] + 500))); holes.posy.push(louvre(u + 300, w - 600, 400, 700)); holes.posy.push(louvre(u + 300, w - 600, Hi - 1200, 700)); }
  }
  const trench = c.fac('trench') ? { x0: x0 + t + 300, x1: x1 - t - 300, y0: y1 - t - 1100 - 0, y1: y1 - t - 500 } : null;
  if (trench) { floorHoles.push({ ...trench, x0: trench.x0, x1: trench.x1 }); c.extra.trench = trench; }
  const pits = [];
  for (const r of rooms) if (r.id.startsWith('tx') && c.fac('oilPit')) { const cx = (r.x0 + r.x1) / 2, dep = Math.max(300, up(T[4] / 1000 / (R.oilVoid * ((T[1] + 600) / 1000) * ((T[0] + 600) / 1000)) * 1000, 50)); pits.push({ x: cx, y: 0, L: T[1] + 600, W: T[0] + 600, depth: dep, oil: T[4] }); floorHoles.push({ x0: cx - (T[1] + 600) / 2, x1: cx + (T[1] + 600) / 2, y0: -(T[0] + 600) / 2, y1: (T[0] + 600) / 2 }); }
  c.extra.pits = pits; c.extra.fl = fl; if (pits.length && fl > R.floorDeep) c.notes.push(`Note: floor thickened to ${fl} mm to hold the ${pitD} mm soak pit.`);
  c.blds.push({ id: 'building', x0, x1, y0, y1, t, zb, fl, Hi, roofT: R.roofT, holes, parts, floorHoles, kind: 'indoor' });
  // equipment
  const yf = y0 + t + R.panelFront;       // front aisle of the panels is on the -Y side: panels stand against the +Y wall
  const ht = rooms[0];
  add(c, 'vcb-row', 'mv-panels', (ht.x0 + ht.x1) / 2, y1 - t - mv[1] / 2 - R.panelRear * 0.6, zb, [nMv * mv[0], mv[1], mv[2]], { col: [{ t: 'box', s: [nMv * mv[0], mv[1], mv[2]], c: [0, 0, mv[2] / 2] }], opts: { n: nMv, w: mv[0], kv: 11, bus: true } });
  for (const r of rooms.filter(q => q.id.startsWith('tx'))) {
    const cx = (r.x0 + r.x1) / 2; add(c, 'tx-dist', 'transformer-' + r.id, cx, 0, zb + (c.fac('oilPit') ? 0 : 0), [T[1], T[0], T[2]], { yaw: 90, opts: { rating: c.rating, hv: T[5], wheels: true }, col: [{ t: 'box', s: [T[0], T[1], T[2]], c: [0, 0, T[2] / 2] }] });
    if (c.fac('crane')) add(c, 'hoist', 'hoist-' + r.id, cx, 0, zb + Hi - 350, [200, T[0] + 800, 350], { col: [{ t: 'box', s: [100, T[0] + 800, 300], c: [0, 0, 175] }] });
  }
  const lr = rooms[rooms.length - 1];
  add(c, 'lt-row', 'lt-panels', (lr.x0 + lr.x1) / 2, y1 - t - lt[1] / 2 - R.panelRear * 0.6, zb, [nLt * ltw, lt[1], lt[2]], { col: [{ t: 'box', s: [nLt * ltw, lt[1], lt[2]], c: [0, 0, lt[2] / 2] }], opts: { n: nLt, w: ltw } });
  if (c.fac('capBank')) add(c, 'capbank-panel', 'capacitor-bank', lr.x0 + 700, y0 + t + 500, zb, [900, 700, 1900], { col: [{ t: 'box', s: [900, 700, 1900], c: [0, 0, 950] }], opts: { stages: 6 } });
  if (c.fac('earth')) add(c, 'earth-strip', 'earth-bar', 0, 0, zb + 300, [Li, Wi, 30], { col: [], opts: { x0: x0 + t, x1: x1 - t, y0: y0 + t, y1: y1 - t } });
  if (c.fac('flood')) add(c, 'lights', 'led-lights', 0, 0, zb + Hi - 80, [Li, Wi, 60], { col: [], opts: { x0: x0 + t + 800, x1: x1 - t - 800, rows: [-Wi / 4, Wi / 4], zStep: 2400 } });
  c.extra.Li = Li; c.extra.Wi = Wi; c.extra.Hi = Hi; c.extra.nMv = nMv; c.extra.nLt = nLt;
  if (c.fac('earth')) add(c, 'earth-pit', 'earth-pit-1', x0 - 600, y0 - 600, c.zf, [400, 400, 20], { col: [{ t: 'box', s: [400, 400, 20], c: [0, 0, 10] }] });
  const m = 1500;
  if (c.fac('fence')) { addFence(c, x0 - m, x1 + m, y0 - m - 1500, y1 + m, { gate: 'negy', gateU: 0 }); return { x0: x0 - m - 200, x1: x1 + m + 200, y0: y0 - m - 1700, y1: y1 + m + 200 }; }
  return { x0: x0 - 2000, x1: x1 + 2000, y0: y0 - 2500, y1: y1 + 1500 };
}

// ============ OUTDOOR YARD (AIS) and GIS ============
function layoutYard(c) {
  const Y = c.yard, T = POWER[c.rating], zf = c.zf, tx = c.tx, lines = c.lines, gis = c.type === 'gis', fw = c.fac('fireWall') && tx > 1;
  const slots = Math.max(lines, tx), gapReq = (fw || tx === 1) ? Y.gapFW : Y.gapNo;
  const pitch = Math.max(Y.bay, T[1] + gapReq), ySlot = i => (i - (slots - 1) / 2) * pitch;
  if (tx > 1 && !c.fac('fireWall')) c.notes.push(`Note: no fire wall, so the transformer gap is ${Y.gapNo / 1000} m (with fire wall ${Y.gapFW / 1000} m).`);
  c.extra.pitch = pitch; c.extra.slots = slots;
  // control building first (its size decides the plot)
  const MV = RULE.mvPanel[Y.mv], nMv = tx + c.feeders + (tx > 1 ? 1 : 0) + 1, nRelay = lines + tx + 2;
  const mvL = nMv * MV[0] + 2 * RULE.wallClear, mvD = MV[1] + RULE.panelFront + RULE.panelRear, ctlL = Math.max(6000, nRelay * 800 + 3200), batL = 4000, auxL = c.fac('aux') ? 4000 : 0;
  const bD = Math.max(mvD, 6000), bHi = Math.max(4200, MV[2] + 1200);
  c.extra.control = { mvL, ctlL, batL, auxL, nMv, nRelay, depth: bD };
  // ---- X stations ----
  let xg, xb, xTx0 = 0, xBld;
  if (!gis) {
    xg = 0; const seqL = [Y.dIC, Y.dIC * 2, Y.dIC * 3, Y.dIC * 4, Y.dIC * 5, Y.dIC * 5 + Y.dCI];   // LA, PT, line iso, CT, CB, bus iso
    c.extra.seqL = seqL; xb = xg + seqL[5] + Y.dBus;
    const sTx = [Y.dBus, Y.dBus + Y.dCI, Y.dBus + Y.dCI + Y.dIC, Y.dBus + Y.dCI + 2 * Y.dIC];  // bus iso, CB, CT, LA (from the bus)
    c.extra.seqT = sTx; xTx0 = xb + sTx[3] + 2000;
  } else { /* GIS: hall first, set below */ }
  const txX = i => xTx0 + T[0] / 2;
  const txL = T[0];
  // ---- GIS hall ----
  let hall = null, gxHall = 0;
  if (gis) {
    const [bw, bl, bh] = RULE.gis[c.kv], nb = lines + tx + 1, t = RULE.wallT, crane = c.fac('crane');
    const Xi = bl + 2 * 2500, Yi = nb * bw + 2 * 1500 + (nb - 1) * 200, Hi = bh + (crane ? 2600 : 1500);
    hall = { nb, bw, bl, bh, Xi, Yi, Hi, t };
    xg = -20000; const hx0 = 0, hx1 = Xi + 2 * t; gxHall = hx0;
    hall.x0 = hx0; hall.x1 = hx1; hall.y0 = -(Yi + 2 * t) / 2; hall.y1 = (Yi + 2 * t) / 2; c.extra.hall = hall;
    xTx0 = hx1 + 5000; c.extra.gisBay = [bw, bl, bh];
  }
  const txFront = xTx0, txBack = xTx0 + txL;
  xBld = txBack + 6000;
  const bx0 = xBld, bx1 = xBld + bD + 2 * RULE.wallT;
  const bLen = mvL + ctlL + batL + auxL + 3 * RULE.wallT * 1 + (auxL ? RULE.wallT : 0);     // building length along Y
  const by0 = -bLen / 2, by1 = bLen / 2;
  // ---- fence extents ----
  const m = Y.margin, xmin = gis ? -(c.lines ? 9000 : 3000) : xg - 2000, yHalf = Math.max(slots * pitch / 2 + m, bLen / 2 + 2000, hall ? hall.y1 + 3000 : 0) + (c.fac('capBank') ? 0 : 0);
  const capS = Y.mv === 11 ? [5000, 2500, 2600] : [8000, 4000, 4000];
  let yMax = yHalf; if (c.fac('capBank')) yMax += capS[1] + 2500;
  const fx0 = xmin, fx1 = bx1 + 3000, fy0 = -yHalf, fy1 = yMax;
  // ---- items ----
  const E = (kind, id, x, y, yaw) => addEquip(c, kind, id, x, y, yaw);
  if (!gis) {
    // gantries (shared columns between line bays), beam above the bays
    const nCol = lines + 1, gW = 700, Hg = Y.Hg, gy = k => (k - lines / 2) * pitch + (slots - lines) * 0 + (lines % 2 === slots % 2 ? 0 : 0);
    const lineY = i => ySlot(i + (slots - lines) / 2);
    for (let k = 0; k <= lines; k++) { const y = k === 0 ? lineY(0) - pitch / 2 : lineY(k - 1) + pitch / 2; add(c, 'gantry-col', 'gantry-col-' + (k + 1), xg, y, zf, [gW, gW, Hg + 600], { col: [{ t: 'box', s: [gW, gW, Hg + 600], c: [0, 0, (Hg + 600) / 2] }], opts: { h: Hg + 600, w: gW } }); }
    for (let i = 0; i < lines; i++) {
      const yc = lineY(i);
      add(c, 'gantry-beam', 'gantry-beam-' + (i + 1), xg, yc, zf + Hg, [500, pitch, 500], { col: [{ t: 'box', s: [500, pitch, 500], c: [0, 0, 250] }], opts: { span: pitch, strings: 3, pitch: Y.ph, line: true } });
      const sq = c.extra.seqL;
      E('la', `line${i + 1}-arrester`, xg + sq[0], yc); E('pt', `line${i + 1}-cvt`, xg + sq[1], yc); E('iso', `line${i + 1}-line-isolator`, xg + sq[2], yc);
      E('ct', `line${i + 1}-ct`, xg + sq[3], yc); E('cb', `line${i + 1}-breaker`, xg + sq[4], yc); E('iso', `line${i + 1}-bus-isolator`, xg + sq[5], yc);
    }
    // bus (tube along Y) over all slots
    const busLen = slots * pitch; add(c, 'busbar', 'main-bus', xb, 0, zf + Y.Hbus, [Y.busR * 2, busLen, Y.busR * 2], { col: [{ t: 'cyl', r: Y.busR, h: busLen, axis: 'y', c: [0, 0, 0] }, ...[-1, 0, 1].map(k => ({ t: 'box', s: [200, 200, 100], c: [0, 0, 0] })).slice(0, 0)], opts: { len: busLen, pitch: Y.ph, slots, busR: Y.busR, post: { h: Y.Hbus - Y.Ht + 0, spacing: pitch / 2 } } });
    for (let i = 0; i < tx; i++) {
      const yc = ySlot(i), sq = c.extra.seqT, yt = yc;
      E('iso', `tx${i + 1}-bus-isolator`, xb + sq[0], yc); E('cb', `tx${i + 1}-breaker`, xb + sq[1], yc); E('ct', `tx${i + 1}-ct`, xb + sq[2], yc); E('la', `tx${i + 1}-arrester`, xb + sq[3], yc);
    }
  } else {
    // GIS: line towers west of the hall, hall bays, wall bushings, ducts to the transformers
    const h = hall, t = h.t, yb = k => h.y0 + t + 1500 + h.bw / 2 + k * (h.bw + 200), zBay = zf + RULE.gT * 0 + 800;
    c.extra.hallZ = zf + 800;
    for (let i = 0; i < lines; i++) { const yc = yb(i); add(c, 'line-tower', `line${i + 1}-tower`, h.x0 - 7000, yc, zf, [700, 3200, Y.Hg], { col: [{ t: 'box', s: [600, 600, Y.Hg], c: [0, 0, Y.Hg / 2] }], opts: { h: Y.Hg, strings: 3, pitch: Y.ph / 3 } }); }
    c.extra.bayY = []; for (let k = 0; k < h.nb; k++) c.extra.bayY.push(yb(k));
  }
  // ---- transformers, pits, firewalls, NER ----
  const pits = [];
  for (let i = 0; i < tx; i++) {
    const yc = ySlot(i), xc = txFront + txL / 2;
    const t0 = add(c, 'tx-power', 'transformer-' + (i + 1), xc, yc, zf + 300, [T[0], T[1], T[2]], { opts: { rating: c.rating, kv: Y.hv, mv: Y.mv, plinth: 300 }, col: [{ t: 'box', s: [T[0], T[1], T[2]], c: [0, 0, T[2] / 2] }] });
    add(c, 'plinth', 'tx-plinth-' + (i + 1), xc, yc, zf, [T[0] + 600, T[1] + 600, 300], { col: [{ t: 'box', s: [T[0] + 600, T[1] + 600, 300], c: [0, 0, 150] }] });
    if (c.fac('oilPit')) { oilPit(c, 'oil-pit-' + (i + 1), xc, yc, T); }
    if (c.fac('ner')) add(c, 'ner', 'ner-' + (i + 1), xc + T[0] / 2 - 500, yc + T[1] / 2 + 1400, zf, [1200, 800, 1500], { col: [{ t: 'box', s: [1200, 800, 1500], c: [0, 0, 750] }] });
  }
  // HV jumpers: line bay (gantry string -> equipment height -> bus phase) and transformer bay (bus phase -> arrester -> bushing), LV cables down to the trench
  if (!gis) {
    const paths = [], zT = zf + Y.Ht, zH = zf + Y.Hbus, bp = Y.hv === 132 ? 1500 : 900, lineY = i => ySlot(i + (slots - lines) / 2), sq = c.extra.seqT;
    for (let i = 0; i < lines; i++) for (const k of [-1, 0, 1]) { const yk = lineY(i) + k * Y.ph; paths.push([[xg, yk, zf + Y.Hg - 2300], [xg, yk, zT], [xb + k * Y.ph, yk, zT], [xb + k * Y.ph, yk, zH]]); }
    for (let i = 0; i < tx; i++) {
      const yc = ySlot(i), zTop = zf + 300 + T[2], zJ = zTop + 500, xLA = xb + sq[3], xBush = txFront + 500, xLV = txFront + txL - 600, zLV = zf + 350 + 0.8 * T[2];
      for (const k of [-1, 0, 1]) { const yk = yc + k * Y.ph; paths.push([[xb + k * Y.ph, yk, zH], [xb + k * Y.ph, yk, zT], [xLA, yk, zT], [xLA, yk, zJ], [xBush, yc + k * bp, zJ], [xBush, yc + k * bp, zTop]]); }
      for (const k of [-1.5, -0.5, 0.5, 1.5]) paths.push([[xLV, yc + k * 650, zLV], [xLV, yc + k * 650, zLV + 400], [txBack + 800, yc + k * 650, zLV + 400], [txBack + 800, yc + k * 650, zf + 150]]);
    }
    add(c, 'bay-conn', 'hv-jumpers', 0, 0, zf, [1, 1, 1], { col: [], opts: { paths, r: Y.hv === 132 ? 40 : 28 } });
  }
  c.extra.txX = xTx0 + txL / 2; c.extra.txFront = txFront; c.extra.txBack = txBack;
  if (fw) for (let i = 0; i < tx - 1; i++) { const ym = (ySlot(i) + ySlot(i + 1)) / 2, hh = T[2] + RULE.fireWallOver, ww = T[0] + RULE.oilPitMargin * 2; add(c, 'fire-wall', 'fire-wall-' + (i + 1), txFront + txL / 2, ym, zf, [ww, RULE.fireWallT, hh], { col: [{ t: 'box', s: [ww, RULE.fireWallT, hh], c: [0, 0, hh / 2] }] }); }
  // ---- control building ----
  const t = RULE.wallT, zbB = zf + 200, holesB = { negx: [], posx: [], negy: [], posy: [] }, partsB = [];
  let u = t; const rm = [{ id: 'mv', L: mvL }, { id: 'control', L: ctlL }, { id: 'battery', L: batL }, ...(auxL ? [{ id: 'aux', L: auxL }] : [])];
  rm.forEach((r, i) => { r.y0 = by0 + u; r.y1 = r.y0 + r.L; u += r.L; if (i < rm.length - 1) { partsB.push({ axis: 'y', pos: by0 + u + t / 2, from: bx0 + t, to: bx1 - t, t, holes: [] }); u += t; } });
  c.extra.bRooms = rm;
  for (const r of rm) { const uc = (r.y0 - by0) + (r.id === 'mv' ? 700 : r.L / 2 - 500); holesB.negx.push(door((r.y0 - by0) + (r.id === 'mv' ? 500 : r.L / 2 - 600), r.id === 'mv' ? 1800 : 1000, r.id === 'mv' ? 2400 : 2100)); }
  holesB.posx.push(louvre((rm[0].y0 - by0) + rm[0].L / 2 - 600, 1200, 2600, 800)); holesB.posx.push(louvre((rm[2].y0 - by0) + rm[2].L / 2 - 500, 1000, 2600, 600));
  const trenchB = c.fac('trench') ? { x0: bx0 + t + RULE.panelFront - 600, x1: bx0 + t + RULE.panelFront + 200, y0: by0 + t + 400, y1: by0 + t + mvL - 400 } : null;
  c.blds.push({ id: 'control-building', x0: bx0, x1: bx1, y0: by0, y1: by1, t, zb: zbB, fl: 200, Hi: bHi, roofT: RULE.roofT, holes: holesB, parts: partsB, floorHoles: trenchB ? [trenchB] : [], kind: 'control' });
  c.extra.bld = { x0: bx0, x1: bx1, y0: by0, y1: by1, zb: zbB, Hi: bHi };
  // equipment in the building
  const mvR = rm[0], mvY = (mvR.y0 + mvR.y1) / 2, xRowMv = bx1 - t - RULE.panelRear - MV[1] / 2;
  add(c, 'vcb-row', 'mv-switchgear', xRowMv, mvY, zbB, [MV[1], nMv * MV[0], MV[2]], { yaw: 0, col: [{ t: 'box', s: [MV[1], nMv * MV[0], MV[2]], c: [0, 0, MV[2] / 2] }], opts: { n: nMv, w: MV[0], kv: Y.mv, along: 'y', depth: MV[1], bus: true } });
  const cr = rm[1], cry = (cr.y0 + cr.y1) / 2;
  add(c, 'relay-row', 'control-relay-panels', xRowMv, cry, zbB, [800, nRelay * 800, 2200], { col: [{ t: 'box', s: [800, nRelay * 800, 2200], c: [0, 0, 1100] }], opts: { n: nRelay, w: 800, along: 'y' } });
  add(c, 'desk', 'operator-desk', bx0 + t + 1500, cry, zbB, [900, 2400, 760], { col: [{ t: 'box', s: [900, 2400, 760], c: [0, 0, 380] }] });
  const br = rm[2], bry = (br.y0 + br.y1) / 2;
  add(c, 'battery-bank', 'battery-bank', bx1 - t - 700, bry, zbB, [800, 2600, 1400], { col: [{ t: 'box', s: [800, 2600, 1400], c: [0, 0, 700] }], opts: { cells: 2 } });
  add(c, 'charger', 'dc-chargers', bx0 + t + 500, bry - 1000, zbB, [800, 1600, 2000], { col: [{ t: 'box', s: [800, 1600, 2000], c: [0, 0, 1000] }] });
  if (auxL) { const ar = rm[3], ay = (ar.y0 + ar.y1) / 2; add(c, 'lt-row', 'ac-distribution', bx1 - t - 600, ay, zbB, [600, 3000, 2200], { col: [{ t: 'box', s: [600, 3000, 2200], c: [0, 0, 1100] }], opts: { n: 4, w: 750, along: 'y' } }); }
  // ---- trench from the transformers to the building and the cross trench in front of it ----
  const road = { x0: bx0 - 2500 - RULE.roadW, x1: bx0 - 2500, y0: fy0, y1: by1 };
  if (c.extra.pits && c.extra.pits.some(q => q.depth > 1500)) c.notes.push('Warning: the oil soak pit is deeper than 1500 mm. Use a bigger pit plan or an oil sump with a separator.');
  c.extra.road = road; add(c, 'road', 'access-road', (road.x0 + road.x1) / 2, (road.y0 + road.y1) / 2, zf, [road.x1 - road.x0, road.y1 - road.y0, 30], { col: [] });
  if (c.fac('trench')) { for (let i = 0; i < tx; i++) add(c, 'trench-run', 'cable-trench-' + (i + 1), (txBack + bx0) / 2, ySlot(i), zf, [bx0 - txBack, 600, 150], { col: [{ t: 'box', s: [bx0 - txBack, 600, 150], c: [0, 0, 75] }], opts: { len: bx0 - txBack } }); }
  // ---- cap bank, aux transformer ----
  if (c.fac('capBank')) add(c, 'capbank-yard', 'capacitor-bank', (txFront + txBack) / 2, fy1 - 1500 - capS[1] / 2, zf, capS, { col: [{ t: 'box', s: capS, c: [0, 0, capS[2] / 2] }], opts: { kv: Y.mv } });
  // ---- masts, flood poles, earthing, fence ----
  if (c.fac('mast')) for (const sy of [-1, 1]) add(c, 'mast', 'lightning-mast-' + (sy < 0 ? 1 : 2), gis ? txFront - 4000 : xb, sy * (slots * pitch / 2 + 500), zf, [500, 500, Y.mast], { col: [{ t: 'cyl', r: 250, h: Y.mast, c: [0, 0, Y.mast / 2] }], opts: { h: Y.mast } });
  if (c.fac('flood')) for (const [sx, sy] of [[fx0 + 1500, fy0 + 1500], [fx0 + 1500, fy1 - 1500], [fx1 - 1500, fy0 + 1500], [fx1 - 1500, fy1 - 1500]]) add(c, 'flood-pole', 'flood-pole', sx, sy, zf, [300, 300, RULE.flood], { col: [{ t: 'cyl', r: 150, h: RULE.flood, c: [0, 0, RULE.flood / 2] }], opts: { h: RULE.flood } });
  if (c.fac('earth')) { add(c, 'earth-grid', 'earth-grid', (fx0 + fx1) / 2, (fy0 + fy1) / 2, zf, [fx1 - fx0 - 1000, fy1 - fy0 - 1000, 20], { col: [], opts: { x0: fx0 + 500, x1: fx1 - 500, y0: fy0 + 500, y1: fy1 - 500, step: 6000 } }); for (const [i, [px, py]] of [[fx0 + 700, fy0 + 700], [fx0 + 700, fy1 - 700], [fx1 - 700, fy0 + 700], [fx1 - 700, fy1 - 700]].entries()) add(c, 'earth-pit', 'earth-pit-' + (i + 1), px, py, zf, [400, 400, 20], { col: [{ t: 'box', s: [400, 400, 20], c: [0, 0, 10] }] }); }
  if (c.fac('fence')) addFence(c, fx0, fx1, fy0, fy1, { gate: 'negy', gateU: road.x0 + RULE.roadW / 2 });
  c.extra.plot = { fx0, fx1, fy0, fy1 };
  // ---- GIS hall as a building + bays ----
  if (gis) {
    const h = hall, t2 = h.t, zbH = zf + 800, holes = { negx: [], posx: [], negy: [], posy: [door(h.Xi / 2 + t2 - 900, 1800, 2600)] };
    c.extra.bayY.forEach((y, k) => { const u = y - h.y0 - 1500 * 0; if (k < lines) holes.negx.push({ kind: 'bushing', u0: u - 900, u1: u + 900, v0: 1400, v1: 2800 }); else if (k < lines + tx) holes.posx.push({ kind: 'bushing', u0: u - 900, u1: u + 900, v0: 1400, v1: 2800 }); });
    c.blds.push({ id: 'gis-hall', x0: h.x0, x1: h.x1, y0: h.y0, y1: h.y1, t: t2, zb: zbH, fl: 800, Hi: h.Hi, roofT: RULE.roofT, holes, parts: [], floorHoles: [], kind: 'gis' });
    const bxc = (h.x0 + h.x1) / 2, cr = c.fac('crane');
    c.extra.bayY.forEach((y, k) => { const role = k < lines ? 'line' : k < lines + tx ? 'transformer' : 'bus-pt'; add(c, 'gis-bay', `gis-bay-${k + 1}-${role}`, bxc, y, zbH, [h.bl, h.bw, h.bh], { col: [{ t: 'box', s: [h.bl, h.bw, h.bh], c: [0, 0, h.bh / 2] }], opts: { role, kv: Y.hv, w: h.bw } }); });
    c.extra.bayY.forEach((y, k) => { if (k < lines + tx) { const left = k < lines; add(c, 'wall-bushings', `bushings-${k + 1}`, left ? h.x0 : h.x1, y, zbH + 1400, [1400, 900, 1400], { yaw: left ? 180 : 0, col: [], opts: { pitch: Math.min(900, Y.ph / 2 + 300) } }); } });
    c.extra.bayY.forEach((y, k) => { if (k >= lines && k < lines + tx) { const i = k - lines, yt = ySlot(i), xa = h.x1 + 1400, xt = txFront; add(c, 'duct', `sf6-duct-${i + 1}`, xa, y, zbH + 2100, [xt - xa, 1, 1], { col: [], opts: { pts: [[xa, y, zbH + 2100], [xa + 1500, y, zbH + 2100], [xa + 1500, yt, zbH + 2100], [xt + 600, yt, zbH + 2100]], r: Y.hv === 33 ? 300 : 400 } }); } });
    if (cr) add(c, 'crane', 'overhead-crane', bxc, (h.y0 + h.y1) / 2, zbH + h.Hi - 700, [h.Xi - 200, h.Yi - 200, 700], { col: [{ t: 'box', s: [h.Xi - 300, 600, 500], c: [0, 0, 350] }], opts: { span: h.Xi - 200, len: h.Yi - 200 } });
  }
  c.extra.hv = Y.hv; c.extra.mvKv = Y.mv; c.extra.T = T;
  // notes / info
  c.extra.gapReq = gapReq; c.extra.sect = Y.sect;
  return { x0: fx0 - (c.fac('fence') ? 200 : 500), x1: fx1 + 300, y0: fy0 - 400, y1: fy1 + 300 };
}

// ---- details ----
export function describe(p) {
  const P = plan(p), e = P.extra, out = [`Type: ${TYPES[P.type]}, ${P.kv} kV`];
  const dist = P.type === 'pole' || P.type === 'kiosk' || P.type === 'indoor', T = dist ? DIST[P.rating] : POWER[P.rating];
  out.push(`Transformer: ${P.tx} x ${P.rating >= 1000 ? r1(P.rating / 1000) + ' ' + (dist ? 'MVA' : 'MVA') : P.rating + ' kVA'}, ${T[0]} x ${T[1]} x ${T[2]} mm, about ${T[3]} kg, oil about ${T[4]} L (generic envelope)`.replace(dist && P.rating >= 1000 ? / MVA/ : /^$/, dist && P.rating >= 1000 ? ' MVA' : ''));
  if (P.type === 'pole') out.push(`${e.hpole ? 'H-pole (2 poles, platform)' : 'Single pole with bracket'}, pole ${e.poleH / 1000} m; HT fuses, arresters, LT fuse box${e.stay ? ', stay wire' : ''}`);
  if (P.type === 'kiosk') out.push(`Enclosure ${e.kiosk.Lo} x ${e.kiosk.Wo} x ${e.kiosk.Hi} mm on a ${e.kiosk.plinth} mm plinth: RMU (3 ways), transformer, LT panel`);
  if (P.type === 'indoor') out.push(`Building ${e.Li} x ${e.Wi} x ${e.Hi} mm inside: HT room (${e.nMv} panels), ${P.tx} transformer room(s), LT room (${e.nLt} panels)`);
  if (P.type === 'ais' || P.type === 'gis') {
    const Y = P.yard;
    out.push(`Yard: ${Y.hv} kV, phase spacing ${Y.ph} mm, bay ${e.pitch} mm, terminal height ${Y.Ht} mm, bus ${Y.Hbus} mm, line gantry ${Y.Hg} mm, ${P.lines} line bay(s), ${P.tx} transformer bay(s)`);
    out.push(`Clearances used: phase-phase ${Y.phPh} mm, phase-earth ${Y.phE} mm, sectional ${Y.sect} mm, fence margin ${Y.margin} mm; transformer gap ${e.gapReq / 1000} m`);
    out.push(`Control building: MV switch room ${e.control.nMv} x ${RULE.mvPanel[Y.mv][0]} mm panels, control room ${e.control.nRelay} relay panels, battery room${e.control.auxL ? ', AC / aux room' : ''}`);
    if (e.hall) out.push(`GIS hall ${e.hall.Xi} x ${e.hall.Yi} x ${e.hall.Hi} mm inside, ${e.hall.nb} bays of ${e.hall.bw} mm`);
    out.push(`Plot ${Math.round(P.Lo / 1000)} x ${Math.round(P.Wo / 1000)} m`);
  }
  if (e.pits && e.pits.length) out.push(`Oil soak pit: ${e.pits[0].L} x ${e.pits[0].W} mm, ${e.pits[0].depth} mm deep (gravel void 40 %, 100 % of the oil)`);
  return [...out, ...P.notes];
}
export function validate(p) { plan(p); }

// ---- collision shapes + ports ----
export function generate(p) {
  const P = plan(p), shapes = [], R = v => Math.round(v * 100) / 100;
  let n = 0;
  const wallColor = { grey: 0xb4b8bc, cream: 0xe0d4b4, white: 0xe8e8e4 }[p.wallColor] ?? 0xb4b8bc;
  const gp = P.plot; shapes.push({ id: 'ground-plate', role: 'solid', type: 'box', size: [R(P.Lo), R(P.Wo), P.gT], at: [R((gp.x0 + gp.x1) / 2), R((gp.y0 + gp.y1) / 2), P.gT / 2], tags: ['concrete'], color: 0x8f918b });
  for (const b of P.blds) for (const s of shell(b)) shapes.push({ id: `${b.id}-${s.kind}-${++n}`, role: 'solid', type: 'box', size: s.s.map(R), at: s.c.map(R), tags: [s.kind === 'floor' || s.kind === 'roof' ? 'concrete' : 'masonry'], ...(s.kind === 'wall' || s.kind === 'part' ? { color: wallColor } : {}) });
  for (const it of P.items) for (const cl of it.col || []) {
    const yaw = (it.yaw || 0) * Math.PI / 180, cs = Math.cos(yaw), sn = Math.sin(yaw), lx = cl.c[0], ly = cl.c[1];
    const at = [R(it.at[0] + lx * cs - ly * sn), R(it.at[1] + lx * sn + ly * cs), R(it.at[2] + cl.c[2])];
    const base = { id: `${it.id}-${++n}`, role: 'solid', at, tags: ['steel'], rot: [0, 0, R(it.yaw || 0)] };
    if (cl.t === 'cyl') shapes.push({ ...base, type: 'cylinder', radius: R(cl.r), length: R(cl.h), axis: cl.axis || 'z' }); else shapes.push({ ...base, type: 'box', size: cl.s.map(R) });
  }
  const zr = P.top;
  const ports = [{ id: 'B', at: [0, 0, 0], dir: [0, 0, -1], type: 'face-v' }, { id: 'L', at: [R(P.plot.x0), 0, 0], dir: [-1, 0, 0], type: 'face-h' }, { id: 'R', at: [R(P.plot.x1), 0, 0], dir: [1, 0, 0], type: 'face-h' }];
  return { shapes, ports, info: describe(p) };
}
