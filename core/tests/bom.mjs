// BOM test: quantities of the pump-station example, grouping rules, pipe length, rebar schedule, CSV and XLSX output.
// The XLSX is checked here with its own small ZIP reader, CRC and XML checks (no spreadsheet program is needed in Node).
import { readFileSync } from 'node:fs';
import { buildBOM, bomTables, toCSV, toXLSX } from '../engine/bom.js';
import { makeXlsx } from '../engine/xlsx.js';
const J = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const T = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const lib = {}; for (const id of J('library/components/manifest.json').components) lib[id] = J('library/components/' + id + '.json');
let fail = 0, n = 0;
const t = (name, cond, info = '') => { n++; if (!cond) { console.log('FAIL ' + name + (info ? '  ' + info : '')); fail++; } return cond; };
const clone = o => JSON.parse(JSON.stringify(o));
const inst = (id, component, params = {}, pos = [0, 0, 0]) => ({ id, component, params, pos, rot: [0, 0, 0] });
const asmOf = (...instances) => ({ name: 'T', units: 'mm', instances, links: [] });
const rowsOf = (bom, c) => bom.rows.filter(r => r.component === c);

// ---------- 1. known assembly: pump station line (12 objects) ----------
const pump = J('examples/pump-station-line.assembly.json');
const b = buildBOM(pump, lib);
t('pump line: 12 objects', b.instances === 12 && b.totals.parts === 12);
t('pump line: 11 lines', b.rows.length === 11, String(b.rows.length));
const EXPECT = { 'rcc-slab': [1], 'pump-plinth': [1], 'end-suction-pump': [1], 'dismantling-joint': [1], 'check-valve': [1], 'butterfly-valve': [1], 'gate-valve': [1], 'di-bend-90': [2], 'di-pipe-fl': [1, 1, 1] };
for (const [c, q] of Object.entries(EXPECT)) t(`pump line: ${c} quantities ${q}`, JSON.stringify(rowsOf(b, c).map(r => r.qty)) === JSON.stringify(q), JSON.stringify(rowsOf(b, c).map(r => r.qty)));
t('pump line: no other component', b.rows.every(r => r.component in EXPECT));
t('pump line: the two bends (turn up / turn left) are one line', rowsOf(b, 'di-bend-90').length === 1 && rowsOf(b, 'di-bend-90')[0].objects.join() === 'di-bend-90-1,di-bend-90-2');
t('pump line: quantities add up to the object count', b.rows.reduce((s, r) => s + r.qty, 0) === 12);
t('pump line: pipes are 1.2 / 1.5 / 2 m', JSON.stringify(rowsOf(b, 'di-pipe-fl').map(r => [r.unitLength_m, r.totalLength_m])) === '[[1.2,1.2],[1.5,1.5],[2,2]]');
t('pump line: total straight pipe length is exactly 4.7 m', b.totals.pipeLength_m === 4.7, String(b.totals.pipeLength_m));
t('pump line: only pipes have a length', b.rows.every(r => (r.component === 'di-pipe-fl') === (r.unitLength_m !== null && r.totalLength_m !== null)));
t('pump line: every flanged line is DN 200 / PN 16 (pump PN is its default)', b.rows.filter(r => r.dn !== null).every(r => r.dn === 200 && r.pn === 16) && b.rows.filter(r => r.dn !== null).length === 9);
t('pump line: slab and plinth show dimensions, no DN', JSON.stringify(rowsOf(b, 'rcc-slab').map(r => [r.dn, r.pn, r.dims])) === '[[null,null,"L 6000, W 5000, T 200"]]' && rowsOf(b, 'pump-plinth')[0].dims === 'L 720, W 700, T 150');
t('pump line: dismantling joint shows its adjustable length', rowsOf(b, 'dismantling-joint')[0].dims === 'FTF 300');
t('pump line: item numbers 1..11 in order', b.rows.every((r, i) => r.item === i + 1));
t('pump line: no rebar table', b.rebar === null && bomTables(b).length === 1);
t('pump line: nothing invented (no weight / price / kg field on any line)', b.rows.every(r => !Object.keys(r).some(k => /weight|price|cost|kg/i.test(k))));
t('pump line: result does not depend on object order', JSON.stringify(buildBOM({ ...pump, instances: [...pump.instances].reverse() }, lib).rows.map(r => [r.component, r.qty, r.dims])) === JSON.stringify(b.rows.map(r => [r.component, r.qty, r.dims])));

// ---------- 2. grouping rules ----------
let g = buildBOM(asmOf(inst('P1', 'di-pipe-fl', { DN: 200, len: 1500 }), inst('P2', 'di-pipe-fl', { DN: 200, len: 1500 }), inst('P3', 'di-pipe-fl', { DN: 200, len: 1000 }), inst('P4', 'di-pipe-fl', { DN: 300, len: 1500 })), lib);
t('same DN and length = one line, qty 2, total 3 m', g.rows.some(r => r.dn === 200 && r.unitLength_m === 1.5 && r.qty === 2 && r.totalLength_m === 3));
t('different length or DN = separate lines', g.rows.length === 3);
t('pipe length total sums every pipe line (2 x 1.5 + 1 + 1.5 = 5.5 m)', g.totals.pipeLength_m === 5.5, String(g.totals.pipeLength_m));
g = buildBOM(asmOf(inst('B1', 'di-bend-90', { DN: 200, turn: 'up' }), inst('B2', 'di-bend-90', { DN: 200, turn: 'down' }), inst('B3', 'di-bend-90', { DN: 200, turn: 'left' }), inst('B4', 'di-bend-90', { DN: 200, turn: 'right' }),
  inst('T1', 'di-tee', { DN: 200, branch: 'up' }), inst('T2', 'di-tee', { DN: 200, branch: 'left' }), inst('V1', 'gate-valve', { DN: 200, open: 0 }), inst('V2', 'gate-valve', { DN: 200, open: 1 })), lib);
t('bend turn, tee branch and gate "open" do not split lines', g.rows.length === 3 && g.rows.every(r => r.qty === (r.component === 'di-bend-90' ? 4 : 2)), JSON.stringify(g.rows.map(r => [r.component, r.qty])));
const dOpts = lib.door.parameters.design.options.map(o => (o !== null && typeof o === 'object' ? o.v : o));
g = buildBOM(asmOf(inst('D1', 'door', { openAngle: 0 }), inst('D2', 'door', { openAngle: 90 }), inst('D3', 'door', { design: dOpts[1] }), inst('D4', 'door', { W: 1000 })), lib);
t('door: open angle does not split, design or width does', g.rows.length === 3 && g.rows.some(r => r.qty === 2), JSON.stringify(g.rows.map(r => [r.dims, r.options.slice(0, 40), r.qty])));
t('door: options are listed as text', /Design: /.test(g.rows[0].options) && /Finish: /.test(g.rows[0].options) && /Width 900/.test(g.rows.find(r => r.qty === 2).dims));
g = buildBOM(asmOf(inst('C1', 'rcc-column', {}), inst('C2', 'rcc-column', { nx: 4, tieSpacing: 200 }), inst('C3', 'rcc-column', { H: 3500 })), lib);
t('column: rebar settings do not split a line, height does', g.rows.length === 2 && g.rows.some(r => r.qty === 2 && r.dims === 'b 300, h 450, H 3000'));
g = buildBOM(asmOf(inst('R1', 'di-reducer', { DN: 300, DN2: 200 })), lib);
t('reducer shows both sizes (DN column and DN2 in dimensions)', g.rows[0].dn === 300 && /DN2 200/.test(g.rows[0].dims), g.rows[0].dims);
g = buildBOM(asmOf(inst('X1', 'di-pipe', { OD: 324, len: 6000 })), lib);
t('plain pipe (no DN) shows OD and length', g.rows[0].dn === null && g.rows[0].dims === 'OD 324, len 6000' && g.rows[0].totalLength_m === 6 && g.totals.pipeLength_m === 6);
const e = buildBOM({ name: 'Empty', units: 'mm', instances: [], links: [] }, lib);
t('empty assembly: no lines, no length, still exports', e.rows.length === 0 && e.totals.parts === 0 && e.totals.pipeLength_m === null && toCSV(e).includes('Total number of parts') && toXLSX(e).length > 100);
let err = ''; try { buildBOM(asmOf(inst('Z', 'no-such-model')), lib); } catch (x) { err = x.message; }
t('unknown model: clear English error', /^Object Z uses an unknown model "no-such-model"\.$/.test(err), err);
err = ''; try { buildBOM(asmOf(inst('Z', 'di-pipe-fl', { DN: 300, len: 99999 })), lib); } catch (x) { err = x.message; }
t('out-of-range parameter: error names the object', /^Object Z: /.test(err), err);
// every component of the library (also future ones) can be listed with default sizes: adding a model needs no BOM code change
for (const id of Object.keys(lib)) {
  try { const r = buildBOM(asmOf(inst('A', id)), lib); t(`library: ${id} gives one BOM line`, r.rows.length === 1 && r.rows[0].qty === 1 && r.rows[0].name === lib[id].name && r.rows[0].component === id); }
  catch (x) { t(`library: ${id} gives one BOM line`, false, x.message); }
}
t('library: bom.ignore only names real parameters', Object.values(lib).every(c => (c.bom?.ignore || []).every(k => k in (c.parameters || {}))));

// ---------- 3. rebar schedule (second table) ----------
const col = J('examples/column-with-rebar.assembly.json');
const cb = buildBOM(col, lib);
t('column + cage: one column line', cb.rows.length === 1 && cb.rows[0].dims === 'b 300, h 450, H 3000' && cb.totals.parts === 1);
// by hand: 6 main bars of H - 2 x cover = 2920 mm; stirrups every 150 from z = -1385 up to 1452 -> 19, each 2 x (212 + 362) = 1148 mm
const [mainBars, stirrups] = cb.rebar.rows;
t('rebar: 6 main bars d16, 17.52 m, 27.65 kg', mainBars.kind === 'straight' && mainBars.dia === 16 && mainBars.count === 6 && mainBars.totalLength_m === 17.52 && mainBars.kg === 27.65, JSON.stringify(mainBars));
t('rebar: 19 stirrups d8, 21.812 m, 8.61 kg', stirrups.kind === 'stirrup' && stirrups.dia === 8 && stirrups.count === 19 && stirrups.totalLength_m === 21.812 && stirrups.kg === 8.61, JSON.stringify(stirrups));
t('rebar: totals 25 bars, 39.332 m, 36.26 kg', cb.rebar.totals.count === 25 && cb.rebar.totals.totalLength_m === 39.332 && cb.rebar.totals.kg === 36.26, JSON.stringify(cb.rebar.totals));
t('rebar: set and host named', cb.rebar.rows.every(r => r.set === 'C1-cage' && r.host === 'C1' && r.template === 'column-cage' && r.grade === 'tmt500'));
const two = clone(col); two.instances.push(inst('C2', 'rcc-column', { b: 300, h: 450, H: 3000 }, [3000, 0, 1500])); two.rebarSets.push({ id: 'C2-cage', host: 'C2', template: 'column-cage', minCover: 40 });
const tb = buildBOM(two, lib);
t('two columns + two sets: one column line qty 2, rebar rows per set, totals double', tb.rows.length === 1 && tb.rows[0].qty === 2 && tb.rebar.rows.length === 4 && tb.rebar.totals.count === 50 && tb.rebar.totals.totalLength_m === 78.664 && tb.rebar.sets === 2);
const bad = clone(col); bad.rebarSets[0].host = 'NOPE'; err = ''; try { buildBOM(bad, lib); } catch (x) { err = x.message; }
t('rebar set with a missing host: English error', /rebar set host not found: NOPE/.test(err), err);
t('tables: BOM first, Rebar schedule second', JSON.stringify(bomTables(cb).map(x => x.name)) === '["BOM","Rebar schedule"]');
t('tables: every row has one value per column', bomTables(cb).every(tb2 => [...tb2.rows, ...tb2.totals].every(r => r.length === tb2.columns.length)) && bomTables(b).every(tb2 => [...tb2.rows, ...tb2.totals].every(r => r.length === tb2.columns.length)));

// ---------- 4. CSV ----------
function parseCSV(s) { // small RFC 4180 reader, independent from the writer
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && s[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const csv = toCSV(b), cr = parseCSV(csv.replace(/^\ufeff/, ''));
t('csv: UTF-8 mark, CRLF lines, ends with a line break', csv.startsWith('\ufeff') && csv.endsWith('\r\n') && !/[^\r]\n/.test(csv));
t('csv: design name row', cr[0].join('|') === 'Design|Pump station line');
const hi = cr.findIndex(r => r[0] === 'Item');
t('csv: header', cr[hi].join('|') === 'Item|Component|Component id|DN|PN|Dimensions (mm)|Options|Qty|Unit length (m)|Total length (m)', cr[hi].join('|'));
const dataRows = cr.slice(hi + 1, hi + 12);
t('csv: 11 data rows with 10 cells', dataRows.length === 11 && dataRows.every(r => r.length === 10 && +r[0] > 0));
t('csv: bend row = qty 2', dataRows.some(r => r[2] === 'di-bend-90' && r[3] === '200' && r[4] === '16' && r[7] === '2' && r[8] === ''));
t('csv: pipe rows carry unit and total length', dataRows.filter(r => r[2] === 'di-pipe-fl').map(r => r[8] + '/' + r[9]).join() === '1.2/1.2,1.5/1.5,2/2');
t('csv: totals rows (12 parts, 4.7 m)', cr.some(r => r[1] === 'Total number of parts' && r[7] === '12') && cr.some(r => r[1] === 'Total straight pipe length (m)' && r[9] === '4.7'));
t('csv: no rebar table when there are no rebar sets', !csv.includes('Rebar schedule'));
const ccr = parseCSV(toCSV(cb).replace(/^\ufeff/, '')), ri = ccr.findIndex(r => r[0] === 'Rebar set');
t('csv: rebar table follows as a second table', ri > 0 && ccr[ri - 1][0] === 'Rebar schedule' && ccr[ri].join('|') === 'Rebar set|Host|Template|Bar type|Dia (mm)|Grade|Bars|Total length (m)|Weight (kg)');
t('csv: rebar rows and total', ccr[ri + 1].join('|') === 'C1-cage|C1|column-cage|straight|16|tmt500|6|17.52|27.65' && ccr[ri + 2].join('|') === 'C1-cage|C1|column-cage|stirrup|8|tmt500|19|21.812|8.61' && ccr[ri + 3].join('|') === 'Total||||||25|39.332|36.26');
const nasty = { ...pump, name: 'A "big", pump\nline' };
t('csv: commas, quotes and line breaks in the design name survive', parseCSV(toCSV(buildBOM(nasty, lib)).replace(/^\ufeff/, ''))[0][1] === 'A "big", pump\nline');
for (const bad2 of ['=1+1', '+SUM(A1)', '-2+3', '@cmd']) t('csv: design name "' + bad2 + '" cannot run as a formula', parseCSV(toCSV(buildBOM({ ...pump, name: bad2 }, lib)).replace(/^\ufeff/, ''))[0][1] === "'" + bad2);

// ---------- 5. XLSX ----------
const crcBit = bytes => { let c = 0xFFFFFFFF; for (const x of bytes) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return (c ^ 0xFFFFFFFF) >>> 0; };
function unzip(bytes) { // reads the central directory like any ZIP tool; checks sizes and CRC of every file
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = {};
  if (v.getUint32(bytes.length - 22, true) !== 0x06054b50) throw new Error('no end-of-directory record');
  const count = v.getUint16(bytes.length - 12, true); let p = v.getUint32(bytes.length - 6, true);
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('bad central header');
    const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), size = v.getUint32(p + 24, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl));
    if (v.getUint32(off, true) !== 0x04034b50) throw new Error('bad local header for ' + name);
    const data = bytes.subarray(off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true) + size);
    if (method !== 0 || data.length !== size || crcBit(data) !== crc) throw new Error('bad entry ' + name);
    out[name] = new TextDecoder().decode(data); p += 46 + nl + el + cl;
  }
  return out;
}
function wellFormed(xml) { // tag nesting + entity check (enough to catch a bad escape or a missing close tag)
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, ''); if (/<\?|<!/.test(body)) return false;
  if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(body)) return false;
  const st = []; let last = 0, m; const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
  while ((m = re.exec(body))) {
    if (/</.test(body.slice(last, m.index))) return false; last = re.lastIndex;
    if (m[4]) continue; if (m[1]) { if (st.pop() !== m[2]) return false; } else st.push(m[2]);
  }
  return st.length === 0 && !/</.test(body.slice(last)) && last > 0;
}
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function cells(xml) { const m = {}; for (const c of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>(.*?)<\/c>)/g)) { const s = c[2]; if (!s) continue; const tx = s.match(/<t[^>]*>(.*?)<\/t>/s); m[c[1]] = tx ? unesc(tx[1]) : +s.match(/<v>(.*?)<\/v>/)[1]; } return m; }
const xb = toXLSX(b), xf = unzip(xb);
t('xlsx: valid ZIP with the 6 parts of a workbook (CRC and sizes checked)', JSON.stringify(Object.keys(xf).sort()) === JSON.stringify(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']), Object.keys(xf).join());
t('xlsx: every XML part is well-formed', Object.entries(xf).every(([k, v2]) => wellFormed(v2) || (console.log('   not well-formed: ' + k), false)));
t('xlsx: one sheet named BOM when there is no rebar', /<sheet name="BOM" sheetId="1" r:id="rId1"\/>/.test(xf['xl/workbook.xml']) && !/sheetId="2"/.test(xf['xl/workbook.xml']));
const s1 = cells(xf['xl/worksheets/sheet1.xml']);
t('xlsx: title, header', s1.A1 === 'Bill of materials - Pump station line' && s1.A3 === 'Item' && s1.J3 === 'Total length (m)' && s1.H3 === 'Qty');
t('xlsx: numbers are numbers, text is text', s1.A4 === 1 && s1.B4 === 'RCC slab (flat)' && s1.C4 === 'rcc-slab' && s1.H4 === 1 && s1.F4 === 'L 6000, W 5000, T 200');
const rowOf = id => Object.keys(s1).filter(k => k.startsWith('C') && s1[k] === id).map(k => k.slice(1));
const bendRow = rowOf('di-bend-90')[0];
t('xlsx: bend row DN 200, PN 16, qty 2', s1['D' + bendRow] === 200 && s1['E' + bendRow] === 16 && s1['H' + bendRow] === 2 && s1['I' + bendRow] === undefined);
t('xlsx: pipe rows 1.2 / 1.5 / 2 m', rowOf('di-pipe-fl').map(r => s1['J' + r]).join() === '1.2,1.5,2');
t('xlsx: total parts 12 and total pipe 4.7 m', Object.keys(s1).some(k => s1[k] === 'Total number of parts' && s1['H' + k.slice(1)] === 12) && Object.keys(s1).some(k => s1[k] === 'Total straight pipe length (m)' && s1['J' + k.slice(1)] === 4.7));
t('xlsx: notes are on the sheet', Object.values(s1).some(x => typeof x === 'string' && x.startsWith('No weights or prices')));
t('xlsx: same input, same bytes', Buffer.compare(Buffer.from(toXLSX(b)), Buffer.from(xb)) === 0);
const xc = unzip(toXLSX(cb)), wb = xc['xl/workbook.xml'];
t('xlsx with rebar: second sheet "Rebar schedule"', /<sheet name="BOM" sheetId="1" r:id="rId1"\/><sheet name="Rebar schedule" sheetId="2" r:id="rId2"\/>/.test(wb) && 'xl/worksheets/sheet2.xml' in xc && Object.values(xc).every(wellFormed));
const s2 = cells(xc['xl/worksheets/sheet2.xml']);
t('xlsx rebar sheet: header, rows, total', s2.A3 === 'Rebar set' && s2.G3 === 'Bars' && s2.G4 === 6 && s2.H4 === 17.52 && s2.I4 === 27.65 && s2.G5 === 19 && s2.H5 === 21.812 && s2.I5 === 8.61 && s2.A6 === 'Total' && s2.G6 === 25 && s2.H6 === 39.332 && s2.I6 === 36.26, JSON.stringify(s2).slice(0, 300));
const xe = unzip(toXLSX(buildBOM({ ...pump, name: 'R&D <pump> "A"\u0001' }, lib))), se = cells(xe['xl/worksheets/sheet1.xml']);
t('xlsx: & < > " and control characters in the design name stay valid XML', Object.values(xe).every(wellFormed) && se.A1 === 'Bill of materials - R&D <pump> "A"');
const xf2 = unzip(toXLSX(buildBOM({ ...pump, name: '=1+1' }, lib)));
t('xlsx: text that looks like a formula is stored as text', /t="inlineStr"[^>]*><is><t[^>]*>Bill of materials - =1\+1<\/t>/.test(xf2['xl/worksheets/sheet1.xml']) && !/<f>/.test(xf2['xl/worksheets/sheet1.xml']));
for (const nm of ['', 'a/b', 'a[1]', 'x'.repeat(32)]) { let thrown = false; try { makeXlsx([{ name: nm, rows: [] }]); } catch { thrown = true; } t(`xlsx: sheet name "${nm}" is rejected`, thrown); }
let dup = false; try { makeXlsx([{ name: 'A', rows: [] }, { name: 'a', rows: [] }]); } catch { dup = true; } t('xlsx: duplicate sheet names are rejected', dup);
const many = asmOf(...Array.from({ length: 800 }, (_, i) => inst('P' + i, 'di-pipe-fl', { DN: 200, len: 300 + (i % 40) * 10 })));
const mb = buildBOM(many, lib); t('800 objects: 40 lines, total 800 parts', mb.rows.length === 40 && mb.totals.parts === 800 && Object.values(unzip(toXLSX(mb))).every(wellFormed));

// ---------- 6. page wiring (static checks only: a browser is needed for the real click test) ----------
const html = T('../app/index.html'), js = T('../app/studio.js');
t('page: BOM button in the header, BOM dialog, CSV and XLSX buttons', /id="btn-bom"[^>]*>BOM</.test(html) && /<dialog id="bom"/.test(html) && /id="bom-csv"/.test(html) && /id="bom-xlsx"/.test(html));
t('page: Studio imports the BOM engine and wires the buttons', /from '\.\.\/core\/engine\/bom\.js'/.test(js) && /\$\('#btn-bom'\)\.onclick/.test(js) && /\$\('#bom-csv'\)\.onclick/.test(js) && /\$\('#bom-xlsx'\)\.onclick/.test(js));
t('page: arrow keys do not move parts while the BOM dialog is open', /\$\('#bom'\)\.open/.test(js));
for (const [f, s] of [['app/index.html', html], ['app/studio.js', js], ['core/engine/bom.js', T('engine/bom.js')], ['core/engine/xlsx.js', T('engine/xlsx.js')]]) t(`${f}: ASCII only (software text is English)`, /^[\x00-\x7F]*$/.test(s));

console.log(fail ? `${fail} FAILED of ${n}` : `all passed (${n} checks)`); process.exit(fail ? 1 : 0);
