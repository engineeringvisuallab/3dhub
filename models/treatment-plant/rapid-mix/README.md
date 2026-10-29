# Flow measurement and rapid mixing

Stage `rapid-mix-and-measurement` of the **treatment-plant** model. 16 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Open-channel flow measurement:** Parshall flume; Palmer-Bowles flume; Rectangular sharp-crested weir; V-notch weir; Ultrasonic open-channel meter
- **Closed-pipe flow measurement:** Electromagnetic flowmeter; Ultrasonic transit-time flowmeter; Venturi meter; Orifice plate meter
- **Rapid mixers:** Hydraulic jump mixer; Weir mixer; Baffled channel mixer; In-line static mixer; Mechanical back-mix mixer; Pipe injection diffuser; Turbulent pipe flow mixer

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
