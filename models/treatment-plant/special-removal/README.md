# Softening, ion exchange and contaminant-specific removal

Stage `special-removal` of the **treatment-plant** model. 28 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Softening:** Lime softening; Lime-soda softening; Ion-exchange softening; Nanofiltration softening
- **Iron and manganese removal:** Aeration and filtration; Permanganate oxidation and filtration; Greensand filter; Biological iron removal
- **Arsenic removal:** Coagulation and filtration; Activated alumina; Iron-based adsorbent; Ion exchange; Reverse osmosis
- **Fluoride removal:** Nalgonda technique (alum and lime); Activated alumina; Bone char; Reverse osmosis
- **Nitrate removal:** Ion exchange; Biological denitrification; Electrodialysis; Reverse osmosis
- **Desalination:** Seawater reverse osmosis; Brackish reverse osmosis; Multi-stage flash distillation; Multi-effect distillation
- **Taste, odour and organics:** PAC for taste and odour; GAC for organics; Ozone for taste and odour

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
