// Parshall flume calculations. Pure JS, no imports, so tools/build-parshall-page.mjs can embed this file in the model page.
// Data comes from core/library/wtp/data/parshall.json (Utah EC-323 Tables 1-3 and the Arkon guide). SI in, SI out.
const PF_FT = 0.3048, PF_IN = 0.0254, PF_CFS = 0.028316846592;

export function pfSizeIds(data) { return data.utah.sizes.map(s => s.id); }
export function pfSize(data, id) { const s = data.utah.sizes.find(x => x.id === id); if (!s) throw new Error('unknown Parshall size: ' + id); return s; }
export function pfThroatWidth(data, id) { return pfSize(data, id).W_in * PF_IN; }

// Free-flow discharge from the upstream head Ha (metres in, m3/s out). inRange tells whether Ha lies inside the printed Table 3 range for this size.
export function pfFreeFlow(data, id, Ha_m) {
  const f = pfSize(data, id).free, ha = Ha_m / PF_FT;
  return { Q_m3s: f.K * Math.pow(ha, f.n) * PF_CFS, inRange: ha >= f.Ha_min_ft - 1e-9 && ha <= f.Ha_max_ft + 1e-9, Ha_min_m: f.Ha_min_ft * PF_FT, Ha_max_m: f.Ha_max_ft * PF_FT };
}
// Upstream head needed to pass a given free-flow discharge (m3/s in, m out).
export function pfHeadForFlow(data, id, Q_m3s) { const f = pfSize(data, id).free; return Math.pow(Q_m3s / PF_CFS / f.K, 1 / f.n) * PF_FT; }

export function pfTransitionSubmergence(data, id) { return pfSize(data, id).transition_submergence; }
// Free flow holds while Hb/Ha does not exceed the transition submergence of Table 2.
export function pfRegime(data, id, Ha_m, Hb_m) {
  const S = Hb_m / Ha_m, t = pfTransitionSubmergence(data, id);
  return { submergence: S, transition: t, submerged: S > t, margin: t - S };
}
// Table 1 dimensions in metres.
export function pfDimensions(data, id) { const d = pfSize(data, id).dims_in, o = {}; for (const k in d) o[k] = d[k] * PF_IN; o.W = pfThroatWidth(data, id); return o; }
// The Utah report: if the built throat differs from the specified one, scale the table discharge by built/specified (Example 5).
export function pfAsBuiltFactor(specifiedW, builtW) { return builtW / specifiedW; }
// Utah installation procedure for free flow: crest floor no deeper than (transition submergence x Ha) below the high water line (Example 6).
export function pfInstallation(data, id, Qmax_m3s) {
  const Ha = pfHeadForFlow(data, id, Qmax_m3s), t = pfTransitionSubmergence(data, id), f = pfSize(data, id).free;
  const ha = Ha / PF_FT;
  return { Ha_m: Ha, transition: t, crestBelowHighWater_m: t * Ha, afflux_m: Ha * (1 - t), inRange: ha >= f.Ha_min_ft && ha <= f.Ha_max_ft };
}
// Smallest standard flume that passes Qmax in free flow when the downstream depth is dMax and the water may rise by at most allowedLoss (Example 4).
export function pfSelect(data, { Qmax_m3s, downstreamDepth_m, allowedLoss_m }) {
  const HaAllowed = downstreamDepth_m + allowedLoss_m;
  for (const s of data.utah.sizes) {
    const cap = pfFreeFlow(data, s.id, HaAllowed);
    if (!cap.inRange) continue;
    const S = downstreamDepth_m / HaAllowed;
    if (cap.Q_m3s >= Qmax_m3s && S <= s.transition_submergence) {
      const need = pfInstallation(data, s.id, Qmax_m3s);
      if (need.inRange) return { id: s.id, Ha_allowed_m: HaAllowed, capacity_m3s: cap.Q_m3s, submergence: S, transition: s.transition_submergence, Ha_required_m: need.Ha_m };
    }
  }
  return null;
}
// Arkon prefabricated flumes: Q = a * h^b, h in metres at distance B-prime in front of the throat.
export function pfArkonDischarge(data, P, h_m) { const i = data.arkon.id.indexOf(P); if (i < 0) throw new Error('unknown Arkon size: ' + P); return data.arkon.a[i] * Math.pow(h_m, data.arkon.b[i]); }
export function pfArkonForWidth(data, W_cm) { const i = data.arkon.W_cm.findIndex(w => Math.abs(w - W_cm) < 0.5); return i < 0 ? null : data.arkon.id[i]; }

// Checks that mirror the expert rules PF-CHK-001..007 (core/library/wtp/rules/rapid-mix-and-measurement.json).
// ctx: { Ha_m, Hb_m, distanceFromBend_W, nearGate, debris_m, channelWidth_m, waterTemp_C }; missing fields are skipped.
export function pfChecks(data, id, ctx) {
  const out = [], W = pfThroatWidth(data, id), t = pfTransitionSubmergence(data, id), has = k => ctx[k] !== undefined && ctx[k] !== null;
  const add = (rule, severity, text) => out.push({ rule, severity, text });
  if (has('Ha_m') && has('Hb_m')) {
    const S = ctx.Hb_m / ctx.Ha_m;
    if (S > t) add('PF-CHK-001', 'warning', `Submerged flow: Hb/Ha = ${(S * 100).toFixed(0)} % is above the ${(t * 100).toFixed(0)} % transition value. Read Ha and Hb and use the submerged-flow calibration.`);
    if (S > 0.7) add('PF-CHK-002', 'warning', 'Submergence is above 0.7, the upper limit named in the Arkon guide.');
  }
  if (has('distanceFromBend_W') && ctx.distanceFromBend_W < 12) add('PF-CHK-003', 'warning', `Approach length is ${ctx.distanceFromBend_W.toFixed(1)} W; the Arkon guide asks for at least 12 W from the end of a bend.`);
  if (ctx.nearGate === true) add('PF-CHK-004', 'caution', 'The flume is near a gate; gate operation causes unbalanced flow and surging at the flume.');
  if (has('debris_m') && ctx.debris_m / W > 0.8) add('PF-CHK-005', 'warning', 'Debris is larger than 0.8 x throat width; add a screen upstream.');
  if (has('channelWidth_m')) { const r = W / ctx.channelWidth_m; if (r < 0.3333 || r > 0.5) add('PF-CHK-006', 'caution', `Throat is ${(r * 100).toFixed(0)} % of channel width; the usual range is one third to one half.`); }
  if (has('waterTemp_C') && ctx.waterTemp_C > 80) add('PF-CHK-007', 'warning', 'Water temperature is above 80 degC.');
  return out;
}
