// Visual mesh builder: plain triangle meshes (no DOM, no three.js), local space, mm, Z up.
// Used by core/engine/visual/*.js to build the real shape of a component (flange rings with bolt holes, torus bends,
// valve bodies, handwheels ...). Winding is counter-clockwise seen from outside, normals point outward.
// Collision still uses the simple boxes / cylinders of the component json; this layer is only what the user SEES and exports.
import { apply, mulRV, norm, cross, dot, sub, add, scale, rotFromTo } from './math3.js';
const TAU = Math.PI * 2;

export class Geo {
  constructor() { this.pos = []; this.nor = []; this.idx = []; }
  get verts() { return this.pos.length / 3; }
  v(p, n) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); return this.pos.length / 3 - 1; }
  q(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  tri(a, b, c) { this.idx.push(a, b, c); }
  // append another Geo, optionally moved by T = { R, t }
  merge(g, T) {
    const o = this.verts;
    for (let i = 0; i < g.pos.length; i += 3) {
      let p = [g.pos[i], g.pos[i + 1], g.pos[i + 2]], n = [g.nor[i], g.nor[i + 1], g.nor[i + 2]];
      if (T) { p = apply(T, p); n = mulRV(T.R, n); }
      this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]);
    }
    for (const k of g.idx) this.idx.push(k + o);
    return this;
  }
  get empty() { return this.idx.length === 0; }
}

// Pose with local Z along `dir`, local Y = world up (so bolt patterns straddle the vertical centre line), origin at `at`.
export function frame(dir, at = [0, 0, 0]) {
  const Z = norm(dir);
  let X = Math.abs(Z[2]) > 0.999 ? [1, 0, 0] : norm(cross([0, 0, 1], Z));
  const Y = cross(Z, X);
  return { R: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t: at.slice() };
}
export const move = (x, y, z) => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [x, y, z] });

export function box(sx, sy, sz) {
  const g = new Geo(), [x, y, z] = [sx / 2, sy / 2, sz / 2];
  const face = (a, b, c, d, n) => g.q(g.v(a, n), g.v(b, n), g.v(c, n), g.v(d, n));
  face([x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z], [1, 0, 0]);   face([-x, y, -z], [-x, -y, -z], [-x, -y, z], [-x, y, z], [-1, 0, 0]);
  face([x, y, -z], [-x, y, -z], [-x, y, z], [x, y, z], [0, 1, 0]);   face([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]);
  face([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]);   face([-x, y, -z], [x, y, -z], [x, -y, -z], [-x, -y, -z], [0, 0, -1]);
  return g;
}

// Revolve a profile [[r, z], ...] around the local Z axis. Walk the profile with the solid on the LEFT
// (outer wall going up, top cap going towards the axis). opts: seg (default 48), smooth (average normals of neighbouring
// segments when they bend less than 40 degrees), flat (one normal per angular facet, for hex nuts).
export function lathe(profile, opts = {}) {
  const seg = opts.seg || 48, g = new Geo(), n2 = [];
  for (let i = 0; i + 1 < profile.length; i++) {
    const dr = profile[i + 1][0] - profile[i][0], dz = profile[i + 1][1] - profile[i][1], L = Math.hypot(dr, dz);
    n2.push(L < 1e-9 ? null : [dz / L, -dr / L]);
  }
  const blend = (a, b) => {
    if (!opts.smooth || !a || !b || a[0] * b[0] + a[1] * b[1] < Math.cos(40 * Math.PI / 180)) return a;
    const m = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(m[0], m[1]) || 1; return [m[0] / L, m[1] / L];
  };
  for (let i = 0; i + 1 < profile.length; i++) {
    const nc = n2[i]; if (!nc) continue;
    let prev = null, next = null;
    for (let j = i - 1; j >= 0 && !prev; j--) prev = n2[j];
    for (let j = i + 1; j < n2.length && !next; j++) next = n2[j];
    const n0 = blend(nc, prev), n1 = blend(nc, next);
    for (let k = 0; k < seg; k++) {
      const a0 = TAU * k / seg, a1 = TAU * (k + 1) / seg, am = (a0 + a1) / 2;
      const P = (pt, a) => [pt[0] * Math.cos(a), pt[0] * Math.sin(a), pt[1]];
      const N = (n, a) => opts.flat ? [nc[0] * Math.cos(am), nc[0] * Math.sin(am), nc[1]] : [n[0] * Math.cos(a), n[0] * Math.sin(a), n[1]];
      const a = g.v(P(profile[i], a0), N(n0, a0)), b = g.v(P(profile[i], a1), N(n0, a1));
      const c = g.v(P(profile[i + 1], a1), N(n1, a1)), d = g.v(P(profile[i + 1], a0), N(n1, a0));
      g.q(a, b, c, d);
    }
  }
  return g;
}
// solid cylinder, axis Z, centred
export const cyl = (r, len, opts) => lathe([[0, -len / 2], [r, -len / 2], [r, len / 2], [0, len / 2]], opts);
// hollow tube (axis Z, centred) with open ends
export const hollow = (ro, ri, len, opts) => lathe([[ri, -len / 2], [ro, -len / 2], [ro, len / 2], [ri, len / 2], [ri, -len / 2]], opts);
// hex prism (nut / bolt head), across-corners radius r, axis Z, centred
export const hex = (r, len) => lathe([[0, -len / 2], [r, -len / 2], [r, len / 2], [0, len / 2]], { seg: 6, flat: true });
// cone / frustum, axis Z, from z0 (radius r0) to z1 (radius r1), closed
export const cone = (r0, r1, z0, z1, opts) => lathe([[0, z0], [r0, z0], [r1, z1], [0, z1]], opts);
// sphere of radius r (axis Z)
export function sphere(r, opts = {}) {
  const prof = [], n = opts.rings || 14;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; prof.push([Math.max(0, r * Math.cos(a)), r * Math.sin(a)]); }
  return lathe(prof, { smooth: true, seg: opts.seg || 40 });
}

// Sweep a circle of radius r along a polyline `pts` (rotation-minimising frames). closed = loop (handwheel rim).
export function tube(pts, r, opts = {}) {
  const seg = opts.seg || 24, g = new Geo(), n = pts.length, closed = !!opts.closed;
  const tan = pts.map((p, i) => {
    const a = pts[closed ? (i + n - 1) % n : Math.max(i - 1, 0)], b = pts[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    return norm(sub(b, a));
  });
  let N = norm(cross(tan[0], Math.abs(tan[0][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const rings = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) { // parallel transport: rotate previous N by the change of tangent
      const R = rotFromTo(tan[i - 1], tan[i]); N = norm(mulRV(R, N));
    }
    const B = cross(tan[i], N), ring = [], rr = typeof r === 'function' ? r(i / (n - 1)) : r;
    for (let k = 0; k < seg; k++) {
      const a = TAU * k / seg, d = add(scale(N, Math.cos(a)), scale(B, Math.sin(a)));
      ring.push(g.v(add(pts[i], scale(d, rr)), d));
    }
    rings.push(ring);
  }
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const A = rings[i], B = rings[(i + 1) % n];
    for (let k = 0; k < seg; k++) g.q(A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]);
  }
  if (!closed && opts.caps !== false) for (const [i, flip] of [[0, true], [n - 1, false]]) {
    const rr = typeof r === 'function' ? r(i / (n - 1)) : r, nn = flip ? scale(tan[i], -1) : tan[i];
    const c = g.v(pts[i], nn), ring = rings[i].map((_, k) => { const idx = rings[i][k]; return g.v([g.pos[idx * 3], g.pos[idx * 3 + 1], g.pos[idx * 3 + 2]], nn); });
    for (let k = 0; k < seg; k++) flip ? g.tri(c, ring[(k + 1) % seg], ring[k]) : g.tri(c, ring[k], ring[(k + 1) % seg]);
  }
  return g;
}
// points of a circular arc: centre c, radius R, starting direction u0 (unit), turning towards unit v0 (u0 ⟂ v0), angle in degrees
export function arcPoints(c, R, u0, v0, deg, steps = 20) {
  const out = [];
  for (let i = 0; i <= steps; i++) { const a = (deg * Math.PI / 180) * i / steps; out.push(add(c, add(scale(u0, R * Math.cos(a)), scale(v0, R * Math.sin(a))))); }
  return out;
}

// inside-out copy: normals and winding reversed (inner wall of a hollow part)
export function flip(g) {
  const o = new Geo(); o.pos = g.pos.slice(); o.nor = g.nor.map(v => -v);
  for (let i = 0; i < g.idx.length; i += 3) o.idx.push(g.idx[i], g.idx[i + 2], g.idx[i + 1]);
  return o;
}
