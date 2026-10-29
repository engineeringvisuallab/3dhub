// Water treatment library registry, expert-rule evaluator and validator. Pure JS, no I/O: callers pass already-loaded JSON.
// data = { stages:[stage], refs:[ref], rules:[rule], calcs:{stageId:[calc]}, assessments:[assessment], profiles:{index, files} }
export const STATUS_LEVELS = ['listed', 'data', 'calc', 'model3d', 'drawings', 'tested'];
const KINDS = ['why-use', 'limitation', 'design-check', 'installation', 'construction', 'operation', 'selection'];
const SEVERITIES = ['info', 'caution', 'warning', 'critical'];
const CONFIDENCE = ['sourced', 'practice-unverified', 'owner-experience'];
const OPS = { '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b, '==': (a, b) => a === b, '!=': (a, b) => a !== b };
export const typeKey = (stageId, typeId) => stageId + '.' + typeId;

export function buildRegistry(data) {
  const types = new Map(), stages = new Map(), refs = new Map(), calcs = new Map(), rulesByType = new Map();
  for (const s of data.stages) {
    stages.set(s.id, s);
    for (const g of s.groups) for (const t of g.types) types.set(typeKey(s.id, t.id), { ...t, stage: s.id, group: g.id });
  }
  for (const r of data.refs) refs.set(r.id, r);
  for (const [sid, list] of Object.entries(data.calcs || {})) for (const c of list) calcs.set(sid + '.' + c.id, { ...c, scope: 'stage', owner: sid });
  for (const a of data.assessments || []) for (const c of a.calculations) calcs.set(a.id + '.' + c.id, { ...c, scope: 'assessment', owner: a.id });
  for (const r of data.rules || []) { if (!rulesByType.has(r.type)) rulesByType.set(r.type, []); rulesByType.get(r.type).push(r); }
  return { data, types, stages, refs, calcs, rulesByType };
}

export function coverage(reg) {
  const byStatus = Object.fromEntries(STATUS_LEVELS.map(s => [s, 0])), byStage = [];
  for (const s of reg.data.stages) {
    const row = { stage: s.id, name: s.name, model: s.model, types: 0, byStatus: Object.fromEntries(STATUS_LEVELS.map(x => [x, 0])), calcs: (reg.data.calcs[s.id] || []).length, rules: 0 };
    for (const g of s.groups) for (const t of g.types) { row.types++; row.byStatus[t.status]++; byStatus[t.status]++; }
    for (const [k, list] of reg.rulesByType) if (k.startsWith(s.id + '.')) row.rules += list.length;
    byStage.push(row);
  }
  return { types: reg.types.size, byStatus, byStage, stageCalcs: [...reg.calcs.values()].filter(c => c.scope === 'stage').length, assessmentCalcs: [...reg.calcs.values()].filter(c => c.scope === 'assessment').length, rules: (reg.data.rules || []).length };
}

function evalCond(c, ctx) {
  if (!(c.field in ctx)) return { known: false };
  const lhs = ctx[c.field];
  let rhs = c.value;
  if (c.ref !== undefined) { if (!(c.ref in ctx)) return { known: false, need: c.ref }; rhs = ctx[c.ref]; }
  return { known: true, ok: OPS[c.op](lhs, rhs) };
}
// Expert layer: which rules apply to this type in this situation, and why. Rules whose inputs are missing are reported, never guessed.
export function explain(reg, key, ctx = {}) {
  const out = { type: reg.types.get(key) || null, why: [], whyNot: [], warnings: [], notes: [], missingInputs: [] };
  if (!out.type) throw new Error('unknown type: ' + key);
  for (const r of reg.rulesByType.get(key) || []) {
    const all = r.when || [], any = r.whenAny || [];
    let applies = true, missing = [];
    for (const c of all) { const e = evalCond(c, ctx); if (!e.known) { missing.push(e.need || c.field); applies = false; } else if (!e.ok) applies = false; }
    if (any.length) {
      let anyOk = false, anyKnown = false;
      for (const c of any) { const e = evalCond(c, ctx); if (!e.known) missing.push(e.need || c.field); else { anyKnown = true; if (e.ok) anyOk = true; } }
      if (!anyOk) applies = false;
      if (anyOk) missing = missing.filter(m => !any.some(c => c.field === m || c.ref === m));
    }
    if (!applies) { if (missing.length) out.missingInputs.push({ rule: r.id, inputs: [...new Set(missing)] }); continue; }
    const item = { id: r.id, severity: r.severity, text: r.text, because: r.because, source: r.source, confidence: r.confidence, reviewed: r.reviewed };
    if (r.kind === 'why-use') out.why.push(item);
    else if (r.kind === 'limitation') out.whyNot.push(item);
    else if (r.kind === 'design-check' || r.kind === 'selection') out.warnings.push(item);
    else out.notes.push(item);
  }
  return out;
}

// Returns a list of error strings; an empty list means the library is structurally sound.
export function validate(reg) {
  const e = [], d = reg.data;
  const seenStage = new Set();
  d.stages.forEach(s => {
    if (seenStage.has(s.id)) e.push('duplicate stage id: ' + s.id); seenStage.add(s.id);
    if (!['intake', 'treatment-plant'].includes(s.model)) e.push(`stage ${s.id}: model must be intake or treatment-plant`);
    if (!s.modelPath) e.push(`stage ${s.id}: missing modelPath`);
    if (!s.refs.length && !s.needsReference) e.push(`stage ${s.id}: no references and not flagged needsReference`);
    for (const r of s.refs) if (!reg.refs.has(r.ref)) e.push(`stage ${s.id}: unknown reference ${r.ref}`);
    const gids = new Set();
    for (const g of s.groups) {
      if (gids.has(g.id)) e.push(`stage ${s.id}: duplicate group ${g.id}`); gids.add(g.id);
      if (!g.types.length) e.push(`stage ${s.id}.${g.id}: empty group`);
      const tids = new Set();
      for (const t of g.types) {
        if (tids.has(t.id)) e.push(`stage ${s.id}.${g.id}: duplicate type ${t.id}`); tids.add(t.id);
        if (!STATUS_LEVELS.includes(t.status)) e.push(`${s.id}.${t.id}: bad status ${t.status}`);
        if (STATUS_LEVELS.indexOf(t.status) >= 1) {
          for (const f of ['definition', 'how']) if (!t[f]) e.push(`${s.id}.${t.id}: status ${t.status} needs ${f}`);
          for (const f of ['suits', 'avoid', 'sources']) if (!Array.isArray(t[f]) || !t[f].length) e.push(`${s.id}.${t.id}: status ${t.status} needs ${f}`);
          for (const so of t.sources || []) if (!reg.refs.has(so.ref)) e.push(`${s.id}.${t.id}: unknown source ${so.ref}`);
          for (const c of [...(t.calcs || []), ...(t.plannedCalcs || [])]) if (!reg.calcs.has(c)) e.push(`${s.id}.${t.id}: unknown calc ${c}`);
          if (STATUS_LEVELS.indexOf(t.status) >= 2) {
            if (!(t.calcs || []).length) e.push(`${s.id}.${t.id}: status ${t.status} needs implemented calcs`);
            for (const c of t.calcs || []) { const cc = reg.calcs.get(c); if (cc && !['implemented', 'tested'].includes(cc.status)) e.push(`${s.id}.${t.id}: calc ${c} is ${cc.status}, not implemented`); }
            for (const c of t.plannedCalcs || []) { const cc = reg.calcs.get(c); if (cc && ['implemented', 'tested'].includes(cc.status)) e.push(`${s.id}.${t.id}: calc ${c} is done but still listed as planned`); }
            if ((t.plannedCalcs || []).length && !(t.gaps || []).length) e.push(`${s.id}.${t.id}: planned calcs must be explained in gaps`);
          }
          if (STATUS_LEVELS.indexOf(t.status) >= 3 && !t.model) e.push(`${s.id}.${t.id}: status ${t.status} needs a model page path`);
        }
      }
    }
  });
  const seenTypeIds = new Map();
  for (const [k] of reg.types) { const [st, id] = k.split('.'); if (seenTypeIds.has(id)) e.push(`type id "${id}" is used in both ${seenTypeIds.get(id)} and ${st}; ids must be unique across stages`); seenTypeIds.set(id, st); }
  for (const sid of Object.keys(d.calcs)) if (!reg.stages.has(sid)) e.push('calcs for unknown stage ' + sid);
  const calcIds = new Set();
  for (const [k, c] of reg.calcs) {
    if (calcIds.has(k)) e.push('duplicate calc ' + k); calcIds.add(k);
    if (!c.inputs.length || !c.outputs.length) e.push(`calc ${k}: needs inputs and outputs`);
    if (!c.name) e.push(`calc ${k}: missing name`);
    for (const so of c.sources || []) if (!reg.refs.has(so.ref)) e.push(`calc ${k}: unknown source ${so.ref}`);
    if (['implemented', 'tested'].includes(c.status) && !(c.sources || []).length) e.push(`calc ${k}: ${c.status} calculation needs a source`);
    if (c.status === 'tested' && !(c.tests || []).length) e.push(`calc ${k}: tested calculation needs test file(s)`);
  }
  for (const s of d.stages) if (!(d.calcs[s.id] || []).length) e.push(`stage ${s.id}: no calculations listed`);
  for (const a of d.assessments) { if (!a.purpose || !a.category) e.push(`assessment ${a.id}: needs purpose and category`); if (!a.calculations.length) e.push(`assessment ${a.id}: no calculations`); }
  const ruleIds = new Set();
  for (const r of d.rules) {
    if (ruleIds.has(r.id)) e.push('duplicate rule ' + r.id); ruleIds.add(r.id);
    if (!reg.types.has(r.type)) e.push(`rule ${r.id}: unknown type ${r.type}`);
    if (!KINDS.includes(r.kind)) e.push(`rule ${r.id}: bad kind ${r.kind}`);
    if (!SEVERITIES.includes(r.severity)) e.push(`rule ${r.id}: bad severity ${r.severity}`);
    if (!CONFIDENCE.includes(r.confidence)) e.push(`rule ${r.id}: bad confidence ${r.confidence}`);
    if (!r.text || !r.because) e.push(`rule ${r.id}: needs text and because`);
    if (r.confidence === 'sourced' && (!r.source || !reg.refs.has(r.source.ref) || !r.source.loc)) e.push(`rule ${r.id}: sourced rule needs a known reference and location`);
    for (const c of [...(r.when || []), ...(r.whenAny || [])]) { if (!OPS[c.op]) e.push(`rule ${r.id}: bad operator ${c.op}`); if ((c.value === undefined) === (c.ref === undefined)) e.push(`rule ${r.id}: condition needs exactly one of value or ref`); }
  }
  if (d.profiles) for (const p of d.profiles.index.profiles) {
    if (p.file && !d.profiles.files[p.file]) e.push(`profile ${p.id}: file ${p.file} not loaded`);
    if (!p.file && p.status !== 'needs-reference') e.push(`profile ${p.id}: no file`);
    if (p.file) for (const so of d.profiles.files[p.file].sources || []) if (!reg.refs.has(so)) e.push(`profile ${p.id}: unknown source ${so}`);
  }
  return e;
}
