# models/_shared

`evlab-kit.js` is the shared drawings + export kit. Load it as the last script of a model page:

    <script src="../../../_shared/evlab-kit.js"></script>

What it gives a page that has a three.js `model` group (metres, Y-up) and a `spec` object:

- **Drawings**: one A3 sheet with plan, 4 elevations and 2 sections (hatching, dimensions, section marks). Buildings can return 4 cuts and get a second sheet (floor plans on sheet 1, sections on sheet 2).
- **Export**: DXF, SVG, PNG, STL, IFC4, parts list + parameters (CSV), and a Software package (Blender add-on, SketchUp extension + DAE, AutoCAD 3D DXF + LISP, Revit script + IFC, STL, bim-data.json). The page's own ZIP also gets the drawings, STL, IFC and CSV files.
- If the page already has its own drawing code (`#dw` button, `sheetBuild()`), the kit only adds the formats the page is missing.

Optional page config, defined before the kit script: `window.EV_KIT = { noGround, groundLabel, title, exportOnly, cuts(bb), before(), after() }`.
Pages that keep the scene private (inside a function) expose it with `window.EV_PAGE = { get model(){}, get spec(){}, get clips(){} }`.

Check the whole library: `node tools/check-library.mjs`
