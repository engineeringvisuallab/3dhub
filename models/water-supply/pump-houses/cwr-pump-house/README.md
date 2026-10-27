# CWR with pump house (70 x 70 m)

Clear water reservoir 70 x 70 m inside, 3 m water, 5 m clear height, 1.5 m pump sump. On the roof: pump house with 3 vertical in-line pumps and an electrical control room, either in ONE building (`combined`), as TWO buildings (`separate`), or the control room alone (`control-room`).

Page: `parametric/cwr-pump-house.html` (one file, opens by double click). Shows the real 3D model, plan, 4 elevations and 2 sections, and downloads DXF, SVG, GLB, OBJ, STL, IFC, BOM (CSV, XLSX), parts list, ZIP and the software package (Blender, SketchUp, AutoCAD, Revit).

Same designs open in the Studio: `core/examples/cwr-combined.assembly.json`, `cwr-separate.assembly.json`, `control-room.assembly.json`. Design numbers: object `D` in `tools/build-pump-house.mjs`. After a change run `node tools/build-pump-house.mjs`, `node tools/export-pump-house.mjs`, `node tools/build-cwr-page.mjs`.

Limits: indicative structure (no structural design), flow assumed, see `docs/STUDIO.md`. The page was tested outside a browser only (engine, bundle, stubbed three.js); open it once in a browser to confirm.
