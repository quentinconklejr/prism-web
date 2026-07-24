// Port of reference_app.py compute_smr_scores
// Population density thresholds: /mi² converted to /km² (1 mi² = 2.590 km²)
// 200/mi²=77.2/km²  500/mi²=193.1/km²  1000/mi²=386.1/km²

export function computeSmrScores(rows, mode) {
  return rows.map((row) => {
    const pga    = row.pga_max            ?? 0;
    const dens   = row.population_density ?? 0;
    const volt   = row.max_voltage        ?? 0;
    const lakeD  = row.dist_to_lakes_km       ?? 999;
    const riverD = row.distance_to_rivers_km  ?? 999;
    const nearest = Math.min(lakeD, riverD);

    // Seismic (identical across all modes)
    let sSeis;
    if      (pga > 0.50) sSeis = null;
    else if (pga > 0.30) sSeis = 0.25;
    else if (pga > 0.10) sSeis = 0.65;
    else                 sSeis = 1.0;

    // Population density
    let sPop;
    if (mode === 'LWR') {
      if      (dens > 193.1) sPop = null;
      else if (dens > 77.2)  sPop = 0.35;
      else                   sPop = 1.0;
    } else {
      if      (dens > 386.1) sPop = null;
      else if (dens > 193.1) sPop = 0.25;
      else if (dens > 77.2)  sPop = 0.65;
      else                   sPop = 1.0;
    }

    // Grid / transmission
    let sTx;
    if (mode === 'LWR') {
      if      (volt >= 345) sTx = 1.0;
      else if (volt >= 230) sTx = 0.75;
      else if (volt >= 138) sTx = 0.50;
      else                  sTx = 0.25;
    } else if (mode === 'SMR - NuScale VOYGR') {
      sTx = volt >= 115 ? 1.0 : 0.50;
    } else {
      if      (volt >= 230) sTx = 1.0;
      else if (volt >= 115) sTx = 0.65;
      else                  sTx = 0.35;
    }

    // Water proximity
    let sWat;
    if (mode === 'LWR') {
      if      (nearest < 5)  sWat = 1.0;
      else if (nearest < 15) sWat = 0.75;
      else if (nearest < 30) sWat = 0.50;
      else                   sWat = 0.25;
    } else if (mode === 'SMR - NuScale VOYGR') {
      sWat = nearest < 30 ? 1.0 : 0.75;
    } else {
      if      (nearest < 5)  sWat = 1.0;
      else if (nearest < 15) sWat = 1.0;
      else if (nearest < 30) sWat = 0.75;
      else                   sWat = 0.50;
    }

    const disq = sSeis === null || sPop === null;
    const smrScore = disq ? null : (sSeis + sPop + sTx + sWat) / 4.0;

    return { ...row, smr_score: smrScore };
  });
}

// Percentile rank helper (0–1)
export function percentileRank(values, v) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.findIndex((x) => x >= v);
  return idx === -1 ? 1 : idx / sorted.length;
}
