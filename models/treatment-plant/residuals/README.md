# Residuals and washwater management

Stage `residuals` of the **treatment-plant** model. 15 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Thickening:** Gravity thickener; Dissolved air thickener
- **Dewatering:** Sand drying bed; Sludge lagoon; Belt filter press; Centrifuge; Plate filter press; Screw press; Geotextile tube
- **Washwater:** Washwater equalization tank; Washwater recycle
- **Disposal and reuse:** Landfill; Land application; Sewer discharge; Beneficial reuse

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
