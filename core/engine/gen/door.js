// Door generator. Turns the door options (design, finish, leaves, glass, handle ...) into engine shapes + ports.
// Geometry rules are ported from models/building/door/parametric/door.html (same sizes, same layouts).
// Engine space: X = along the wall line, Y = through the wall (outside = -Y), Z = up. Origin = bottom centre of the whole unit.
// The page uses X = width, Y = up, Z = depth (outside = +Z). Helpers below convert page coordinates to engine coordinates.
// Limits (see docs/STUDIO.md): only boxes and cylinders (no bevels, no textures, no wood grain); a knob is a short cylinder.
import { rotEuler, mulRR, eulerFromR } from '../math3.js';

const D2R = 180 / Math.PI;
const r3 = v => Math.round(v * 1000) / 1000;

export const DESIGNS = {
  p4: ['wood', '4 panel'], p6: ['wood', '6 panel'], p2: ['wood', '2 panel'], shaker: ['wood', 'Shaker (flat panels)'], glass: ['wood', 'Half glass'],
  louvre: ['wood', 'Louvred'], groove: ['wood', 'Modern grooved flush'], flush: ['wood', 'Flush'], zbrace: ['wood', 'Ledged and braced (Z)'],
  stpanel: ['steel', 'Pressed 4 panel'], stflush: ['steel', 'Flush sheet steel'], stfire: ['steel', 'Fire-rated look with vision panel'], stgrill: ['steel', 'Security grill'],
  alfull: ['alu', 'Full glass'], almid: ['alu', 'Glass + lower panel'],
  pvcrib: ['pvc', 'Ribbed flush'], pvcpanel: ['pvc', '2 panel']
};
export const TYPES = {
  wood: { name: 'Wooden door', fin: ['teak', 'mahogany', 'oak', 'walnut'], T: [32, 38, 45, 50], t0: 1, frame: [75, 100] },
  steel: { name: 'Steel door', fin: ['grey', 'white', 'brown', 'black', 'green'], T: [45, 50], t0: 0, frame: [60, 100] },
  alu: { name: 'Aluminium and glass door', fin: ['silver', 'black', 'bronze', 'white'], T: [45, 50], t0: 0, frame: [50, 90] },
  pvc: { name: 'PVC / WPC door', fin: ['white', 'ivory', 'grey', 'oak'], T: [30, 35], t0: 0, frame: [60, 100] }
};
const WOOD = { teak: 0xa87b4f, mahogany: 0x8c4a2f, oak: 0xc49e66, walnut: 0x6a4930 };
const COLOR = {
  steel: { grey: 0x7d858c, white: 0xe8e8e6, brown: 0x5c3a21, black: 0x222428, green: 0x2f5d3f },
  alu: { silver: 0xc5c9cd, black: 0x25272a, bronze: 0x5a4632, white: 0xeeeeee },
  pvc: { white: 0xf3f3f1, ivory: 0xe9dfc4, grey: 0xb8bcc0, oak: WOOD.oak }
};
const HW = { brass: 0xb89a5a, steel: 0xcdd1d6, black: 0x1d1d1d };
// glass: [colour, opacity]. The page uses textures for frost/reeded/pebble/wired/stained; here they are plain tinted colours.
export const GLASS = { clear: [0xaed6e6, .28], frost: [0xeef2f4, .75], grey: [0x555b60, .5], bronze: [0x8a6a45, .45], blue: [0x5b9bc4, .45], lowe: [0xbfe0d0, .32],
  reeded: [0xcfe3ea, .5], pebble: [0xcfe0e6, .55], wired: [0xbfd5dd, .5], stained: [0xc9a15a, .6], mirror: [0xd5dde2, 1] };
// leaf layouts: c = columns, r = row kinds (R raised panel, S shaker panel, G glass, F flat, L louvre), w = row weights, sw/rh/bh = stile/rail/bottom-rail widths
const FD = { p2: { c: 1, r: 'RR' }, p4: { c: 2, r: 'RR' }, p6: { c: 2, r: 'RRR' }, shaker: { c: 2, r: 'SS' }, glass: { c: 2, r: 'RG', w: [1, 2], bars: 1 }, louvre: { c: 1, r: 'LL' },
  stpanel: { c: 2, r: 'RR' }, pvcpanel: { c: 1, r: 'SS' }, alfull: { c: 1, r: 'G', sw: 100, rh: 100, bh: 130 }, almid: { c: 1, r: 'FG', w: [1, 2.4], sw: 100, rh: 100, bh: 130 } };
const GAP = 5, YB = 15, SIDE = 400, FAN = 400;

// ---- sizes shared by validate / generate / describe ----
export function dims(p) {
  const dz = DESIGNS[p.design]; if (!dz) throw new Error(`Unknown door design "${p.design}".`);
  const type = dz[0], T = TYPES[type], dbl = +p.leaves === 2, Wd = +p.W, Hd = +p.doorH;
  // Soft rules (warnings in the Details list, not errors): width and leaf count are edited one at a time, so a hard rule would block switching single <-> double.
  const notes = [];
  if (!dbl && Wd > 1200) notes.push('Warning: a single leaf wider than 1200 mm is not practical. Set Leaves to Double.');
  if (dbl && Wd < 1000) notes.push('Warning: a double door narrower than 1000 mm is not practical. Set Leaves to Single or increase the width.');
  const Wl = dbl ? (Wd - 4) / 2 : Wd;
  const mT = type === 'wood' ? (Wl <= 900 ? 32 : Wl <= 1050 ? 38 : 45) : 0;
  const want = +p.thickness || T.T[T.t0];
  const ok = T.T.filter(v => v >= Math.max(want, mT));
  const t = T.T.includes(want) && want >= mT ? want : ok.length ? ok[0] : T.T[T.T.length - 1];
  const [ff, fd] = T.frame, nS = +p.sideGlass, fan = +p.fanlight ? FAN : 0;
  const eL = nS === 2 ? SIDE + ff : 0, eR = nS >= 1 ? SIDE + ff : 0, iw = Wd + 2 * GAP, hj = YB + Hd + GAP + ff, hjT = hj + (fan ? fan + ff : 0);
  const Wtot = iw + 2 * ff + eL + eR, wallH = +p.H, wallT = +p.t;
  if (wallH < hjT) throw new Error(`Wall height H must be at least ${Math.ceil(hjT)} mm for this door (frame top). Lower the door height or remove the fanlight.`);
  const finish = T.fin.includes(p.finish) ? p.finish : T.fin[0];
  return { notes, type, T, dbl, Wd, Hd, Wl, t, mT, ff, fd, nS, fan, eL, eR, iw, hj, hjT, Wtot, wallH, wallT, finish, hinges: (Hd > 2200 || Wl > 1000) ? 4 : 3 };
}
export const validate = p => { dims(p); };
export function describe(p) {
  const d = dims(p), dn = DESIGNS[p.design][1];
  return [`${d.T.name}: ${dn}, ${d.dbl ? 'double' : 'single'} leaf, finish ${d.finish}`,
    `Leaf ${d.Wl} x ${d.Hd} x ${d.t} mm (thickness used: ${d.t} mm${+p.thickness ? '' : ', automatic'})`,
    `Frame ${d.ff} x ${d.fd} mm, clear opening ${d.iw} x ${d.Hd + 2 * GAP} mm`,
    `Overall width ${d.Wtot} mm, frame top ${d.hjT} mm, wall height ${d.wallH} mm`,
    `${d.hinges} hinges per leaf, glass ${p.glass} (${p.glassType})`, ...d.notes];
}

export function generate(p) {
  const d = dims(p), { type, dbl, Wd, Hd, Wl, t, ff, fd, nS, fan, eL, eR, iw, hj, hjT, Wtot, wallH, wallT } = d;
  const hs0 = p.hingeSide === 'R' ? 1 : -1, sw = p.swing === 'in' ? -1 : 1, theta = +p.openAngle;
  const xs = -(eR - eL) / 2;                                   // centre the whole unit on the origin
  const leafCol = type === 'wood' ? WOOD[d.finish] : COLOR[type][d.finish];
  const dark = Math.floor(((leafCol >> 16) & 255) * .7) << 16 | Math.floor(((leafCol >> 8) & 255) * .7) << 8 | Math.floor((leafCol & 255) * .7);
  const hw = HW[p.hardware] ?? HW.steel, DK = 0x111111, DKW = 0x2a1a10, RED = 0xc0392b;
  const [gc, go] = GLASS[p.glass] || GLASS.clear, tagT = type === 'wood' ? 'wood' : type === 'pvc' ? 'plastic' : 'steel';
  const shapes = []; let n = 0;
  const push = s => { shapes.push({ id: s.id + '-' + (++n), role: s.role || 'solid', ...s.def, tags: s.tags, ...(s.color !== undefined ? { color: s.color } : {}), ...(s.opacity !== undefined ? { opacity: s.opacity } : {}) }); };
  // frame / wall pieces: page coords (w=x size, h=up size, d=depth size; x, y=up, z=depth)
  const fbox = (id, tags, color, w, h, dd, x, y, z, extra = {}) => push({ id, tags, color, ...extra, def: { type: 'box', size: [r3(w), r3(dd), r3(h)], at: [r3(x + xs), r3(-z), r3(y)] } });
  const fglass = (id, w, h, dd, x, y) => fbox(id, ['glass'], gc, w, h, dd, x, y, 0, { opacity: go });
  // ---- frame ----
  const stopZ = -sw * (t / 2 + 7.5);
  for (const s of [-1, 1]) {
    fbox('jamb', ['frame', tagT], leafCol, ff, hjT, fd, s * (iw / 2 + ff / 2), hjT / 2, 0);
    fbox('stop', ['frame', tagT], dark, 18, hj - ff, 15, s * (iw / 2 - 9), (hj - ff) / 2, stopZ);
  }
  fbox('head', ['frame', tagT], leafCol, iw + 2 * ff + eL + eR, ff, fd, (eR - eL) / 2, hj - ff / 2, 0);
  fbox('stop-top', ['frame', tagT], dark, iw, 18, 15, 0, hj - ff - 9, stopZ);
  if (fan) { fbox('fan-head', ['frame', tagT], leafCol, iw + 2 * ff + eL + eR, ff, fd, (eR - eL) / 2, hjT - ff / 2, 0); fglass('fan-glass', iw, fan, 6, 0, hj + fan / 2); }
  const side = s => {
    const xc = s * (iw / 2 + ff + SIDE / 2), tp = hj - ff - 20;
    fbox('side-jamb', ['frame', tagT], leafCol, ff, hjT, fd, s * (iw / 2 + ff + SIDE + ff / 2), hjT / 2, 0);
    fbox('side-panel', ['frame', tagT], leafCol, SIDE, 300, fd - 30, xc, 150, 0);
    fbox('side-rail', ['frame', tagT], leafCol, SIDE, 20, fd - 30, xc, 310, 0);
    fglass('side-glass', SIDE, tp - 320, 6, xc, 320 + (tp - 320) / 2);
    if (fan) fglass('side-fan-glass', SIDE, fan, 6, xc, hj + fan / 2);
  };
  if (eR) side(1); if (eL) side(-1);
  if (wallH - hjT >= 1) fbox('head-wall', ['masonry'], undefined, Wtot, wallH - hjT, wallT, (eR - eL) / 2, hjT + (wallH - hjT) / 2, 0);

  // ---- leaves ----
  const leaf = (hs, tag) => {
    const hingeX = hs * (Wd / 2 + 2.5), xo = -hs * (Wl / 2 + 2.5), fe = xo - hs * Wl / 2;
    const phi = hs * sw * theta, Rz = rotEuler([0, 0, phi]);
    const part = (id, tags, color, def, extra = {}) => {                    // def in leaf-local page coords; converted + swung about the hinge
      const [lx, ly, lz] = def.at, c = Math.cos(phi / D2R), s = Math.sin(phi / D2R), ex = lx, ey = -lz;
      const wx = hingeX + xs + ex * c - ey * s, wy = ex * s + ey * c;
      const rot = eulerFromR(mulRR(Rz, rotEuler(def.rot || [0, 0, 0]))).map(v => r3(v + 0));
      const out = def.type === 'box' ? { type: 'box', size: [r3(def.size[0]), r3(def.size[2]), r3(def.size[1])] }
        : { type: 'cylinder', radius: r3(def.radius), length: r3(def.length), axis: { x: 'x', y: 'z', z: 'y' }[def.axis] };
      push({ id: id + tag, tags, color, ...extra, def: { ...out, at: [r3(wx), r3(wy), r3(ly + YB)], rot } });
    };
    const lw = (w, h, dd, x, y, z, rot, col = leafCol) => part('leaf', ['leaf', tagT], col, { type: 'box', size: [w, h, dd], at: [x, y, z], rot });
    const hb = (w, h, dd, x, y, z, col = hw) => part('hw', ['hardware', 'steel'], col, { type: 'box', size: [w, h, dd], at: [x, y, z] });
    const hc = (r, len, axis, x, y, z) => part('hw', ['hardware', 'steel'], hw, { type: 'cylinder', radius: r, length: len, axis, at: [x, y, z] });
    const lg = (w, h, dd, x, y, z) => part('glass', ['glass'], gc, { type: 'box', size: [w, h, dd], at: [x, y, z] }, { opacity: go });
    const ol = (w, h, x, y, col) => { for (const s of [-1, 1]) { const z = s * (t / 2 + 1); lw(w, 6, 2, x, y + h / 2, z, undefined, col); lw(w, 6, 2, x, y - h / 2, z, undefined, col); lw(6, h, 2, x - w / 2, y, z, undefined, col); lw(6, h, 2, x + w / 2, y, z, undefined, col); } };
    const cell = (k, px, py, pw, ph, f) => {
      if (k === 'R') { lw(pw + 30, ph + 30, 14, px, py, 0); for (const s of [-1, 1]) lw((pw - 24) * .89, (ph - 24) * .89, 9, px, py, s * 11.5); }
      else if (k === 'F') lw(pw + 20, ph + 20, t - 10, px, py, 0);
      else if (k === 'S' || k === 'G') {
        if (k === 'S') lw(pw + 30, ph + 30, 12, px, py, 0); else lg(pw + 16, ph + 16, 6, px, py, 0);
        for (const s of [-1, 1]) { const z = s * (k === 'S' ? 10 : t / 2 - 5);
          lw(pw, 18, 9, px, py + ph / 2 - 9, z); lw(pw, 18, 9, px, py - ph / 2 + 9, z); lw(18, ph - 36, 9, px - pw / 2 + 9, py, z); lw(18, ph - 36, 9, px + pw / 2 - 9, py, z); }
        if (k === 'G' && f.bars) { const nv = pw > 500 ? 2 : pw > 260 ? 1 : 0, nh = Math.max(0, Math.round(ph / 350) - 1);
          for (let i = 1; i <= nv; i++) lw(16, ph, 16, px - pw / 2 + i * pw / (nv + 1), py, 0);
          for (let i = 1; i <= nh; i++) lw(pw, 16, 16, px, py - ph / 2 + i * ph / (nh + 1), 0); }
      } else if (k === 'L') { const m = Math.floor(ph / 48); for (let i = 0; i < m; i++) lw(pw + 20, 5, t - 8, px, py - ph / 2 + (i + .5) * ph / m, 0, [34.4, 0, 0]); }
    };
    const framed = f => {
      const sw_ = f.sw || 110, rh = f.rh || 110, y0 = f.bh || 210, mw = 100, cols = f.c, rw = f.r.length, wt = f.w || Array(rw).fill(1);
      const iW = Wl - 2 * sw_, span = Hd - rh - y0, ch = (span - (rw - 1) * rh) / wt.reduce((a, b) => a + b), pw = (iW - (cols - 1) * mw) / cols;
      for (const s of [-1, 1]) lw(sw_, Hd, t, xo + s * (Wl / 2 - sw_ / 2), Hd / 2, 0);
      lw(iW, rh, t, xo, Hd - rh / 2, 0); lw(iW, y0, t, xo, y0 / 2, 0);
      let y = y0;
      for (let r = 0; r < rw; r++) {
        const ph = ch * wt[r], py = y + ph / 2;
        for (let c = 1; c < cols; c++) lw(mw, ph, t, xo - iW / 2 + c * pw + (c - .5) * mw, py, 0);
        for (let c = 0; c < cols; c++) cell(f.r[r], xo - iW / 2 + pw / 2 + c * (pw + mw), py, pw, ph, f);
        y += ph; if (r < rw - 1) { lw(iW, rh, t, xo, y + rh / 2, 0); y += rh; }
      }
    };
    const de = p.design;
    if (FD[de]) framed(FD[de]);
    else if (de === 'zbrace') {
      const m = Math.round(Wl / 140), pw = Wl / m;
      for (let i = 0; i < m; i++) lw(pw - 3, Hd, t * .7, xo - Wl / 2 + pw * (i + .5), Hd / 2, 0);
      for (const y of [160, Hd / 2, Hd - 160]) lw(Wl - 30, 140, t * .3, xo, y, t * .5);
      const dx = hs * (Wl - 200), dy = Hd - 320;
      lw(Math.hypot(dx, dy), 120, t * .3, xo, Hd / 2, t * .5, [0, -Math.atan2(dy, dx) * D2R, 0]);
    } else if (de === 'stgrill') {
      lw(60, Hd, t, xo - Wl / 2 + 30, Hd / 2, 0); lw(60, Hd, t, xo + Wl / 2 - 30, Hd / 2, 0);
      for (const y of [Hd - 30, 1000]) lw(Wl, 60, t, xo, y, 0);
      lw(Wl, 350, t, xo, 175, 0);
      const m = Math.floor((Wl - 120) / 110);
      for (let i = 1; i <= m; i++) part('leaf', ['leaf', tagT], leafCol, { type: 'cylinder', radius: 8, length: Hd - 410, axis: 'y', at: [xo - Wl / 2 + 60 + i * (Wl - 120) / (m + 1), (Hd + 290) / 2, 0] });
    } else {
      if (de === 'stfire') { lw(Wl, 1150, t, xo, 575, 0); lw(Wl, Hd - 1750, t, xo, (1750 + Hd) / 2, 0); for (const s of [-1, 1]) lw((Wl - 300) / 2, 600, t, xo + s * (Wl / 2 - (Wl - 300) / 4), 1450, 0); }
      else lw(Wl, Hd, t, xo, Hd / 2, 0);
      if (de === 'groove') for (let x = -Wl / 2 + 110; x < Wl / 2 - 50; x += 110) for (const s of [-1, 1]) lw(3, Hd - 240, 1, xo + x, Hd / 2, s * (t / 2 + .3), undefined, DKW);
      if (de === 'stflush') { ol(Wl - 200, Hd * .35, xo, Hd * .27, dark); ol(Wl - 200, Hd * .35, xo, Hd * .73, dark); }
      if (de === 'stfire') {
        lg(300, 600, t + 6, xo, 1450, 0); ol(320, 620, xo, 1450, dark);
        for (const s of [-1, 1]) hb(Wl - 40, 250, 3, xo, 125, s * (t / 2 + 1.5), leafCol);
        hb(220, 55, 50, xo + hs * (Wl / 2 - 150), Hd - 70, t / 2 + 28, DK); hb(220, 10, 10, xo + hs * (Wl / 2 - 260), Hd - 70, t / 2 + 58, DK); hb(140, 70, 2, xo, Hd - 300, t / 2 + 1.5, RED);
      }
      if (de === 'pvcrib') for (let y = 100; y < Hd - 100; y += 70) for (const s of [-1, 1]) lw(Wl - 30, 12, 3, xo, y, s * (t / 2 + 1), undefined, dark);
    }
    // hinges
    const hy = []; for (let i = 0; i < d.hinges; i++) hy.push(i ? (i === d.hinges - 1 ? Hd - 150 : 200 + i * (Hd - 350) / (d.hinges - 1)) : 200);
    hy.forEach(y => { hc(6, 100, 'y', 0, y, 0); hb(2, 100, 64, -hs * 1.5, y, 0); });
    // handle set
    const Y = 985, hx = fe + hs * 70, lever = !/^al/.test(de) && ['lever', 'digital'].includes(p.handle);
    if (lever) {
      hb(3, 170, 20, fe + hs * 1.5, Y, 0); hb(14, 22, 12, fe - hs * 7, Y + 25, 0);
      if (p.handle === 'digital') { hb(70, 230, 26, hx, Y + 170, t / 2 + 13, DK); for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) hb(14, 14, 3, hx - 20 + i * 20, Y + 105 + j * 22, t / 2 + 27); }
      for (const s of [-1, 1]) { hc(26, 6, 'z', hx, Y, s * (t / 2 + 3)); hc(8, 20, 'z', hx, Y, s * (t / 2 + 16)); hb(120, 16, 14, hx + hs * 50, Y, s * (t / 2 + 26)); hb(26, 85, 3, hx, Y - 80, s * (t / 2 + 1.5)); hb(5, 18, 1, hx, Y - 72, s * (t / 2 + 3.2), DK); }
    } else if (p.handle === 'knob' && !/^al/.test(de)) {
      hb(3, 170, 20, fe + hs * 1.5, Y, 0);
      for (const s of [-1, 1]) { hc(22, 6, 'z', hx, Y, s * (t / 2 + 3)); hc(9, 22, 'z', hx, Y, s * (t / 2 + 14)); hc(32, 40, 'z', hx, Y, s * (t / 2 + 42)); }
    } else for (const s of [-1, 1]) { const hp = fe + hs * 60; hc(13, 600, 'y', hp, Y, s * (t / 2 + 42)); for (const dy of [-250, 250]) hc(8, 42, 'z', hp, Y + dy, s * (t / 2 + 20)); }
    return { hs, xo, hingeX, part, hb, hc };
  };
  const L = dbl ? [leaf(-1, 'L'), leaf(1, 'R')] : [leaf(hs0, '')];
  // extras (first leaf, page positions)
  { const l = L[0], cxl = l.xo, hs = l.hs;
    if (+p.peephole) { l.hc(7, t + 6, 'z', cxl, 1500, 0); l.hc(11, 3, 'z', cxl, 1500, t / 2 + 3); }
    if (+p.closer) { l.hb(220, 55, 50, cxl + hs * (Wl / 2 - 150), Hd - 70, t / 2 + 28, DK); l.hb(220, 10, 10, cxl + hs * (Wl / 2 - 260), Hd - 70, t / 2 + 58, DK); }
    if (+p.kickplate) for (const s of [-1, 1]) l.hb(Wl - 40, 250, 3, cxl, 125, s * (t / 2 + 1.5));
    if (+p.letterbox) { l.hb(300, 50, 8, cxl, Hd * .62, t / 2 + 4); l.hb(280, 8, 4, cxl, Hd * .62, t / 2 + 9, DK); }
    if (+p.numberplate) l.hb(140, 70, 3, cxl, 1750, t / 2 + 2);
  }
  // swing clearance: the zone the open leaf sweeps (outside = -Y when "out")
  for (const l of L) push({ id: 'swing' + (l.hs < 0 ? 'L' : 'R'), role: 'clearance', tags: ['swing'],
    def: { type: 'box', size: [r3(Wl + 5), r3(Wl), r3(Hd)], at: [r3(xs + l.hingeX - l.hs * (Wl / 2 + 2.5)), r3(-sw * (wallT / 2 + Wl / 2)), r3(YB + Hd / 2)] } });
  const ports = [{ id: 'L', at: [r3(-Wtot / 2), 0, 0], dir: [-1, 0, 0], type: 'face-h' }, { id: 'R', at: [r3(Wtot / 2), 0, 0], dir: [1, 0, 0], type: 'face-h' }];
  return { shapes, ports, info: describe(p) };
}
