// Mesh export (OBJ, GLB) generated from the assembly's world-space items (flatten().items). Own writer, no third-party code.
// Engine space is Z-up in mm. Output is Y-up in metres (glTF rule; OBJ uses the same so both files open alike).
import { mulRV } from './math3.js';

import { COLORS, colorOf } from './colors.js';
export { COLORS, colorOf };
const SEG = 32, S = 0.001;
const yUp = p => [p[0] * S, p[2] * S, -p[1] * S];          // (x,y,z) mm Z-up -> metres Y-up
const yUpN = n => [n[0], n[2], -n[1]];

// local-space triangles with normals: { p:[[x,y,z]..], n:[[..]..], i:[tri indices] }
function localMesh(sh) {
  const p = [], n = [], i = [];
  const quad = (a, b, c, d, nn) => { const k = p.length; p.push(a, b, c, d); n.push(nn, nn, nn, nn); i.push(k, k + 1, k + 2, k, k + 2, k + 3); };
  if (sh.type === 'box') {
    const [x, y, z] = sh.h;
    quad([x,-y,-z],[x,y,-z],[x,y,z],[x,-y,z],[1,0,0]);   quad([-x,y,-z],[-x,-y,-z],[-x,-y,z],[-x,y,z],[-1,0,0]);
    quad([x,y,-z],[-x,y,-z],[-x,y,z],[x,y,z],[0,1,0]);   quad([-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z],[0,-1,0]);
    quad([-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],[0,0,1]);   quad([-x,y,-z],[x,y,-z],[x,-y,-z],[-x,-y,-z],[0,0,-1]);
  } else {                                                  // cylinder, axis = local Z
    const r = sh.r, h = sh.hl;
    for (let k = 0; k < SEG; k++) {
      const a0 = (2 * Math.PI * k) / SEG, a1 = (2 * Math.PI * (k + 1)) / SEG, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const q = p.length;
      p.push([r*c0, r*s0, -h], [r*c1, r*s1, -h], [r*c1, r*s1, h], [r*c0, r*s0, h]); n.push([c0,s0,0], [c1,s1,0], [c1,s1,0], [c0,s0,0]);
      i.push(q, q + 1, q + 2, q, q + 2, q + 3);
      for (const [z, nz] of [[h, 1], [-h, -1]]) {
        const b = p.length; p.push([0, 0, z], [r*c0, r*s0, z], [r*c1, r*s1, z]); n.push([0,0,nz], [0,0,nz], [0,0,nz]);
        if (nz > 0) i.push(b, b + 1, b + 2); else i.push(b, b + 2, b + 1);
      }
    }
  }
  return { p, n, i };
}
// world mesh in Y-up metres. Skips soft/void helper shapes.
// With `visuals` (visualItems(): the real shapes from core/engine/visual) the instances are exported from those meshes;
// only rebar still comes from the collision items. Without it, every solid box / cylinder is exported (old behaviour).
function legacyMesh(it) {
  const m = localMesh(it.shape), R = it.T.R, t = it.T.t;
  const pos = m.p.map(v => yUp(mulRV(R, v).map((c, k) => c + t[k])));
  const nor = m.n.map(v => yUpN(mulRV(R, v)));
  return { name: `${it.inst}/${it.id}`, color: it.color ?? colorOf(it.role === 'rebar' ? ['rebar'] : it.tags), pos, nor, idx: m.i };
}
function visualMesh(v) {
  const R = v.T.R, t = v.T.t, n = v.pos.length / 3, pos = new Array(n), nor = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = mulRV(R, [v.pos[3 * i], v.pos[3 * i + 1], v.pos[3 * i + 2]]), q = mulRV(R, [v.nor[3 * i], v.nor[3 * i + 1], v.nor[3 * i + 2]]);
    pos[i] = yUp([p[0] + t[0], p[1] + t[1], p[2] + t[2]]); nor[i] = yUpN(q);
  }
  return { name: `${v.inst}/${v.name}`, color: v.color, ...(v.opacity !== undefined ? { opacity: v.opacity } : {}), pos, nor, idx: Array.from(v.idx) };
}
export function worldMeshes(items, visuals) {
  if (visuals) return [...visuals.map(visualMesh), ...items.filter(it => it.role === 'rebar').map(legacyMesh)];
  return items.filter(it => it.role === 'solid' || it.role === 'rebar').map(legacyMesh);
}

export function toOBJ(items, name = 'EVLab assembly', visuals) {
  const L = [`# ${name}`, '# EVLab 3D Studio export. Units: metres, Y-up.'];
  let vo = 0, no = 0;
  for (const m of worldMeshes(items, visuals)) {
    L.push(`o ${m.name.replace(/\s+/g, '_')}`);
    for (const v of m.pos) L.push(`v ${v[0].toFixed(5)} ${v[1].toFixed(5)} ${v[2].toFixed(5)}`);
    for (const v of m.nor) L.push(`vn ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`);
    for (let k = 0; k < m.idx.length; k += 3) L.push('f ' + [0, 1, 2].map(q => { const j = m.idx[k + q]; return `${vo + j + 1}//${no + j + 1}`; }).join(' '));
    vo += m.pos.length; no += m.nor.length;
  }
  return L.join('\n') + '\n';
}

export function toGLB(items, name = 'EVLab assembly', visuals) {
  const meshes = worldMeshes(items, visuals), chunks = [], bufferViews = [], accessors = [], gMeshes = [], nodes = [], materials = [], matIdx = {};
  let off = 0;
  const push = (arr, target, cls) => { // arr: typed array
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    chunks.push(bytes); bufferViews.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, target }); off += bytes.length;
    return bufferViews.length - 1;
  };
  for (const m of meshes) {
    const P = new Float32Array(m.pos.flat()), N = new Float32Array(m.nor.flat()), I = new Uint32Array(m.idx);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const v of m.pos) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
    const a = accessors.length;
    accessors.push({ bufferView: push(P, 34962), componentType: 5126, count: m.pos.length, type: 'VEC3', min: lo, max: hi });
    accessors.push({ bufferView: push(N, 34962), componentType: 5126, count: m.nor.length, type: 'VEC3' });
    accessors.push({ bufferView: push(I, 34963), componentType: 5125, count: m.idx.length, type: 'SCALAR' });
    const mk = m.color + '|' + (m.opacity ?? 1);
    if (!(mk in matIdx)) {
      matIdx[mk] = materials.length;
      materials.push({ name: '#' + m.color.toString(16).padStart(6, '0'), doubleSided: true, ...((m.opacity ?? 1) < 1 ? { alphaMode: 'BLEND' } : {}),
        pbrMetallicRoughness: { baseColorFactor: [(m.color >> 16 & 255) / 255, (m.color >> 8 & 255) / 255, (m.color & 255) / 255, m.opacity ?? 1], metallicFactor: 0.1, roughnessFactor: 0.8 } });
    }
    gMeshes.push({ name: m.name, primitives: [{ attributes: { POSITION: a, NORMAL: a + 1 }, indices: a + 2, material: matIdx[mk] }] });
    nodes.push({ name: m.name, mesh: gMeshes.length - 1 });
  }
  const json = { asset: { version: '2.0', generator: 'EVLab 3D Studio', extras: { name, units: 'metres, Y-up' } },
    scene: 0, scenes: [{ nodes: nodes.map((_, k) => k) }], nodes, meshes: gMeshes, materials, accessors, bufferViews, buffers: [{ byteLength: off }] };
  const pad = (n, to) => (to - (n % to)) % to;
  const jb = new TextEncoder().encode(JSON.stringify(json)), jPad = pad(jb.length, 4), bPad = pad(off, 4);
  const total = 12 + 8 + jb.length + jPad + (off ? 8 + off + bPad : 0);
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);        // 'glTF', version 2
  dv.setUint32(12, jb.length + jPad, true); dv.setUint32(16, 0x4E4F534A, true);                      // JSON chunk
  out.set(jb, 20); out.fill(0x20, 20 + jb.length, 20 + jb.length + jPad);
  if (off) {
    let p = 20 + jb.length + jPad; dv.setUint32(p, off + bPad, true); dv.setUint32(p + 4, 0x004E4942, true); p += 8;   // BIN chunk
    for (const c of chunks) { out.set(c, p); p += c.length; }
  }
  return out;
}
