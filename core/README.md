# core - EVLab 3D Studio engine (structure layer)

Goal: one software/web-app where users DESIGN with library components, and the app assembles bigger 3D models.
Components are never remodelled: a column does not contain its own rebar - the app generates rebar from the shared rebar library and the user edits it.

```
core/
  schema/        component.schema.json, assembly.schema.json   (data contracts)
  library/
    components/  one json per component (parameters, shapes, ports, tags) + manifest.json (list the Studio loads)
    rebar/       rebar-library.json  (grades, dia, kinds, templates) - single source
  engine/
    math3.js expr.js shapes.js   geometry basics, safe $param expressions
    assembly.js  instances + rebar sets -> world-space items
    rebar.js     column-cage, beam-cage, bar schedule (kg)
    snap.js      select object + click model -> auto attach by ports; move / detach / broken links
    generate.js  generator components: json names a generator, it builds shapes + ports from the options
    mesh.js      visual mesh builder (box, lathe, tube, cone ...): triangle meshes, no DOM
    colors.js    colours by tag
    visual/      the REAL shape of a component (flange rings with bolt holes, torus bends, valves, pump): index.js registry, visualOf / visualItems
    gen/door.js  the rich door (17 designs, glass, handles, side glass, fanlight, extras)
    gen/pipefit.js  flanged bend (90 / 45), tee, reducer: direction (up/down/left/right) is a design choice
    drawing.js   assembly -> drawing sheet (plan, elevations, sections): feeds docs/vdraw-engine.js, writes SVG
    bom.js       assembly -> bill of materials (lines by model + size, straight pipe length, rebar schedule) -> tables, CSV, XLSX
    xlsx.js      small XLSX writer (stored ZIP + SpreadsheetML, no library)
    collision.js conflict checker (solid/void/rebar/clearance, cover check)
  rules/         conflict-rules.json, port-rules.json (which ports mate, what must match)
  export/        formats.json  (what each export needs)
  examples/      sample assemblies
  tests/         run.mjs (engine) + door.mjs (rich door) + pipefit.mjs (pump house parts) + library.mjs (every component in manifest.json) + drawing.mjs (drawing sheet) + bom.mjs (bill of materials, CSV, XLSX) + visual.mjs (real shapes: every component has a valid mesh, flange faces on ports)   -> npm test
app/             interface skeleton (panels spec) - built in a later step
```

## Concepts
- **Component**: parameters + shapes + ports + tags. Tag `host` = can carry rebar. Tag `pipe`, `concrete`, ...
- **Assembly**: placed instances (pos, rot, params) + `rebarSets` (template on a host) + optional manual `bars` + port `links`.
- **Conflict engine**: roles `solid | void | rebar | clearance`.
  - solid vs solid overlap = conflict (table inside wall)
  - `void` (opening/sleeve) belongs to its own instance and lists `accepts` tags (pipe passes through the chamber wall opening; a pipe bigger than the opening = conflict)
  - rebar is allowed only inside its host with min cover; through any other solid/bar = conflict
  - clearance zones (handwheel, access) = warning
- **Rebar**: user picks grade, dia, bars per face, stirrup dia/spacing, cover; can add/remove single bars and stirrups; bar schedule + kg output.
- **Units**: mm everywhere; export converts.

Run tests: `cd core && npm test`

## Attach by ports
Components declare ports `{id, at, dir, type, DN, PN, std}`. `autoAttach(assembly, library, selectedId, componentId, portRules)`
finds a free compatible port on the selected object, adopts DN/PN, rotates/translates the new part so ports coincide with opposite directions,
and records a link. Examples in tests: pipe + gate valve (both ends), rotated pipe, third valve rejected (no free port).

## Components added for the Studio
brick-wall, boundary-wall, door, window, gate, rcc-slab (ports `face-h` / `face-v`, origin = bottom centre) and end-suction-pump (flange ports DN/PN).
See `docs/STUDIO.md` for how to add a component. `autoAttach` now prefers the port that faces the selected one.

## Generator components (door)
A component with `"generator": "door"` has parameters in its json (numbers with min/max, choices with `options`), and an empty shape list.
`resolveParams` validates choices and lets the generator check combinations; `materialize(comp, params)` (generate.js) returns the shapes and ports.
Everything downstream (flatten, snap, collision, io, export) works on those plain shapes. Shapes may carry `color` and `opacity`; cylinders may carry `rot`.
To add another one: write `gen/<name>.js` exporting `generate(params)` -> `{shapes, ports, info}` and `validate(params)`, register it in `generate.js`.

## Visual mesh (real shapes)
Collision shapes (box / cylinder in the json) are for conflicts, snap, BOM and drawings. What the user sees and exports is the visual mesh from `engine/visual`:
`visualOf(comp, params)` -> parts `{name, color, pos, nor, idx}`; `visualItems(assembly, library)` -> the same for every instance with its transform.
A component with no builder is drawn from its own solid shapes. A builder gets `{params, ports, color}` and must keep every end face on its port plane (tested in `tests/visual.mjs`).

## Save / load and export
`engine/io.js`: `serialize(assembly)` and `parse(text, library)` (validates units, models, parameters, links; throws English messages).
`engine/export.js`: `toGLB(items)` and `toOBJ(items)` from `flatten().items`. Metres, Y-up. Tests: `npm test`.

## Bill of materials (round 6)
`engine/bom.js` (pure functions, Node and browser):
- `buildBOM(assembly, library)` -> `{ name, instances, rows, totals, rebar }`. One row per model + size: `component` (id), `name`, `category`, `dn`, `pn`, `dims`, `options`, `qty`, `unitLength_m`, `totalLength_m`, `objects` (instance ids). Throws English errors (unknown model, bad parameter, missing rebar host).
- `bomTables(bom)` -> the tables (`columns`, `rows`, `totals`, `notes`) that the Studio dialog, the CSV and the XLSX all show. `toCSV(bom)` (UTF-8, CRLF, text that starts with `= + - @` gets a leading apostrophe) and `toXLSX(bom)` (`Uint8Array`, one sheet per table).
- Rules: two objects are one row when every declared parameter is equal. A component json can list parameters that only turn / pose the part or set reinforcement in `"bom": { "ignore": ["turn"] }` (used by di-bend-90, di-bend-45, di-tee, gate-valve, door, rcc-column), so they do not split a row. DN, PN and the other numeric parameters become DN / PN / Dimensions; choice parameters become Options.
- Length: only for a component tagged `pipe` with a numeric parameter `len` (mm): unit and total length in metres, and one total of straight pipe. Bends, tees, valves, walls and slabs are counted, not measured. The library has no weight or price data, so none is given.
- Rebar: for every rebar set `schedule()` from `rebar.js` is run on its bars: bars, centre-line length (m) and kg (`d*d/162.2` per metre) per bar type, diameter and grade. No hooks, laps or bend allowance.
- A new library component needs no BOM code: it is listed with its parameters. Add `bom.ignore` only for orientation-type parameters.
`engine/xlsx.js`: `makeXlsx([{ name, rows, widths, rowStyles }])` writes a valid workbook with inline strings (text is never a formula) and a fixed ZIP date, so the same input gives the same bytes.

## Pump house parts (round 5)
New components: `di-bend-90`, `di-bend-45`, `di-tee`, `di-reducer` (generators in `gen/pipefit.js`), `dismantling-joint` (adjustable length 150-600 mm),
`check-valve`, `butterfly-valve`, `rcc-beam`, `pump-plinth`. Flange parts adopt DN / PN from the part they attach to.
Engine changes in `snap.js`:
- `autoAttach(..., { fromPort, toPort })`: the user picks which free port of the selected object (and which port of the new part) to use.
- A component with `"inlet": "A"` is tried by that port first, so "turn up / left / right" is always seen along the flow.
- Generated ports can name the parameter a size field comes from: `bind: { DN: "DN2" }` (reducer outlet).
- `rotateInstance(assembly, id, deg, { withAttached })`: turns an object, or the whole connected group, around the vertical axis through the object's origin.
`rules/port-rules.json`: `bearing` (column) and `face-v` (slab, wall top, beam) now mate, so a beam sits on a column and a slab on a beam.
Example: `examples/pump-station-line.assembly.json` (slab, plinth, pump, joint, check valve, butterfly valve, bends, pipes; Load it in the Studio).
Limits: the collision shape of a bend is still two straight arms (the visual mesh is a real torus), sizes are a generic envelope (not a maker's catalogue), only boxes and cylinders.
