// Small helpers shared by the visual builders.
import { Geo, cyl, hollow, tube, frame, hex } from '../mesh.js';
import { apply } from '../math3.js';
export const RED = 0xc43d2f, STEEL = 0x5d6b7a, BRIGHT = 0xb9bec5, DARK = 0x2b3340;
export const along = (g, dir, p = [0, 0, 0]) => new Geo().merge(g, frame(dir, p));
export const cylAt = (r, len, dir, p, o) => along(cyl(r, len, o), dir, p);
export const hollowAt = (ro, ri, len, dir, p, o) => along(hollow(ro, ri, len, o), dir, p);
export const part = (name, geo, color, extra = {}) => ({ name, geo, color, ...extra });
// hand wheel in a horizontal plane at height zc around (cx, cy): rim, hub, spokes
export function wheel(rw, rt, zc, cx = 0, cy = 0, spokes = 4) {
  const g = new Geo(), rim = [];
  for (let i = 0; i < 48; i++) { const a = 2 * Math.PI * i / 48; rim.push([cx + rw * Math.cos(a), cy + rw * Math.sin(a), zc]); }
  g.merge(tube(rim, rt, { closed: true, seg: 10 }));
  g.merge(cylAt(rt * 2.4, rt * 3.2, [0, 0, 1], [cx, cy, zc]));
  for (let k = 0; k < spokes; k++) {
    const a = 2 * Math.PI * k / spokes;
    g.merge(tube([[cx, cy, zc], [cx + rw * Math.cos(a), cy + rw * Math.sin(a), zc]], rt * 0.55, { seg: 8 }));
  }
  return g;
}
// world position of a point given in a frame(dir, at) coordinate system
export const inFrame = (dir, at, p) => apply(frame(dir, at), p);
export { hex };
