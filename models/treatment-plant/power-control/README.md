# Power, instrumentation and control

Stage `power-and-control` of the **treatment-plant** model. 18 technology types are listed for this stage; none is built yet.

The full list, the calculations, the expert rules and the status of each type are in `core/library/wtp/` (see `docs/wtp/COVERAGE.md` and `docs/wtp/CALCULATIONS.md`).

Types:

- **Power supply:** Grid connection and transformer; Diesel generator set; Solar PV hybrid; UPS and battery
- **Distribution:** Motor control centre; Switchgear; Cable and earthing
- **Instruments:** Flow instruments; Level instruments; Turbidity analyser; Chlorine analyser; pH analyser; Streaming current detector; Particle counter; Head-loss transmitter
- **Control level:** Manual local control; PLC control; SCADA system

A type becomes a model page here (`parametric/*.html`, with the shared export kit) only after it has data, calculations and sources; see `docs/wtp/STRUCTURE.md`.
