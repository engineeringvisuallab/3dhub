# High-lift pumping and delivery main

Stage `delivery` of the **treatment-plant** model. 23 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **High-lift pumps:** Horizontal split-case pump; End-suction pump; Vertical turbine pump; Vertical in-line pump; Submersible pump
- **Pump station type:** Wet-well station; Dry-well station; Packaged pump station
- **Drive:** Constant-speed drive; Variable-frequency drive; Engine drive
- **Delivery main pipe:** Ductile iron; Steel; HDPE; PVC; GRP; Prestressed concrete
- **Appurtenances:** Isolation valve; Check valve; Air valve; Flow-meter chamber; Thrust block; Surge protection

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
