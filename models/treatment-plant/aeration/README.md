# Aeration and gas transfer

Stage `aeration` of the **treatment-plant** model. 9 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Aerators:** Cascade aerator; Spray aerator; Tray aerator; Diffused-air aerator; Mechanical surface aerator; Venturi injector aerator
- **Strippers and degasifiers:** Packed tower air stripper; Low-profile tray stripper; Vacuum deaerator

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
