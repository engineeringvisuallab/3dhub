# Raw water pumping and conveyance

Stage `raw-water-conveyance` of the **intake** model. 15 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Raw water pumps:** Horizontal centrifugal pump; Vertical turbine pump; Submersible pump; Axial-flow pump; Screw (Archimedes) pump
- **Conveyance:** Gravity pipeline; Rising main; Open channel; Tunnel or aqueduct; Inverted siphon
- **Surge protection:** Surge tank; Air vessel; Pressure relief valve; Flywheel; Controlled valve closure

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
