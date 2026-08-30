// Construction labor cost index — shared constants and helpers.
//
// Source: Sargent & Lundy, "Capital Cost and Performance Characteristic Estimates
// for Utility Scale Electric Power Generating Technologies", SL-018001 Rev A,
// prepared for the U.S. EIA, December 2023 — Appendix A, Labor Location-Based
// Cost Adjustments.
//
// The index reflects craft labor wage rates and labor productivity only, measured
// against a 30 City Average baseline of 1.00. It does NOT include the seismic,
// wind or snow cost adjustments, which are a separate table in the same report
// that PRISM does not use — seismic is already scored as its own criterion.
//
// Values are published at state level, so every county in a state shares one
// factor. The index can move whole states relative to each other; it can never
// separate two counties within the same state.

// Overnight capital cost, $/kW (2023$), for the SMR reference case.
// Report Case 10 — 6 x 80 MW units, 480 MW net.
export const CAPEX_PER_KW_BASE = 8936;
export const PLANT_NET_MW = 480;

// National baseline: 1.00 = the report's 30 City Average.
export const COST_INDEX_BASELINE = 1.0;

// Fixed scaling bounds for the optional cost weight.
//
// Deliberately NOT the observed min/max of the current dataset. Scaling to the
// observed range would silently re-anchor every county's cost score whenever the
// underlying data changed — add one expensive state and every other county's
// number moves. These bounds bracket the published 0.95-1.18 spread with headroom
// and stay put.
export const COST_SCALE_MIN = 0.90;
export const COST_SCALE_MAX = 1.25;

// User-facing name. Never call this a "location factor" in the UI: that reads as
// a general cost-of-building index, and it is strictly a labor adjustment.
export const COST_LAYER_LABEL = 'Construction labor cost index';

// ColorBrewer YlOrBr — sequential, CVD-safe, and warm, so it never reads as the
// cool YlGn suitability ramp at a glance. Dark = expensive.
export const COST_RAMP = [
  '#fff7bc',
  '#fee391',
  '#fec44f',
  '#fe9929',
  '#ec7014',
  '#8c2d04',
];

/**
 * Normalise a cost index to 0-1 against the FIXED bounds above, where 1 = cheapest.
 * Returns null for counties the source report does not cover.
 */
export function costScore(locationFactor) {
  if (locationFactor == null || !isFinite(locationFactor)) return null;
  const t = (locationFactor - COST_SCALE_MIN) / (COST_SCALE_MAX - COST_SCALE_MIN);
  return 1 - Math.max(0, Math.min(1, t));
}

/** "$9,203" */
export function fmtPerKw(v) {
  if (v == null || !isFinite(v)) return null;
  return `$${Math.round(v).toLocaleString()}`;
}

/** "$4.42B" */
export function fmtTotalCapex(v) {
  if (v == null || !isFinite(v)) return null;
  return `$${(v / 1e9).toFixed(2)}B`;
}

/** "+18% vs national baseline" / "at the national baseline" */
export function fmtVsBaseline(locationFactor) {
  if (locationFactor == null || !isFinite(locationFactor)) return null;
  const pct = (locationFactor - COST_INDEX_BASELINE) * 100;
  if (Math.abs(pct) < 0.5) return 'at the national baseline';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs national baseline`;
}
