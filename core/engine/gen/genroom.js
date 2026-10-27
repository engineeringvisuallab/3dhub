// Generator room (diesel generator set room) generator.
// One component = a complete, ready-to-build DG room: floor slab, walls with real openings, roof slab, one or two DG sets on plinths,
// day fuel tank with bund, exhaust line (bellows, silencer, pipe, sleeve, stack), cooling-air louvres, equipment and personnel doors,
// control panel, battery rack, cable trench, monorail hoist, fire kit, lights, extraction fan, acoustic lining.
// plan(p) is the single source of truth: gen/genroom.js (collision shapes, ports, details) and visual/genroom.js (real mesh) both read it.
// Engine space: X = room length (radiator end = -X, alternator end and doors = +X), Y = room width (+Y = service side), Z = up.
// Origin = bottom centre of the outer footprint (under the floor slab). Ports: B (bottom), T (roof top) = face-v; L / R (ends) = face-h.
// All sizes below are generic envelopes (indicative), not a maker's catalogue. Confirm with the DG set maker and local rules.

// kVA -> [length, width, height of the set on its skid (mm), exhaust pipe DN (mm), mass (kg)]
export const SETS = {
  62.5: [2300, 900, 1450, 75, 1100], 100: [2600, 1000, 1600, 100, 1500], 125: [2800, 1050, 1650, 100, 1800], 160: [3000, 1100, 1750, 125, 2200],
  250: [3400, 1250, 1900, 150, 3000], 320: [3700, 1300, 2000, 150, 3600], 400: [4000, 1400, 2100, 200, 4200], 500: [4300, 1550, 2200, 200, 4900],
  625: [4600, 1700, 2300, 250, 5800], 750: [5000, 1800, 2400, 250, 6800], 1000: [5500, 2000, 2500, 300, 8800]
};
export const TANKS = [100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];   // standard day tank sizes (litres)
export const SWL = [1, 2, 3, 5, 10, 15];                                             // hoist safe working loads (tonnes)
export const WALL = { grey: 0xb4b8bc, cream: 0xe0d4b4, white: 0xe8e8e4 };
export const SETCOL = { blue: 0x2f5fa8, green: 0x2f7d4f, yellow: 0xd9a81e, grey: 0x7d858c, red: 0xb83a2c };

// Rules (indicative, all in one place)
export const RULE = {
  floorPlain: 200, floorTrench: 500, trenchDepth: 300, trenchW: 400, roofT: 150, plinth: 150,
  sideClear: 1200,          // set to wall, and set to set
  radClear: 1500,           // radiator end: minimum distance from the radiator to the wall
  altClear: 1800, altBattery: 900, // alternator end: minimum distance (panel, door, service), plus the battery rack
  airPerKva: 0.025,         // m3/s of cooling + combustion air per kVA
  inletVelocity: 4,         // m/s through the free area of the inlet louvre
  louvreFree: 0.5,          // free area ratio of a louvre
  dischargeVelocity: 8,     // m/s through the free area of the discharge louvre
  fuelPerKva: 0.15,         // L/h per kVA at 75 % load (about 0.25 L per kWh)
  bundMargin: 200, bundWall: 100, bundFactor: 1.1,
  stackPerSqrtKva: 200,     // mm of stack above the roof per sqrt(kVA)  (guideline 0.2 * sqrt(kVA) m: check the local rule)
  minHeight: 3600
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const up = (v, s) => Math.ceil(v / s - 1e-9) * s;
const r1 = v => Math.round(v * 10) / 10;
const on = v => +v === 1;

// ---- 2D helper: a rectangle [0,W]x[0,H] minus holes -> list of rectangles {u0,u1,v0,v1} (walls with real openings, floor with trench) ----
export function rectMinus(W, H, holes) {
  const xs = new Set([0, W]); for (const h of holes) { xs.add(clamp(h.u0, 0, W)); xs.add(clamp(h.u1, 0, W)); }
  const X = [...xs].sort((a, b) => a - b), cells = [];
  for (let i = 0; i + 1 < X.length; i++) {
    const a = X[i], b = X[i + 1]; if (b - a < 1e-6) continue;
    const cov = holes.filter(h => h.u0 <= a + 1e-6 && h.u1 >= b - 1e-6).map(h => [clamp(h.v0, 0, H), clamp(h.v1, 0, H)]).sort((p, q) => p[0] - q[0]);
    let c = 0; const iv = [];
    for (const [lo, hi] of cov) { if (lo > c + 1e-6) iv.push([c, lo]); c = Math.max(c, hi); }
    if (c < H - 1e-6) iv.push([c, H]);
    for (const [v0, v1] of iv) cells.push({ u0: a, u1: b, v0, v1 });
  }
  cells.sort((p, q) => p.v0 - q.v0 || p.v1 - q.v1 || p.u0 - q.u0);   // merge neighbours in u that share the same v range
  const out = [];
  for (const c of cells) { const l = out[out.length - 1]; if (l && l.v0 === c.v0 && l.v1 === c.v1 && Math.abs(l.u1 - c.u0) < 1e-6) l.u1 = c.u1; else out.push({ ...c }); }
  return out;
}

// ---- the plan: every size and position, plus the rule notes ----
export function plan(p) {
  const S = SETS[p.kva]; if (!S) throw new Error(`Unknown DG set size "${p.kva}" kVA.`);
  const [Ls, Ws, Hs, D, kg] = S, n = +p.sets === 2 ? 2 : 1, t = +p.t, ph = RULE.plinth, notes = [];
  const trench = on(p.trench), tankOn = on(p.dayTank), battery = on(p.battery), panel = on(p.panel);
  const fl = trench ? RULE.floorTrench : RULE.floorPlain, rt = RULE.roofT, zf = fl;
  // air
  const Q = RULE.airPerKva * p.kva;                                             // m3/s per set
  const Aw = n * Q * 1e6 / (RULE.inletVelocity * RULE.louvreFree) / 2;           // gross inlet louvre area per long wall (mm2)
  // fuel
  const lph = RULE.fuelPerKva * p.kva, vNeed = lph * n * +p.tankHours;
  const V = TANKS.find(v => v >= vNeed) ?? TANKS[TANKS.length - 1];
  if (tankOn && vNeed > TANKS[TANKS.length - 1]) notes.push(`Warning: ${Math.round(vNeed)} L of fuel is needed for ${p.tankHours} h. The largest day tank here is ${TANKS[TANKS.length - 1]} L: add a bulk tank outside.`);
  const sq = up(Math.cbrt(V * 1e6 / 2), 50);                                     // tank shape: length about twice the width and height
  const tank = { V, Ht: sq, Wt: sq }; tank.Lt = up(V * 1e6 / (sq * sq), 50);
  const m = RULE.bundMargin, bw = RULE.bundWall;
  tank.bx = tank.Lt + 2 * m; tank.by = tank.Wt + 2 * m;
  tank.hB = Math.max(150, up(RULE.bundFactor * V * 1e6 / ((tank.bx - 2 * bw) * (tank.by - 2 * bw)), 50));   // bund keeps 110 % of the tank
  tank.leg = tank.hB + 150;
  // minimum sizes
  const cS = RULE.sideClear, cR = Math.max(RULE.radClear, tankOn ? tank.bx + 450 : 0), cA = RULE.altClear + (battery ? RULE.altBattery : 0);
  const u0 = tankOn ? tank.bx + 450 : 600;                                       // inlet louvres start after the tank
  const wReq = Math.max(600, up(Aw / 1500, 100));                                // louvre about 1500 mm high
  const Lmin = Math.max(cR + Ls + cA, u0 + 1500 + wReq);
  const Wmin = n === 2 ? 2 * Ws + 3 * cS : Ws + 2 * cS;
  const legUp = Math.max(300, 1.5 * D);                                          // straight pipe above the silencer before the elbow
  const Hmin = Math.max(RULE.minHeight, up(ph + Hs + 400 + 5 * D + legUp + 1.5 * D + 300, 100));
  const pick = (want, min, what) => { want = +want; if (want > 0 && want < min - 1e-6) notes.push(`Note: room ${what} raised from ${want} to ${min} mm (smallest that fits this set, its clearances and its air).`); return Math.max(want, min); };
  const Li = pick(p.L, Lmin, 'length'), Wi = pick(p.W, Wmin, 'width'), Hi = pick(p.H, Hmin, 'height');
  const Lo = Li + 2 * t, Wo = Wi + 2 * t, zc = zf + Hi, zr = zc + rt;
  // sets
  const extraL = Li - Lmin, g = n === 2 ? (Wi - 2 * Ws) / 3 : cS;
  const xs0 = -Li / 2 + cR + extraL / 2, xs1 = xs0 + Ls;
  const sets = []; for (let k = 0; k < n; k++) sets.push({ k, ya: n === 1 ? 0 : (k === 0 ? 1 : -1) * (Ws / 2 + g / 2), x0: xs0, x1: xs1, zBase: zf + ph, zTop: zf + ph + Hs });
  // exhaust
  const stackGuide = up(RULE.stackPerSqrtKva * Math.sqrt(p.kva), 100), stackAbove = +p.stack > 0 ? +p.stack : stackGuide;
  if (+p.stack > 0 && +p.stack < stackGuide) notes.push(`Warning: stack ${p.stack} mm above the roof is below the guideline ${stackGuide} mm (0.2 x sqrt(kVA) m). Check the local rule.`);
  const sil = { L: 5 * D, Dia: Math.round(2.4 * D) };
  const roofExit = p.exhaust === 'roof';
  for (const s of sets) {
    s.xEx = xs0 + 0.45 * Ls; s.dir = s.ya >= 0 ? 1 : -1;
    s.zBell = s.zTop + 400; s.zSil0 = s.zBell; s.zSil1 = s.zBell + sil.L; s.zH = s.zSil1 + legUp;
    s.yOut = s.dir * (Wo / 2 + D / 2 + 150);
  }
  const zStackTop = zr + stackAbove;
  // louvres (inlet, both long walls)
  const wL = clamp(wReq, 600, Li - 1500 - u0), hL = up(Aw / wL, 50), sill = 500;
  if (sill + hL > Hi - 400) notes.push('Warning: the inlet louvre does not fit the wall height. Increase the room length.');
  const louvre = { u0, u1: u0 + wL, v0: sill, v1: sill + hL, w: wL, h: hL, free: wL * hL * RULE.louvreFree / 1e6 };
  // discharge opening (radiator end) per set
  const dw = Ws, dh = Math.min(Hi - 300 - (ph + 100), up(Math.max(0.8 * Hs, Q * 1e6 / (RULE.dischargeVelocity * RULE.louvreFree) / dw), 50));
  const disc = { w: dw, v0: ph + 100, v1: ph + 100 + dh, h: dh, vel: Q / (dw * dh * RULE.louvreFree / 1e6) };
  if (disc.vel > RULE.dischargeVelocity + 0.01) notes.push(`Warning: discharge air speed ${r1(disc.vel)} m/s is above ${RULE.dischargeVelocity} m/s.`);
  // doors
  const Weq = Ws + 600, Heq = Math.min(Hi - 300, up(ph + Hs + 300, 100)), pd = { w: 1000, h: 2100, u0: Li - 1200 };
  // facilities (positions in room coordinates)
  const fac = {};
  fac.tank = tankOn ? { ...tank, x0: -Li / 2 + 150, y1: Wi / 2 - 150, y0: Wi / 2 - 150 - tank.by } : null;
  fac.panel = panel ? { x0: xs1 + 300, w: 1000, d: 500, h: 1800, base: 100, y1: Wi / 2 } : null;
  fac.battery = battery ? { x0: xs1 + 1400, w: 900, d: 450, h: 800, y1: Wi / 2 } : null;
  fac.trench = trench ? { xc: xs1 + 800, w: RULE.trenchW, depth: RULE.trenchDepth, yA: Wi / 2 - 250, yB: Math.min(...sets.map(s => s.ya)) } : null;
  fac.hoist = on(p.hoist) ? { y: n === 1 ? sets[0].ya : 0, x0: -Li / 2 + 400, x1: Li / 2 - 400, zTop: zc - 50, depth: 250, xHook: (xs0 + xs1) / 2 } : null;
  // hoist capacity: heaviest lift = engine or alternator, about half the set mass
  const swl = SWL.find(v => v * 1000 >= 0.5 * kg) ?? SWL[SWL.length - 1];
  // openings per wall: u along the wall, v = height above the floor top
  const walls = { negx: { axis: 'x', side: -1, W: Wo, holes: [] }, posx: { axis: 'x', side: 1, W: Wo, holes: [] }, negy: { axis: 'y', side: -1, W: Li, holes: [] }, posy: { axis: 'y', side: 1, W: Li, holes: [] } };
  const hole = (w, h) => walls[w].holes.push(h);
  for (const s of sets) {
    hole('negx', { kind: 'discharge', set: s.k, u0: s.ya + Wo / 2 - dw / 2, u1: s.ya + Wo / 2 + dw / 2, v0: disc.v0, v1: disc.v1 });
    hole('posx', { kind: 'equipment-door', set: s.k, u0: s.ya + Wo / 2 - Weq / 2, u1: s.ya + Wo / 2 + Weq / 2, v0: 0, v1: Heq });
    if (!roofExit) { const sl = D + 200, wl = s.dir > 0 ? 'posy' : 'negy'; hole(wl, { kind: 'exhaust-sleeve', set: s.k, u0: s.xEx + Li / 2 - sl / 2, u1: s.xEx + Li / 2 + sl / 2, v0: s.zH - zf - sl / 2, v1: s.zH - zf + sl / 2 }); }
  }
  if (on(p.vent)) hole('negx', { kind: 'fan', u0: -(Wi / 2 - 500) + Wo / 2 - 350, u1: -(Wi / 2 - 500) + Wo / 2 + 350, v0: Hi - 1050, v1: Hi - 350 });
  hole('negy', { kind: 'personnel-door', u0: pd.u0, u1: pd.u0 + pd.w, v0: 0, v1: pd.h });
  for (const w of ['negy', 'posy']) hole(w, { kind: 'inlet-louvre', u0: louvre.u0, u1: louvre.u1, v0: louvre.v0, v1: louvre.v1 });
  if (tankOn) { const xc = fac.tank.x0 + tank.bx / 2, zp = tank.leg + tank.Ht + 300; fac.fill = { x: xc, z: zp }; hole('posy', { kind: 'fuel-sleeve', u0: xc + Li / 2 - 100, u1: xc + Li / 2 + 100, v0: zp - 100, v1: zp + 100 }); }
  const roofHoles = roofExit ? sets.map(s => { const sl = D + 200; return { kind: 'exhaust-sleeve', set: s.k, u0: s.xEx + Lo / 2 - sl / 2, u1: s.xEx + Lo / 2 + sl / 2, v0: s.ya + Wo / 2 - sl / 2, v1: s.ya + Wo / 2 + sl / 2 }; }) : [];
  // notes
  if (on(p.hoist) && 0.5 * kg > SWL[SWL.length - 1] * 1000) notes.push('Warning: the heaviest lift is above the largest hoist offered here (15 t).');
  return { n, t, fl, zf, rt, zc, zr, Li, Wi, Hi, Lo, Wo, Lmin, Wmin, Hmin, S: { L: Ls, W: Ws, H: Hs, D, kg }, ph, sets, Q, Aw, lph, tank, fac, sil, stackAbove, stackGuide, zStackTop, roofExit, louvre, disc,
    Weq, Heq, pd, walls, roofHoles, swl, g, cR, cA, notes, trenchOn: trench, tankOn };
}

export function describe(p) {
  const P = plan(p), tag = want => (+want > 0 ? '' : ' (automatic)');
  const out = [
    `DG set${P.n === 2 ? 's: 2 x' : ':'} ${p.kva} kVA (${r1(p.kva * 0.8)} kW), each ${P.S.L} x ${P.S.W} x ${P.S.H} mm, about ${P.S.kg} kg (generic envelope)`,
    `Room inside ${P.Li} x ${P.Wi} x ${P.Hi} mm; walls ${P.t} mm; floor ${P.fl} mm${P.trenchOn ? ' with cable trench' : ''}; roof ${P.rt} mm`,
    `Smallest room for this set: ${P.Lmin} x ${P.Wmin} x ${P.Hmin} mm (length${tag(p.L)}, width${tag(p.W)}, height${tag(p.H)})`,
    `Air: ${r1(P.Q * P.n)} m3/s. Inlet louvre on each long wall ${P.louvre.w} x ${P.louvre.h} mm (free area ${r1(P.louvre.free)} m2 each, ${RULE.inletVelocity} m/s). Discharge opening ${P.disc.w} x ${P.disc.h} mm per set, ${r1(P.disc.vel)} m/s`,
    `Exhaust: DN${P.S.D}, silencer ${P.sil.Dia} x ${P.sil.L} mm, ${P.roofExit ? 'through the roof' : 'through the wall, then up the outside'}; stack ${P.stackAbove} mm above the roof (guideline ${P.stackGuide} mm)`,
    `Fuel: about ${Math.round(P.lph)} L/h per set at 75 % load${P.tankOn ? `. Day tank ${P.tank.V} L (${p.tankHours} h), ${P.tank.Lt} x ${P.tank.Wt} x ${P.tank.Ht} mm, bund ${P.tank.hB} mm high (110 % of the tank)` : '. No day tank'}`,
    `Doors: equipment door ${P.Weq} x ${P.Heq} mm per set (${p.doorType === 'shutter' ? 'rolling shutter' : 'double leaf'}), personnel door ${P.pd.w} x ${P.pd.h} mm`,
    ...(P.fac.hoist ? [`Monorail hoist: ${P.swl} t (half the set mass)`] : []),
    ...P.notes];
  return out;
}
export function validate(p) { plan(p); }

// ---- collision shapes + ports ----
export function generate(p) {
  const P = plan(p), shapes = [], R = v => Math.round(v * 100) / 100;
  const wallCol = WALL[p.wallColor] ?? WALL.grey;
  let n = 0;
  const box = (id, role, tags, size, at, extra = {}) => shapes.push({ id: id + '-' + (++n), role, type: 'box', size: size.map(R), at: at.map(R), tags, ...extra });
  const cyl = (id, role, tags, radius, length, axis, at, extra = {}) => shapes.push({ id: id + '-' + (++n), role, type: 'cylinder', radius: R(radius), length: R(length), axis, at: at.map(R), tags, ...extra });
  const { Li, Wi, Lo, Wo, t, zf, zc, zr, Hi } = P;
  box('floor', 'solid', ['concrete'], [Lo, Wo, P.fl], [0, 0, P.fl / 2]);
  for (const [name, w] of Object.entries(P.walls)) for (const r of rectMinus(w.W, Hi, w.holes)) {
    const uc = (r.u0 + r.u1) / 2, zz = zf + (r.v0 + r.v1) / 2, sz = r.v1 - r.v0;
    if (w.axis === 'x') box('wall-' + name, 'solid', ['masonry'], [t, r.u1 - r.u0, sz], [w.side * (Li / 2 + t / 2), -Wo / 2 + uc, zz], { color: wallCol });
    else box('wall-' + name, 'solid', ['masonry'], [r.u1 - r.u0, t, sz], [-Li / 2 + uc, w.side * (Wi / 2 + t / 2), zz], { color: wallCol });
  }
  for (const r of rectMinus(Lo, Wo, P.roofHoles)) box('roof', 'solid', ['concrete'], [r.u1 - r.u0, r.v1 - r.v0, P.rt], [-Lo / 2 + (r.u0 + r.u1) / 2, -Wo / 2 + (r.v0 + r.v1) / 2, zc + P.rt / 2]);
  // doors (closed or open by the Open parameter, 0-100 %)
  const open = clamp(+p.open || 0, 0, 100) / 100, ang = 110 * open;
  for (const s of P.sets) {
    const yc = s.ya, xo = Li / 2 + t - 25;
    if (p.doorType === 'shutter') {
      const hc = Math.max(100, P.Heq * (1 - open));
      box('shutter', 'solid', ['steel'], [40, P.Weq, hc], [xo - 5, yc, zf + P.Heq - hc / 2], { color: 0x9aa3ab });
      box('shutter-hood', 'solid', ['steel'], [300, P.Weq + 200, 300], [Li / 2 + t + 120, yc, zf + P.Heq + 150], { color: 0x6b747c });
    } else {
      const wl = (P.Weq - 20) / 2;
      for (const sd of [1, -1]) {
        const hy = yc + sd * (P.Weq / 2 - 10);
        const th = ang * Math.PI / 180, c = [xo + (wl / 2) * Math.sin(th), hy - sd * (wl / 2) * Math.cos(th), zf + (P.Heq - 20) / 2 + 10];   // leaf swings outward (+X) around its hinge
        box('equipment-door', 'solid', ['steel'], [50, wl, P.Heq - 20], c, { rot: [0, 0, R(sd * ang)], color: 0x5e6a74 });
      }
      box('door-swing', 'clearance', [], [P.Weq / 2 + 300, P.Weq, 100], [Lo / 2 + (P.Weq / 2 + 300) / 2, yc, zf + 50], { opacity: 0.12 });
    }
  }
  { const hx = Li / 2 - 205, wl = P.pd.w - 10, a = ang * Math.PI / 180, yo = -Wi / 2 - t + 25;
    box('personnel-door', 'solid', ['steel'], [wl, 50, P.pd.h - 20], [hx - (wl / 2) * Math.cos(a), yo - (wl / 2) * Math.sin(a), zf + (P.pd.h - 20) / 2 + 10], { rot: [0, 0, R(ang)], color: 0x5e6a74 }); }
  // louvres: one thin block in each opening (blades are in the visual mesh)
  for (const [name, w] of Object.entries(P.walls)) for (const h of w.holes) if (h.kind === 'inlet-louvre' || h.kind === 'discharge') {
    const uc = (h.u0 + h.u1) / 2, zz = zf + (h.v0 + h.v1) / 2;
    if (w.axis === 'x') box('louvre-' + name, 'solid', ['steel'], [30, h.u1 - h.u0, h.v1 - h.v0], [w.side * (Li / 2 + t / 2), -Wo / 2 + uc, zz], { color: 0x8a949c });
    else box('louvre-' + name, 'solid', ['steel'], [h.u1 - h.u0, 30, h.v1 - h.v0], [-Li / 2 + uc, w.side * (Wi / 2 + t / 2), zz], { color: 0x8a949c });
  }
  // DG sets on plinths
  const sc = SETCOL[p.setColor] ?? SETCOL.blue;
  for (const s of P.sets) {
    const L = P.S.L, W = P.S.W, H = P.S.H, xc = (s.x0 + s.x1) / 2;
    box('plinth', 'solid', ['concrete'], [L + 400, W + 400, P.ph], [xc, s.ya, zf + P.ph / 2]);
    box('dg-set', 'solid', ['steel'], [L, W, H], [xc, s.ya, zf + P.ph + H / 2], { color: sc });
    box('set-service', 'clearance', [], [L, 500, 100], [xc, s.ya + s.dir * (W / 2 + 350), zf + 50], { opacity: 0.1 });
    // exhaust line (collision envelope: straight pieces)
    const D = P.S.D, rr = D / 2 + 50, zH = s.zH;
    cyl('exhaust-riser', 'solid', ['steel'], rr, zH - s.zTop, 'z', [s.xEx, s.ya, (zH + s.zTop) / 2], { color: 0x3a3f45 });
    cyl('silencer', 'solid', ['steel'], P.sil.Dia / 2, P.sil.L, 'z', [s.xEx, s.ya, (s.zSil0 + s.zSil1) / 2], { color: 0x4a4f55 });
    if (P.roofExit) cyl('exhaust-stack', 'solid', ['steel'], rr, P.zStackTop - zH, 'z', [s.xEx, s.ya, (P.zStackTop + zH) / 2], { color: 0x3a3f45 });
    else {
      const y0 = s.ya, y1 = s.yOut;
      cyl('exhaust-run', 'solid', ['steel'], rr, Math.abs(y1 - y0), 'y', [s.xEx, (y0 + y1) / 2, zH], { color: 0x3a3f45 });
      cyl('exhaust-stack', 'solid', ['steel'], rr, P.zStackTop - zH, 'z', [s.xEx, y1, (P.zStackTop + zH) / 2], { color: 0x3a3f45 });
    }
  }
  const T = P.fac.tank;
  if (T) {
    const cx = T.x0 + T.bx / 2, cy = T.y1 - T.by / 2, bw = RULE.bundWall;
    box('day-tank', 'solid', ['steel'], [T.Lt, T.Wt, T.Ht], [cx, cy, zf + T.leg + T.Ht / 2], { color: 0xc8892a });
    box('bund-x', 'solid', ['concrete'], [T.bx, bw, T.hB], [cx, cy - T.by / 2 + bw / 2, zf + T.hB / 2]); box('bund-x', 'solid', ['concrete'], [T.bx, bw, T.hB], [cx, cy + T.by / 2 - bw / 2, zf + T.hB / 2]);
    box('bund-y', 'solid', ['concrete'], [bw, T.by - 2 * bw, T.hB], [cx - T.bx / 2 + bw / 2, cy, zf + T.hB / 2]); box('bund-y', 'solid', ['concrete'], [bw, T.by - 2 * bw, T.hB], [cx + T.bx / 2 - bw / 2, cy, zf + T.hB / 2]);
  }
  const PN = P.fac.panel;
  if (PN) { box('control-panel', 'solid', ['steel'], [PN.w, PN.d, PN.h], [PN.x0 + PN.w / 2, PN.y1 - PN.d / 2, zf + PN.h / 2 + PN.base], { color: 0x8c9399 });
    box('panel-front', 'clearance', [], [PN.w, 1000, 100], [PN.x0 + PN.w / 2, PN.y1 - PN.d - 500, zf + 50], { opacity: 0.1 }); }
  const B = P.fac.battery;
  if (B) box('battery-rack', 'solid', ['steel'], [B.w, B.d, B.h], [B.x0 + B.w / 2, B.y1 - B.d / 2, zf + B.h / 2], { color: 0x4d5760 });
  const Hh = P.fac.hoist;
  if (Hh) box('hoist-beam', 'solid', ['steel'], [Hh.x1 - Hh.x0, 100, Hh.depth], [(Hh.x0 + Hh.x1) / 2, Hh.y, Hh.zTop - Hh.depth / 2], { color: 0xd8a21c });
  if (on(p.fire)) for (const dy of [0, 260]) cyl('extinguisher', 'solid', ['steel'], 90, 600, 'z', [Li / 2 - 130, Wi / 2 - 300 - dy, zf + 600], { color: 0xc0392b });
  // ports
  const ports = [
    { id: 'B', at: [0, 0, 0], dir: [0, 0, -1], type: 'face-v' }, { id: 'T', at: [0, 0, R(zr)], dir: [0, 0, 1], type: 'face-v' },
    { id: 'L', at: [R(-Lo / 2), 0, 0], dir: [-1, 0, 0], type: 'face-h' }, { id: 'R', at: [R(Lo / 2), 0, 0], dir: [1, 0, 0], type: 'face-h' }];
  return { shapes, ports, info: describe(p) };
}
