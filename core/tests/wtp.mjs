// Water treatment library: structure, units, expert-rule evaluator.
import { loadWtp } from '../engine/wtp/node-loader.mjs';
import { buildRegistry, validate, coverage, explain } from '../engine/wtp/registry.js';
import { convert, degFtoC } from '../engine/wtp/units.js';
let fail = 0; const t = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const clone = o => JSON.parse(JSON.stringify(o));

const data = loadWtp(), reg = buildRegistry(data);
const errs = validate(reg);
t('library validates', errs.length === 0, errs.slice(0, 3).join(' | '));
const cov = coverage(reg);
t('every stage has types, calcs and a model folder', data.stages.every(s => s.groups.length && data.calcs[s.id].length && s.modelPath));
t('both models present (intake and treatment-plant)', new Set(data.stages.map(s => s.model)).size === 2);
t('assessments cover physical, chemical, biological and engineering', ['physical', 'chemical', 'biological', 'engineering'].every(c => data.assessments.some(a => a.category === c)));
t('Parshall flume is the only type past data level, with sources, implemented calcs and written gaps', reg.types.get('rapid-mix-and-measurement.parshall-flume').status === 'model3d' && cov.byStatus.model3d === 1 && cov.byStatus.data === 0 && reg.types.get('rapid-mix-and-measurement.parshall-flume').gaps.length >= 3);

// validator catches broken input
let bad = clone(data); bad.rules[0].type = 'nope.nothing';
t('validator: rule with unknown type is rejected', validate(buildRegistry(bad)).some(x => x.includes('unknown type')));
bad = clone(data); bad.rules[0].source = { ref: 'MISSING', loc: 'p1' };
t('validator: sourced rule needs a known reference', validate(buildRegistry(bad)).some(x => x.includes('sourced rule')));
bad = clone(data); bad.stages[0].groups[0].types[0].status = 'data';
t('validator: data-level type needs definition and sources', validate(buildRegistry(bad)).some(x => x.includes('needs definition')));
bad = clone(data); bad.calcs['screening'][0].outputs = [];
t('validator: calculation needs outputs', validate(buildRegistry(bad)).some(x => x.includes('needs inputs and outputs')));
bad = clone(data); bad.stages[1].groups[0].types[0].id = bad.stages[0].groups[0].types[0].id;
t('validator: type ids unique across stages', validate(buildRegistry(bad)).some(x => x.includes('must be unique')));

bad = clone(data); bad.calcs['rapid-mix-and-measurement'].find(c => c.id === 'parshall-free-flow').sources = [];
t('validator: a tested calculation needs a source', validate(buildRegistry(bad)).some(x => x.includes('needs a source')));
bad = clone(data); bad.calcs['rapid-mix-and-measurement'].find(c => c.id === 'parshall-free-flow').status = 'planned';
t('validator: a type above data level cannot list an unimplemented calculation as done', validate(buildRegistry(bad)).some(x => x.includes('not implemented')));
bad = clone(data); delete bad.stages.find(s => s.id === 'rapid-mix-and-measurement').groups[0].types[0].model;
t('validator: model3d needs a page path', validate(buildRegistry(bad)).some(x => x.includes('needs a model page path')));

// units
t('units: 1 cfs ~ 450 gpm (the Utah report rounds to 450)', near(convert(1, 'cfs', 'gpm_us'), 448.83, 0.01));
t('units: 27.0 cfs = 0.7646 m3/s', near(convert(27, 'cfs', 'm3/s'), 0.76455, 0.0001));
t('units: 5 MLD = 5000 m3/d', near(convert(5, 'MLD', 'm3/d'), 5000, 1e-9));
t('units: 2.19 ft = 0.6675 m', near(convert(2.19, 'ft', 'm'), 0.667512, 1e-6));
t('units: 1 mgd (US) = 3785.411784 m3/d', near(convert(1, 'mgd_us', 'm3/d'), 3785.411784, 1e-6));
t('units: round trip ft -> m -> ft', near(convert(convert(7.3, 'ft', 'm'), 'm', 'ft'), 7.3, 1e-12));
let threw = false; try { convert(1, 'm', 'kg'); } catch { threw = true; }
t('units: dimension mismatch throws', threw);
t('units: 80 degC = 176 degF check inverse', near(degFtoC(176), 80, 1e-12));

// expert layer on the Parshall flume
const K = 'rapid-mix-and-measurement.parshall-flume';
const bad1 = explain(reg, K, { Hb_over_Ha: 0.75, transition_submergence: 0.68, distance_from_bend_in_W: 8, debris_size_over_W: 0.9, near_gate: true, throat_over_channel_width: 0.7, water_temperature: 20 });
const ids = bad1.warnings.map(w => w.id).sort().join(',');
t('explain: bad installation raises submerged, 0.7 limit, bend, gate, debris and throat-ratio flags', ids === 'PF-CHK-001,PF-CHK-002,PF-CHK-003,PF-CHK-004,PF-CHK-005,PF-CHK-006', ids);
const ok1 = explain(reg, K, { Hb_over_Ha: 0.5, transition_submergence: 0.66, distance_from_bend_in_W: 20, debris_size_over_W: 0.3, near_gate: false, throat_over_channel_width: 0.4, water_temperature: 20 });
t('explain: good installation raises no warnings', ok1.warnings.length === 0);
t('explain: reasons for use and a limitation are always given, each with a source', ok1.why.length >= 3 && ok1.whyNot.length >= 1 && [...ok1.why, ...ok1.whyNot].every(x => x.source && x.source.ref && x.source.loc));
const none = explain(reg, K, {});
t('explain: missing inputs are reported, not guessed', none.warnings.length === 0 && none.missingInputs.length >= 5);
t('explain: submergence equal to the transition value raises nothing, above it raises the submerged flag', explain(reg, K, { Hb_over_Ha: 0.68, transition_submergence: 0.68 }).warnings.length === 0 && explain(reg, K, { Hb_over_Ha: 0.7, transition_submergence: 0.68 }).warnings.some(w => w.id === 'PF-CHK-001'));
t('explain: throat ratio on either side of 1/3..1/2 flags (OR rule)', explain(reg, K, { throat_over_channel_width: 0.2 }).warnings.some(w => w.id === 'PF-CHK-006') && explain(reg, K, { throat_over_channel_width: 0.6 }).warnings.some(w => w.id === 'PF-CHK-006') && !explain(reg, K, { throat_over_channel_width: 0.4 }).warnings.some(w => w.id === 'PF-CHK-006'));
t('explain: every shipped rule is unreviewed until a person confirms it', data.rules.every(r => r.reviewed === false));
console.log(fail ? `\n${fail} FAILED` : '\nALL WTP TESTS PASSED'); process.exit(fail ? 1 : 0);
