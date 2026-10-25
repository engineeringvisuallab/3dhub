// Bill of materials (BOM) / quantity list of an assembly. Pure functions: no DOM, runs in Node and in the browser.
//
//   buildBOM(assembly, library)  -> { name, instances, rows, totals, rebar }     (the numbers)
//   bomTables(bom)               -> [ { name, title, columns, rows, totals, notes } ]   (one source for the screen, CSV and XLSX)
//   toCSV(bom) -> string         toXLSX(bom) -> Uint8Array
//
// What is counted and what is NOT invented:
// - One line per model + size. Two objects are the same line when every parameter that defines the part is equal.
//   A component json may list parameters that only describe pose or reinforcement in  "bom": { "ignore": [ ... ] }
//   (bend "turn", tee "branch", gate valve "open", door "openAngle", column rebar settings), so those do not split a line.
// - Length is given only for straight pipe: a component tagged "pipe" with a numeric parameter "len" (mm).
//   Bends, tees, valves, walls ... get no length. The library has no weight or price data, so none is given.
// - Rebar sets use the existing bar schedule (rebar.js): count, centre-line length and kg (d*d/162.2 per metre).
import { resolveParams, flatten } from './assembly.js';
import { schedule } from './rebar.js';
import { makeXlsx } from './xlsx.js';

const collator = new Intl.Collator('en', { numeric: true });
const r6 = v => Math.round(v * 1e6) / 1e6, r2 = v => Math.round(v * 100) / 100;
const num = v => +(+v).toFixed(3);
const isChoice = d => Array.isArray(d?.options);
const optVal = o => (o !== null && typeof o === 'object' ? o.v : o);
const optText = (d, v) => { const o = d.options.find(x => optVal(x) === v); return o !== null && typeof o === 'object' ? String(o.label ?? o.v) : String(v); };

export function buildBOM(assembly, library) {
  const groups = new Map();
  for (const inst of assembly.instances || []) {
    const comp = library[inst.component];
    if (!comp) throw new Error(`Object ${inst.id} uses an unknown model "${inst.component}".`);
    let p;
    try { p = resolveParams(comp, inst.params || {}); } catch (e) { throw new Error(`Object ${inst.id}: ${e.message}`); }
    const ignore = new Set(comp.bom?.ignore || []);
    const defs = Object.entries(comp.parameters || {}).filter(([k]) => !ignore.has(k));
    const key = comp.id + '|' + JSON.stringify(defs.map(([k]) => p[k]));
    let g = groups.get(key);
    if (!g) {
      const label = (k, d) => d.short || k;
      const unit = d => (d.unit && d.unit !== 'mm' ? ' ' + d.unit : '');
      const dims = defs.filter(([k, d]) => !isChoice(d) && k !== 'DN' && k !== 'PN' && typeof p[k] === 'number').map(([k, d]) => `${label(k, d)} ${num(p[k])}${unit(d)}`).join(', ');
      const options = defs.filter(([, d]) => isChoice(d)).map(([k, d]) => `${label(k, d)}: ${optText(d, p[k])}`).join(', ');
      const isPipe = (comp.tags || []).includes('pipe') && typeof p.len === 'number' && p.len > 0;
      g = {
        component: comp.id, name: comp.name, category: comp.category || '',
        dn: defs.some(([k]) => k === 'DN') && typeof p.DN === 'number' ? p.DN : null,
        pn: defs.some(([k]) => k === 'PN') && typeof p.PN === 'number' ? p.PN : null,
        dims, options, qty: 0, unitLength_mm: isPipe ? p.len : null, objects: []
      };
      groups.set(key, g);
    }
    g.qty++; g.objects.push(inst.id);
  }
  const sortKey = g => `${g.dn ?? ''} ${g.pn ?? ''} ${g.dims} ${g.options}`;
  const list = [...groups.values()].sort((a, b) => collator.compare(a.category, b.category) || collator.compare(a.component, b.component) || collator.compare(sortKey(a), sortKey(b)));
  let pipe_mm = 0, parts = 0;
  const rows = list.map((g, i) => {
    parts += g.qty;
    const total_mm = g.unitLength_mm === null ? null : g.unitLength_mm * g.qty;
    if (total_mm !== null) pipe_mm += total_mm;
    const { unitLength_mm, ...rest } = g;
    return { item: i + 1, ...rest, unitLength_m: unitLength_mm === null ? null : r6(unitLength_mm / 1000), totalLength_m: total_mm === null ? null : r6(total_mm / 1000) };
  });
  const hasPipe = rows.some(r => r.unitLength_m !== null);
  return { name: assembly.name || 'Untitled', instances: (assembly.instances || []).length, rows, totals: { parts, pipeLength_m: hasPipe ? r6(pipe_mm / 1000) : null }, rebar: buildRebar(assembly, library) };
}

// Bar schedule per rebar set, using schedule() from rebar.js. null when the assembly has no rebar sets.
function buildRebar(assembly, library) {
  const sets = assembly.rebarSets || [];
  if (!sets.length) return null;
  const { bars } = flatten(assembly, library);
  const rows = []; let count = 0, len_mm = 0, kg = 0;
  for (const rs of sets) {
    for (const s of schedule(bars.filter(b => b.set === rs.id))) {
      rows.push({ set: rs.id, host: rs.host, template: rs.template, kind: s.kind, dia: s.dia, grade: s.grade, count: s.count, totalLength_m: r6(s.totalLen_mm / 1000), kg: r2(s.kg) });
      count += s.count; len_mm += s.totalLen_mm; kg += s.kg;
    }
  }
  return { sets: sets.length, rows, totals: { count, totalLength_m: r6(len_mm / 1000), kg: r2(kg) } };
}

// ---------- tables (what the dialog shows, and what CSV / XLSX contain) ----------
export function bomTables(bom) {
  const n = v => (v === null || v === undefined ? '' : v);
  const t1 = {
    name: 'BOM', title: 'Bill of materials',
    columns: [
      { h: 'Item', num: true, w: 6 }, { h: 'Component', w: 40 }, { h: 'Component id', w: 20 }, { h: 'DN', num: true, w: 7 }, { h: 'PN', num: true, w: 7 },
      { h: 'Dimensions (mm)', w: 34 }, { h: 'Options', w: 44 }, { h: 'Qty', num: true, w: 7 }, { h: 'Unit length (m)', num: true, w: 15 }, { h: 'Total length (m)', num: true, w: 16 }
    ],
    rows: bom.rows.map(r => [r.item, r.name, r.component, n(r.dn), n(r.pn), r.dims, r.options, r.qty, n(r.unitLength_m), n(r.totalLength_m)]),
    totals: [['', 'Total number of parts', '', '', '', '', '', bom.totals.parts, '', '']],
    notes: [
      'Objects with the same model and the same sizes are one line. Settings that only turn or pose a part (bend turn, tee branch, valve open, door open angle) do not split a line.',
      'DN / PN and dimensions come from the model parameters. Dimensions are in mm unless a unit is shown.',
      'Length is given only for straight pipe (bends, tees, valves and other fittings are counted, not measured).',
      'No weights or prices are given for library parts: the library holds no weight or price data.'
    ]
  };
  if (bom.totals.pipeLength_m !== null) t1.totals.push(['', 'Total straight pipe length (m)', '', '', '', '', '', '', '', bom.totals.pipeLength_m]);
  const out = [t1];
  if (bom.rebar) {
    out.push({
      name: 'Rebar schedule', title: 'Rebar schedule',
      columns: [
        { h: 'Rebar set', w: 18 }, { h: 'Host', w: 16 }, { h: 'Template', w: 14 }, { h: 'Bar type', w: 10 }, { h: 'Dia (mm)', num: true, w: 10 }, { h: 'Grade', w: 10 },
        { h: 'Bars', num: true, w: 8 }, { h: 'Total length (m)', num: true, w: 16 }, { h: 'Weight (kg)', num: true, w: 12 }
      ],
      rows: bom.rebar.rows.map(r => [r.set, r.host, r.template, r.kind, r.dia, r.grade, r.count, r.totalLength_m, r.kg]),
      totals: [['Total', '', '', '', '', '', bom.rebar.totals.count, bom.rebar.totals.totalLength_m, bom.rebar.totals.kg]],
      notes: [
        'Rebar comes from the rebar sets of the design. Lengths are bar centre-line lengths taken from the model: no hooks, laps or bend allowance are added.',
        'Weight = dia x dia / 162.2 kg per metre of bar. Check the result before ordering or cutting steel.'
      ]
    });
  }
  return out;
}

// ---------- CSV ----------
// Spreadsheet programs run a text cell that starts with = + - @ as a formula, so such text gets a leading apostrophe.
function csvCell(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function toCSV(bom) {
  const lines = [['Design', bom.name]];
  for (const t of bomTables(bom)) {
    lines.push([], [t.title], t.columns.map(c => c.h), ...t.rows, ...t.totals);
    if (t.notes.length) lines.push([], ['Notes'], ...t.notes.map(x => [x]));
  }
  return '\ufeff' + lines.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; // BOM char: Excel reads the file as UTF-8
}

// ---------- XLSX ----------
export function toXLSX(bom) {
  const sheets = bomTables(bom).map(t => {
    const rows = [[t.title + ' - ' + bom.name], [], t.columns.map(c => c.h), ...t.rows, ...t.totals];
    const rowStyles = { 0: 'bold', 2: 'header' };
    for (let i = 0; i < t.totals.length; i++) rowStyles[3 + t.rows.length + i] = 'bold';
    if (t.notes.length) { rows.push([], ['Notes'], ...t.notes.map(x => [x])); rowStyles[3 + t.rows.length + t.totals.length + 1] = 'bold'; }
    return { name: t.name, rows, widths: t.columns.map(c => c.w), rowStyles };
  });
  return makeXlsx(sheets);
}
