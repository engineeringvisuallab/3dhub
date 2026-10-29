# Flocculation

Stage `flocculation` of the **treatment-plant** model. 10 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Hydraulic flocculators:** Baffled horizontal-flow flocculator; Baffled vertical-flow flocculator; Alabama-type flocculator; Gravel-bed flocculator; Jet or orifice flocculator; Pipe flocculator
- **Mechanical flocculators:** Paddle, horizontal shaft; Paddle, vertical shaft; Axial-flow turbine; Radial-flow turbine

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
