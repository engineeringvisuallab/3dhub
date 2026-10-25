// Pipe fittings generators for the Studio: flanged bend (90 / 45), flanged tee, concentric reducer.
// They are generators (not fixed shape lists) because the direction of the turn / branch is a design choice:
// up, down, left, right (seen along the flow, which enters at port A). Only boxes and cylinders exist in the engine,
// so a bend is two straight arms that meet at the corner (a mitred elbow). Sizes are a generic envelope (see docs/STUDIO.md),
// not a maker's catalogue. Local frame: flow enters at A along +X, Z is up, +Y is to the left of the flow.
const r3 = v => Math.round(v * 1000) / 1000;
const BLUE = 0x2b5d8a;
export const TURNS = [{ v: 'up', label: 'Up' }, { v: 'down', label: 'Down' }, { v: 'left', label: 'Left' }, { v: 'right', label: 'Right' }];
const DIR = { up: [0, 0, 1], down: [0, 0, -1], left: [0, 1, 0], right: [0, -1, 0] }; // [x, y, z] of a 90 degree turn
// face-to-centre lengths (mm) by DN
const ARM90 = { 100: 190, 150: 240, 200: 290, 250: 340, 300: 390, 400: 490, 500: 590, 600: 690 };
const ARM45 = { 100: 130, 150: 160, 200: 190, 250: 220, 300: 250, 400: 310, 500: 370, 600: 430 };
const TEE = { 100: 200, 150: 250, 200: 300, 250: 350, 300: 400, 400: 500, 500: 600, 600: 700 };
const need = (T, DN, what) => { if (!(DN in T)) throw new Error(`${what}: no size for DN ${DN}`); return T[DN]; };

// a cylinder from point p0 to p1 (both on the X/Y/Z axes or at 45 degrees in the XY or XZ plane)
function arm(id, p0, p1, radius, color) {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(...d), u = d.map(v => v / L);
  const at = [0, 1, 2].map(i => r3((p0[i] + p1[i]) / 2));
  // axis x tilted: rot is applied after the axis, as Euler degrees (Rz*Ry*Rx). Ry(-a) lifts +X by a; Rz(b) swings it to +Y by b.
  const el = Math.asin(Math.max(-1, Math.min(1, u[2]))) * 180 / Math.PI, az = Math.atan2(u[1], u[0]) * 180 / Math.PI;
  return { id, role: 'solid', type: 'cylinder', axis: 'x', radius: r3(radius), length: r3(L), at, rot: [0, r3(-el), r3(az)], color, tags: ['fitting'] };
}
const flangePort = (id, at, dir, p, DNv = p.DN) => ({ id, at: at.map(r3), dir: dir.map(r3), type: 'flange', DN: DNv, PN: p.PN, std: 'EN1092-2', bind: { DN: p.DNparam || 'DN', PN: 'PN' } });

export const bend = {
  validate(p) { need(p.angle === 45 ? ARM45 : ARM90, p.DN, 'bend'); },
  generate(p) {
    const R = p.OD / 2, a = need(+p.angle === 45 ? ARM45 : ARM90, p.DN, 'bend'), t = DIR[p.turn] || DIR.up;
    let b; // direction after the bend
    if (+p.angle === 45) { const c = Math.SQRT1_2; b = [c, t[1] * c, t[2] * c]; } else b = t;
    const A = [-a, 0, 0], B = b.map(v => v * a), pad = [R * 0.5, 0, 0]; // pad: run each arm a little past the corner so the mitre has no notch
    const bpad = b.map(v => -v * R * 0.5);
    const shapes = [arm('arm-A', A, pad, R, BLUE), arm('arm-B', bpad, B, R, BLUE)];
    const ports = [flangePort('A', A, [-1, 0, 0], p), flangePort('B', B, b, p)];
    return { shapes, ports, info: [`${p.angle} degree flanged bend, DN ${p.DN}, PN ${p.PN}. Turn ${p.turn} (seen along the flow from A).`, `Face to centre ${a} mm. Shown as two straight arms (mitred elbow); the end faces and ports are exact.`] };
  }
};
export const tee = {
  validate(p) { need(TEE, p.DN, 'tee'); },
  generate(p) {
    const R = p.OD / 2, h = need(TEE, p.DN, 'tee'), t = DIR[p.branch] || DIR.up;
    const shapes = [arm('run', [-h, 0, 0], [h, 0, 0], R, BLUE), arm('branch', [0, 0, 0], t.map(v => v * h), R, BLUE)];
    const ports = [flangePort('A', [-h, 0, 0], [-1, 0, 0], p), flangePort('B', [h, 0, 0], [1, 0, 0], p), flangePort('C', t.map(v => v * h), t, p)];
    return { shapes, ports, info: [`Equal flanged tee, DN ${p.DN}, PN ${p.PN}. Branch ${p.branch}.`, `Face to centre ${h} mm on the run and on the branch.`] };
  }
};
export const reducer = {
  validate(p) {
    if (!(+p.DN2 < +p.DN)) throw new Error(`Reducer outlet DN ${p.DN2} must be smaller than inlet DN ${p.DN}.`);
    if (+p.DN / +p.DN2 > 2.5) throw new Error(`Reducer DN ${p.DN} to ${p.DN2} is too steep (ratio above 2.5). Use two reducers in a row.`);
  },
  generate(p) {
    const R1 = p.OD / 2, R2 = p.OD2 / 2, L = Math.max(300, Math.round(250 + 1.5 * (p.DN - p.DN2))), Rm = (R1 + R2) / 2;
    const seg = (id, x0, x1, R) => ({ id, role: 'solid', type: 'cylinder', axis: 'x', radius: r3(R), length: r3(x1 - x0), at: [r3((x0 + x1) / 2), 0, 0], color: BLUE, tags: ['fitting'] });
    const c = L / 3;
    const shapes = [seg('big', -L / 2, -L / 2 + c, R1), seg('mid', -L / 2 + c, L / 2 - c, Rm), seg('small', L / 2 - c, L / 2, R2)];
    const ports = [flangePort('A', [-L / 2, 0, 0], [-1, 0, 0], p, p.DN), { ...flangePort('B', [L / 2, 0, 0], [1, 0, 0], p, p.DN2), bind: { DN: 'DN2', PN: 'PN' } }];
    return { shapes, ports, info: [`Concentric flanged reducer DN ${p.DN} to DN ${p.DN2}, PN ${p.PN}. Length ${L} mm.`, 'Shown as three steps (big, middle, small) instead of a smooth cone.'] };
  }
};
