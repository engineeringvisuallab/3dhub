// EVLab 3D Studio - browser interface on top of core/engine (assembly, snap). Z is up, units are mm.
import { flatten, resolveParams } from '../core/engine/assembly.js';
import { autoAttach, moveInstance, rotateInstance, brokenLinks, nextId, worldPorts, usedPorts } from '../core/engine/snap.js';
import { check } from '../core/engine/collision.js';
import { materialize } from '../core/engine/generate.js';
import { serialize, parse } from '../core/engine/io.js';
import { toGLB, toOBJ, colorOf } from '../core/engine/export.js';
import { assemblyBounds, buildSheet, sheetSVG } from '../core/engine/drawing.js';

// Component ids come from core/library/components/manifest.json (loaded at start, see the end of this file).
const $ = s => document.querySelector(s);
const lib = {};
let rules, crules, report = { conflicts: [], warnings: [] }, conflictIds = new Set(), asm = { name: 'Untitled', units: 'mm', instances: [], links: [] }, sel = null, withAttached = true, attachPort = '', step = 100;

// ---------- 3D view ----------
const view = $('#view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14181d);
const camera = new THREE.PerspectiveCamera(45, 1, 10, 500000);
camera.up.set(0, 0, 1);
scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(4000, -6000, 9000); scene.add(sun);
const grid = new THREE.GridHelper(20000, 40, 0x3a4552, 0x242c35); grid.rotation.x = Math.PI / 2; scene.add(grid);
scene.add(new THREE.AxesHelper(1000));
const group = new THREE.Group(); scene.add(group);

const cam = { theta: -0.8, phi: 1.0, dist: 7000, target: new THREE.Vector3(0, 0, 500) };
function updateCamera() {
  const { theta, phi, dist, target } = cam;
  camera.position.set(target.x + dist * Math.sin(phi) * Math.cos(theta), target.y + dist * Math.sin(phi) * Math.sin(theta), target.z + dist * Math.cos(phi));
  camera.lookAt(target);
}
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw();
}
const draw = () => renderer.render(scene, camera);
new ResizeObserver(resize).observe(view);

let drag = null;
const cv = renderer.domElement;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, b: e.button, shift: e.shiftKey }; });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (drag.b === 2 || drag.shift) {
    const k = cam.dist * 0.0016, m = camera.matrixWorld.elements;
    cam.target.addScaledVector(new THREE.Vector3(m[0], m[1], m[2]), -dx * k).addScaledVector(new THREE.Vector3(m[4], m[5], m[6]), dy * k);
  } else {
    cam.theta -= dx * 0.006; cam.phi = Math.min(3.1, Math.max(0.05, cam.phi - dy * 0.006));
  }
  updateCamera(); draw();
});
cv.addEventListener('pointerup', e => {
  const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
  if (moved < 4 && drag.b === 0) pick(e);
  drag = null;
});
cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.min(200000, Math.max(200, cam.dist * Math.exp(e.deltaY * 0.001))); updateCamera(); draw(); }, { passive: false });

const ray = new THREE.Raycaster();
function setRay(e) {
  const r = cv.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
}
function pick(e) {
  setRay(e);
  const hit = ray.intersectObjects(group.children.filter(m => m.userData.role === 'solid'), false)[0];
  select(hit ? hit.object.userData.inst : null);
}

// ---------- build meshes from the assembly ----------
function rebuild() {
  const st = document.getElementById('start'); if (st) st.style.display = asm.instances.length ? 'none' : 'block';
  group.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); group.clear();
  let items = [];
  try { items = flatten(asm, lib).items; } catch (e) { say(e.message, true); }
  report = { conflicts: [], warnings: [] };
  try { if (items.length) report = check(asm, lib, crules); } catch (e) { say('Conflict check failed: ' + e.message, true); }
  conflictIds = new Set(report.conflicts.flatMap(c => [c.a, c.b]));
  for (const it of items) {
    const s = it.shape;
    let g;
    if (s.type === 'box') g = new THREE.BoxGeometry(s.h[0] * 2, s.h[1] * 2, s.h[2] * 2);
    else { g = new THREE.CylinderGeometry(s.r, s.r, s.hl * 2, 40); g.rotateX(Math.PI / 2); }
    const solid = it.role === 'solid', picked = it.inst === sel, see = it.opacity ?? 1; // shapes can carry their own colour / opacity (door glass)
    const mat = new THREE.MeshStandardMaterial({
      color: solid ? (it.color ?? colorOf(it.tags)) : it.role === 'clearance' ? 0xf5a524 : 0x000000,
      transparent: !solid || picked || see < 1, opacity: solid ? (picked ? Math.min(0.85, see) : see) : it.role === 'clearance' ? 0.15 : 0.35,
      emissive: picked ? 0x2255aa : conflictIds.has(it.inst) ? 0x6b1d1d : 0x000000, depthWrite: solid && see >= 1
    });
    const m = new THREE.Mesh(g, mat);
    const R = it.T.R, t = it.T.t;
    m.matrixAutoUpdate = false;
    m.matrix.set(R[0], R[1], R[2], t[0], R[3], R[4], R[5], t[1], R[6], R[7], R[8], t[2], 0, 0, 0, 1);
    m.userData = { inst: it.inst, role: it.role };
    if (solid) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x0b0e12 })));
    group.add(m);
  }
  draw(); status(); props(); conflictPanel();
}
function frameAll(ids) {
  const box = new THREE.Box3();
  group.children.filter(m => !ids?.length || ids.includes(m.userData.inst)).forEach(m => { m.updateMatrixWorld(true); box.expandByObject(m); });
  if (box.isEmpty()) return;
  box.getCenter(cam.target); cam.dist = Math.max(1500, box.getSize(new THREE.Vector3()).length() * 1.6);
  updateCamera(); draw();
}

// ---------- editing ----------
function say(text = '', err = false) { const m = $('#msg'); m.textContent = text; m.className = err ? 'err' : ''; }
function status() {
  let broken = 0; try { broken = brokenLinks(asm, lib, rules).length; } catch { /* ignore */ }
  $('#count').textContent = `${asm.instances.length} objects, ${asm.links.length} links` + (broken ? `, ${broken} broken` : '') + `, ${report.conflicts.length} conflicts, ${report.warnings.length} warnings`;
  if (broken) say(`${broken} link(s) no longer touch. Move the part back or detach it.`, true);
}
function select(id) { if (id !== sel) attachPort = ''; sel = id; rebuild(); }

function addFree(componentId, at) {
  const id = nextId(asm, componentId);
  const inst = { id, component: componentId, params: {}, pos: [at[0], at[1], 0], rot: [0, 0, 0] };
  try {
    // rest the new part on the ground plane
    const probe = { ...asm, instances: [inst] };
    let minZ = Infinity;
    for (const it of flatten(probe, lib).items) {
      if (it.role !== 'solid') continue;
      const h = it.shape.type === 'box' ? it.shape.h : [it.shape.r, it.shape.r, it.shape.hl];
      const R = it.T.R; minZ = Math.min(minZ, it.T.t[2] - (Math.abs(R[6]) * h[0] + Math.abs(R[7]) * h[1] + Math.abs(R[8]) * h[2]));
    }
    if (isFinite(minZ)) inst.pos[2] = -minZ;
  } catch (e) { say(e.message, true); return; }
  asm.instances.push(inst);
  const first = asm.instances.length === 1;
  say(`Added ${lib[componentId].name}.`);
  select(id); if (first) frameAll();
}
function addFromLibrary(componentId) {
  if (!sel) { const n = asm.instances.length; return addFree(componentId, [cam.target.x + n * 40, cam.target.y]); }
  const r = autoAttach(asm, lib, sel, componentId, rules, attachPort ? { fromPort: attachPort } : {});
  if (r.error) { say(r.error + (r.reasons?.length ? ' (' + r.reasons[0] + ')' : ''), true); return; }
  asm = r.assembly; say(`Attached ${lib[componentId].name} to ${r.link.a}.`);
  select(r.instance.id);
}
function remove(id) {
  asm.instances = asm.instances.filter(i => i.id !== id);
  asm.links = asm.links.filter(l => l.a.split('.')[0] !== id && l.b.split('.')[0] !== id);
  say('Deleted ' + id + '.'); select(null);
}

// ---------- models panel ----------
function listModels() {
  const q = $('#search').value.trim().toLowerCase(), box = $('#models'); box.innerHTML = '';
  const cats = {};
  for (const c of Object.values(lib)) if (!q || (c.name + ' ' + c.category + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(q)) (cats[c.category] ||= []).push(c);
  for (const cat of Object.keys(cats).sort()) {
    const h = document.createElement('h2'); h.textContent = cat.replace('/', ' / '); box.appendChild(h);
    for (const c of cats[cat]) {
      const d = document.createElement('div'); d.className = 'model'; d.draggable = true; d.dataset.id = c.id;
      d.innerHTML = `${c.name}<small>${c.id}</small>`;
      d.addEventListener('click', () => addFromLibrary(c.id));
      d.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', c.id));
      box.appendChild(d);
    }
  }
  if (!box.children.length) box.innerHTML = '<p class="hint">No model matches.</p>';
}
$('#search').addEventListener('input', listModels);
view.addEventListener('dragover', e => e.preventDefault());
view.addEventListener('drop', e => {
  e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (!lib[id]) return;
  setRay(e); const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p)) p.copy(cam.target);
  addFree(id, [Math.round(p.x), Math.round(p.y)]);
});

// ---------- move / rotate with buttons (keeps attached parts together while "Move with attached parts" is ticked) ----------
function nudge(delta) {
  if (!sel) return;
  const r = moveInstance(asm, sel, delta, { withAttached });
  asm = r.assembly; say(r.detached.length ? `Detached from ${r.detached.length} link(s). Tick \"Move with attached parts\" to keep them.` : '');
  rebuild();
}
function turn(deg) {
  if (!sel) return;
  const r = rotateInstance(asm, sel, deg, { withAttached });
  asm = r.assembly; say(r.detached.length ? `Detached from ${r.detached.length} link(s). Tick \"Move with attached parts\" to keep them.` : '');
  rebuild();
}

// ---------- properties panel ----------
function props() {
  const el = $('#props');
  const inst = asm.instances.find(i => i.id === sel);
  if (!inst) { el.innerHTML = '<p class="hint">Select an object in the scene.</p>'; return; }
  const comp = lib[inst.component], rp = resolveParams(comp, inst.params);
  const tables = {}; for (const d of Object.values(comp.derived || {})) tables[d.from] = Object.keys(d.table);
  let h = `<h3>${comp.name}</h3><div class="id">${inst.id}</div><h2>Parameters</h2>`;
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  for (const [k, d] of Object.entries(comp.parameters || {})) {
    const nm = esc(d.short || k), tip = esc(d.label || k) + (d.unit ? ' (' + d.unit + ')' : '');
    if (d.options) { // choice parameter (door design, glass, handle ...): options are values or { v, label }
      h += `<div class="row"><label title="${tip}">${nm}</label><select data-p="${k}" data-opt="1" title="${tip}">${d.options.map(o => {
        const v = o !== null && typeof o === 'object' ? o.v : o, lab = o !== null && typeof o === 'object' ? (o.label ?? o.v) : o;
        return `<option value="${esc(v)}"${v === rp[k] ? ' selected' : ''}>${esc(lab)}</option>`; }).join('')}</select></div>`;
    } else if (tables[k]) h += `<div class="row"><label>${nm}</label><select data-p="${k}">${tables[k].map(v => `<option${+v === rp[k] ? ' selected' : ''}>${v}</option>`).join('')}</select></div>`;
    else {
      const span = (d.max ?? 0) - (d.min ?? 0);
      h += `<div class="row"><label title="${tip}">${nm}</label><input type="number" data-p="${k}" value="${rp[k]}"${d.min !== undefined ? ` min="${d.min}"` : ''}${d.max !== undefined ? ` max="${d.max}"` : ''} step="${d.step ?? (span > 0 && span <= 1 ? 0.1 : 1)}"></div>`;
    }
  }
  if (comp.generator) { // generated components describe what they built (sizes the user cannot type in directly)
    try { h += '<h2>Details</h2>' + materialize(comp, rp).info.map(l => `<div class="hint">${esc(l)}</div>`).join(''); } catch { /* shown by the parameter check */ }
  }
  const trio = (name, key, arr) => `<div class="row row3"><label>${name}</label>${arr.map((v, i) => `<input type="number" data-${key}="${i}" value="${+v.toFixed(3)}">`).join('')}</div>`;
  h += `<h2>Placement (mm / deg)</h2>${trio('Position', 'pos', inst.pos)}${trio('Rotation', 'rot', inst.rot || [0, 0, 0])}`;
  h += `<div class="row"><label></label><span><input type="checkbox" id="wa"${withAttached ? ' checked' : ''}> Move with attached parts</span></div>`;
  // which free port the next clicked model attaches to
  const used = usedPorts(asm), free = worldPorts(asm, inst.id, lib).filter(p => !used.has(p.inst + '.' + p.id));
  if (attachPort && !free.some(p => p.id === attachPort)) attachPort = '';
  h += `<h2>Next part attaches at</h2><div class="row"><label>Port</label><select id="ap"><option value="">Auto (first free)</option>${free.map(p => `<option value="${esc(p.id)}"${p.id === attachPort ? ' selected' : ''}>${esc(p.id)}${p.DN ? ' (DN ' + p.DN + ')' : ''} - ${esc(p.type)}</option>`).join('')}</select></div>`;
  h += `<h2>Move and turn</h2><div class="row"><label>Step (mm)</label><select id="stp">${[10, 50, 100, 500, 1000].map(v => `<option${v === step ? ' selected' : ''}>${v}</option>`).join('')}</select></div>`;
  h += '<div class="actions" id="pad"><button data-m="-1,0,0">-X</button><button data-m="1,0,0">+X</button><button data-m="0,-1,0">-Y</button><button data-m="0,1,0">+Y</button><button data-m="0,0,-1">Down</button><button data-m="0,0,1">Up</button></div>';
  h += '<div class="actions"><button data-r="-90">Turn -90</button><button data-r="90">Turn +90</button></div><p class="hint">Keys: arrow keys move X / Y, Page Up / Page Down move up / down.</p>';
  h += '<div class="actions"><button id="del" class="danger">Delete</button></div>';
  el.innerHTML = h;
  $('#del').onclick = () => remove(inst.id);
  $('#wa').onchange = e => { withAttached = e.target.checked; };
  $('#ap').onchange = e => { attachPort = e.target.value; };
  $('#stp').onchange = e => { step = +e.target.value; };
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => nudge(b.dataset.m.split(',').map(v => +v * step)));
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => turn(+b.dataset.r));
  el.querySelectorAll('[data-p]').forEach(i => i.onchange = () => {
    const prev = inst.params, d = comp.parameters[i.dataset.p];
    let v = +i.value; // choice parameters keep the option's own type (text or number)
    if (i.dataset.opt) { const o = d.options.map(x => (x !== null && typeof x === 'object' ? x.v : x)).find(x => String(x) === i.value); v = o === undefined ? i.value : o; }
    inst.params = { ...prev, [i.dataset.p]: v };
    try { resolveParams(comp, inst.params); say(''); } catch (e) { inst.params = prev; say(e.message, true); }
    rebuild();
  });
  el.querySelectorAll('[data-pos]').forEach(i => i.onchange = () => {
    const k = +i.dataset.pos, delta = [0, 0, 0]; delta[k] = +i.value - inst.pos[k];
    const r = moveInstance(asm, inst.id, delta, { withAttached });
    asm = r.assembly; say(r.detached.length ? `Detached from ${r.detached.length} link(s).` : '');
    rebuild();
  });
  el.querySelectorAll('[data-rot]').forEach(i => i.onchange = () => {
    inst.rot = inst.rot || [0, 0, 0]; inst.rot[+i.dataset.rot] = +i.value;
    const n = asm.links.length;
    asm.links = asm.links.filter(l => l.a.split('.')[0] !== inst.id && l.b.split('.')[0] !== inst.id);
    say(asm.links.length < n ? 'Rotated, so the part was detached.' : '');
    rebuild();
  });
}

// ---------- conflict panel ----------
function conflictPanel() {
  const el = $('#conflicts'), rows = [...report.conflicts.map(c => ['bad', c]), ...report.warnings.map(c => ['warn', c])];
  if (!asm.instances.length) { el.innerHTML = '<p class="hint">Nothing to check yet.</p>'; return; }
  if (!rows.length) { el.innerHTML = '<p class="ok">No conflicts. No warnings.</p>'; return; }
  el.innerHTML = '';
  for (const [cls, c] of rows) {
    const d = document.createElement('div'); d.className = 'cf ' + cls;
    d.innerHTML = `<b>${cls === 'bad' ? 'Conflict' : 'Warning'}</b> ${c.msg}` + (c.depth_mm ? ` <small>(${c.depth_mm} mm)</small>` : '');
    d.onclick = () => {
      const ids = [c.a, c.b].filter(Boolean), real = ids.find(i => asm.instances.some(x => x.id === i));
      sel = real || null; rebuild(); frameAll(ids);
    };
    el.appendChild(d);
  }
}

// ---------- save / load / export ----------
function download(data, file, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = file; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileBase = () => (asm.name || 'assembly').trim().replace(/[^\w.-]+/g, '_') || 'assembly';
function exportMesh(kind) {
  if (!asm.instances.length) { say('Nothing to export. Add a model first.', true); return; }
  try {
    const items = flatten(asm, lib).items;
    if (kind === 'glb') download(toGLB(items, asm.name), fileBase() + '.glb', 'model/gltf-binary');
    else download(toOBJ(items, asm.name), fileBase() + '.obj', 'text/plain');
    say(`Exported ${fileBase()}.${kind} (metres, Y-up).`);
  } catch (e) { say('Export failed: ' + e.message, true); }
}
$('#name').addEventListener('input', e => { asm.name = e.target.value; });
$('#btn-save').onclick = () => { download(serialize(asm), fileBase() + '.json', 'application/json'); say('Saved ' + fileBase() + '.json.'); };
$('#btn-load').onclick = () => $('#file').click();
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { asm = parse(await f.text(), lib); $('#name').value = asm.name; say(`Loaded ${f.name}.`); select(null); frameAll(); }
  catch (err) { say('Could not load: ' + err.message, true); }
});
$('#btn-glb').onclick = () => exportMesh('glb');
$('#btn-obj').onclick = () => exportMesh('obj');

// ---------- drawing sheet: plan, 4 elevations, 2 sections (DXF / SVG) ----------
// The line work comes from docs/vdraw-engine.js (a plain script loaded by index.html); core/engine/drawing.js feeds it the assembly.
const dlg = $('#draw');
const centreOf = axis => { const b = assemblyBounds(flatten(asm, lib).items), k = { x: 0, y: 1, z: 2 }[axis]; return Math.round((b.min[k] + b.max[k]) / 2); };
function openDrawing() {
  if (!asm.instances.length) { say('Nothing to draw. Add a model first.', true); return; }
  try { for (const n of ['A', 'B']) $('#cut' + n + '-pos').value = centreOf($('#cut' + n + '-axis').value); dlg.showModal(); }
  catch (e) { say('Drawing failed: ' + e.message, true); }
}
function makeSheet() {
  const cuts = ['A', 'B'].map(n => ({ axis: $('#cut' + n + '-axis').value, pos: parseFloat($('#cut' + n + '-pos').value) }));
  if (cuts.some(c => !Number.isFinite(c.pos))) throw new Error('Enter a number (mm) for each section position.');
  const parts = {}; for (const i of asm.instances) parts[i.component] = (parts[i.component] || 0) + 1;
  const engine = typeof vdBuild === 'function' ? { vdBuild } : null;
  return buildSheet(flatten(asm, lib).items, { title: 'ASSEMBLY', name: asm.name, cuts, parts }, engine);
}
function exportDrawing(kind) {
  say('Building the drawing sheet ...');
  setTimeout(() => {
    try {
      const sh = makeSheet();
      if (kind === 'dxf') download(vdDXF(sh), fileBase() + '-drawing.dxf', 'application/dxf');
      else download(sheetSVG(sh), fileBase() + '-drawing.svg', 'image/svg+xml');
      say(`Exported ${fileBase()}-drawing.${kind} (A3 sheet, scale 1:${sh.N}, mm).`);
    } catch (e) { say('Drawing failed: ' + e.message, true); }
  }, 30);
}
$('#btn-draw').onclick = openDrawing; $('#draw-close').onclick = () => dlg.close();
$('#draw-dxf').onclick = () => exportDrawing('dxf'); $('#draw-svg').onclick = () => exportDrawing('svg');
for (const n of ['A', 'B']) $('#cut' + n + '-axis').onchange = e => { try { $('#cut' + n + '-pos').value = centreOf(e.target.value); } catch (err) { say(err.message, true); } };

// ---------- header + keys ----------
$('#btn-frame').onclick = () => frameAll();
$('#btn-clear').onclick = () => { if (!asm.instances.length || confirm('Remove all objects from the scene?')) { asm = { name: 'Untitled', units: 'mm', instances: [], links: [] }; $('#name').value = asm.name; say(''); select(null); } };
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || $('#draw').open) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) remove(sel);
  if (e.key === 'Escape') select(null);
  const k = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, 1, 0], ArrowDown: [0, -1, 0], PageUp: [0, 0, 1], PageDown: [0, 0, -1] }[e.key];
  if (k && sel) { e.preventDefault(); nudge(k.map(v => v * step)); }
});

// ---------- start ----------
(async () => {
  try {
    const base = '../core/';
    const IDS = await fetch(base + 'library/components/manifest.json').then(r => { if (!r.ok) throw new Error('library/components/manifest.json (' + r.status + ')'); return r.json(); }).then(m => m.components);
    const [comps, pr, cr] = await Promise.all([
      Promise.all(IDS.map(id => fetch(base + 'library/components/' + id + '.json').then(r => { if (!r.ok) throw new Error(id + '.json (' + r.status + ')'); return r.json(); }))),
      fetch(base + 'rules/port-rules.json').then(r => r.json()),
      fetch(base + 'rules/conflict-rules.json').then(r => r.json())
    ]);
    comps.forEach(c => { lib[c.id] = c; }); rules = pr; crules = cr;
  } catch (e) { say('Could not load the model library: ' + e.message, true); }
  listModels(); updateCamera(); resize(); rebuild();
})();
