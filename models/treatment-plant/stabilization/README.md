# Stabilization, corrosion control and fluoridation

Stage `stabilization` of the **treatment-plant** model. 12 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **pH and alkalinity adjustment:** Lime; Soda ash; Caustic soda; CO2 recarbonation; Aeration decarbonation; Calcite contactor
- **Corrosion inhibitors:** Orthophosphate; Polyphosphate; Silicate
- **Fluoridation:** Sodium fluoride; Sodium silicofluoride; Fluorosilicic acid

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
