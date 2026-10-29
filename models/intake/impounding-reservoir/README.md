# Impounding reservoir (raw water storage)

Stage `impounding-reservoir` of the **intake** model. 32 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

No supplied reference covers this stage yet; one is needed before any criterion is entered.

Types:

- **Storage structure:** Earth-fill dam; Rockfill dam; Concrete gravity dam; Arch dam; Buttress dam; Off-stream (pumped-fill) storage; Balancing reservoir; River weir or barrage; Check dam; Sub-surface dam; Sand dam; Natural lake storage; Rainwater catchment storage; Aquifer storage and recovery
- **Spillway:** Ogee spillway; Chute spillway; Side-channel spillway; Morning-glory (shaft) spillway; Labyrinth spillway; Siphon spillway; Fuse-plug spillway
- **Outlet works:** Intake tower; Sluice outlet; Selective multi-level draw-off; Bottom scour outlet; Conduit through dam
- **Reservoir quality and sediment management:** Destratification by mixer; Destratification by air diffusion; Algae control; Catchment protection; Sediment flushing or sluicing; Fish pass

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
