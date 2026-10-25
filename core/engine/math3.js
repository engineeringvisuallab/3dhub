// Tiny 3D math. Transform = { R:[9 numbers row-major], t:[x,y,z] }. Units: mm.
const D = Math.PI / 180;
export const ID = () => ({ R: [1,0,0, 0,1,0, 0,0,1], t: [0,0,0] });
export function mulRR(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i*3+j] = a[i*3]*b[j] + a[i*3+1]*b[3+j] + a[i*3+2]*b[6+j];
  return r;
}
export function rotEuler(rot = [0,0,0]) { // degrees, R = Rz*Ry*Rx
  const [x,y,z] = rot.map(v => v * D);
  const cx=Math.cos(x), sx=Math.sin(x), cy=Math.cos(y), sy=Math.sin(y), cz=Math.cos(z), sz=Math.sin(z);
  const Rx=[1,0,0, 0,cx,-sx, 0,sx,cx], Ry=[cy,0,sy, 0,1,0, -sy,0,cy], Rz=[cz,-sz,0, sz,cz,0, 0,0,1];
  return mulRR(Rz, mulRR(Ry, Rx));
}
export const mulRV = (R, v) => [R[0]*v[0]+R[1]*v[1]+R[2]*v[2], R[3]*v[0]+R[4]*v[1]+R[5]*v[2], R[6]*v[0]+R[7]*v[1]+R[8]*v[2]];
export const mulRtV = (R, v) => [R[0]*v[0]+R[3]*v[1]+R[6]*v[2], R[1]*v[0]+R[4]*v[1]+R[7]*v[2], R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];
export const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
export const scale = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function fromEuler(pos = [0,0,0], rot = [0,0,0]) { return { R: rotEuler(rot), t: pos.slice() }; }
export function compose(a, b) { return { R: mulRR(a.R, b.R), t: add(mulRV(a.R, b.t), a.t) }; } // a ∘ b
export const apply = (T, p) => add(mulRV(T.R, p), T.t);
export const applyInv = (T, p) => mulRtV(T.R, sub(p, T.t));
export function rotFromTo(a, b) { // minimal rotation taking unit a to unit b
  a = norm(a); b = norm(b);
  const v = cross(a, b), c = dot(a, b);
  if (c > 0.999999) return [1,0,0, 0,1,0, 0,0,1];
  if (c < -0.999999) { // antiparallel: 180° about world Z when horizontal (keeps 'up' up), else about X
    const u = Math.abs(a[2]) < 0.99 ? [0,0,1] : [1,0,0];
    return [2*u[0]*u[0]-1, 2*u[0]*u[1], 2*u[0]*u[2], 2*u[1]*u[0], 2*u[1]*u[1]-1, 2*u[1]*u[2], 2*u[2]*u[0], 2*u[2]*u[1], 2*u[2]*u[2]-1];
  }
  const k = 1 / (1 + c);
  return [v[0]*v[0]*k+c, v[0]*v[1]*k-v[2], v[0]*v[2]*k+v[1],
          v[1]*v[0]*k+v[2], v[1]*v[1]*k+c, v[1]*v[2]*k-v[0],
          v[2]*v[0]*k-v[1], v[2]*v[1]*k+v[0], v[2]*v[2]*k+c];
}

export function rotAxis(axis, deg) { // Rodrigues, axis need not be unit
  const [x,y,z] = norm(axis), c = Math.cos(deg*D), s = Math.sin(deg*D), t = 1-c;
  return [t*x*x+c, t*x*y-s*z, t*x*z+s*y, t*x*y+s*z, t*y*y+c, t*y*z-s*x, t*x*z-s*y, t*y*z+s*x, t*z*z+c];
}
export function eulerFromR(R) { // inverse of rotEuler (degrees); gimbal-safe enough for placement
  const sy = -R[6], y = Math.asin(Math.max(-1, Math.min(1, sy)));
  if (Math.abs(sy) < 0.999999) return [Math.atan2(R[7], R[8])/D, y/D, Math.atan2(R[3], R[0])/D];
  return [0, y/D, Math.atan2(-R[1], R[4])/D];
}
