# Plant hydraulics, layout and package plants

Stage `plant-hydraulics-layout` of the **treatment-plant** model. 13 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Hydraulic arrangement:** Gravity flow profile; Pumped intermediate profile
- **Flow distribution:** Flow splitter weir; Distribution channel; Bypass arrangement
- **Layout type:** Linear layout; Compact stacked layout; Clustered layout; Package plant; Modular plant
- **Yard piping:** Gravity yard pipe; Pressure yard pipe; Drain and overflow pipe

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
