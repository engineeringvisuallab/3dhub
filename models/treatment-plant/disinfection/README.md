# Oxidation and disinfection

Stage `oxidation-and-disinfection` of the **treatment-plant** model. 16 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Disinfectants:** Chlorine gas; Sodium hypochlorite; Calcium hypochlorite (bleaching powder); On-site electrochlorination; Chloramination; Chlorine dioxide; Ozone; Ultraviolet; Solar disinfection
- **Chemical oxidants:** Potassium permanganate; Hydrogen peroxide; Advanced oxidation (ozone-peroxide, UV-peroxide)
- **Contact tanks and feed equipment:** Baffled serpentine contact tank; Pipe contact; Vacuum solution-feed chlorinator; Direct gas-feed chlorinator

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
