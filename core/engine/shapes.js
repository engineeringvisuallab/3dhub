// Collision primitives (local space, centered at origin). Each has sdf(p) (negative inside),
// sample(step) -> local points, aabbHalf() -> half extents of a bounding box around the origin.
import { len } from './math3.js';
const lin = (n, h) => n < 2 ? [0] : Array.from({ length: n }, (_, i) => -h + (2*h*i)/(n-1));

export function makeShape(def) {
  if (def.type === 'box') {
    const [sx, sy, sz] = def.size, h = [sx/2, sy/2, sz/2];
    return {
      type: 'box', h,
      sdf(p) {
        const q = [Math.abs(p[0])-h[0], Math.abs(p[1])-h[1], Math.abs(p[2])-h[2]];
        return len(q.map(v => Math.max(v, 0))) + Math.min(Math.max(q[0], q[1], q[2]), 0);
      },
      sample(step) {
        const n = d => Math.min(14, Math.max(2, Math.ceil(d / step) + 1));
        const out = [];
        for (const x of lin(n(sx), h[0])) for (const y of lin(n(sy), h[1])) for (const z of lin(n(sz), h[2])) out.push([x, y, z]);
        return out;
      },
      aabbHalf: () => h.slice(),
      bound: () => len(h)
    };
  }
  if (def.type === 'cylinder') { // axis = local Z
    const r = def.radius, hl = def.length / 2;
    return {
      type: 'cylinder', r, hl,
      sdf(p) {
        const d0 = Math.hypot(p[0], p[1]) - r, d1 = Math.abs(p[2]) - hl;
        return Math.min(Math.max(d0, d1), 0) + Math.hypot(Math.max(d0, 0), Math.max(d1, 0));
      },
      sample(step) {
        const n = Math.min(60, Math.max(2, Math.ceil(def.length / step) + 1));
        const ring = r > 2 ? 8 : 1, out = [];
        for (const z of lin(n, hl)) {
          out.push([0, 0, z]);
          if (ring > 1) for (let k = 0; k < ring; k++) {
            const a = (2*Math.PI*k)/ring; out.push([r*Math.cos(a), r*Math.sin(a), z]);
          }
        }
        return out;
      },
      aabbHalf: () => [r, r, hl],
      bound: () => Math.hypot(r, hl)
    };
  }
  throw new Error('unknown shape type ' + def.type);
}
