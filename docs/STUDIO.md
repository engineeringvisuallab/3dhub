# EVLab 3D Studio - purpose and guide

Not tested in a real browser yet: the engine (attach, conflicts, save/load, GLB/OBJ writers, the rich door) is covered by `cd core && npm test`;
the page itself (buttons, panel, how the door looks in 3D) needs a first run on the owner's side. The Properties panel code for the door was run headless with a fake page (no real browser).
Round 7 (real shapes): the viewer code path was run in Node with real three.js r128 and the shapes were rendered with a software renderer, not in a browser (details in "Changes in round 7").
The BOM button, dialog and downloads (round 6) were run in headless Chromium (details in "Changes in round 6"); that run does not replace a look on a normal desktop browser.

## What the owner wants (read this first)
1. A browser app now, a desktop software later.
2. It is **not** a CAD/drafting program. It is a **ready-to-build** program: ready 3D models are attached to each other to make a big model.
3. It must **not copy any existing CAD software** (UI, names, code).
4. **All software text is English.** No Bangla in the app.
5. Deliver changes as **one zip with only the new/changed files**, in repo folder structure, no wrapper folder, plus a list of files to delete.
6. Do it whichever way truly fulfils the purpose. If something cannot be done, say so and give a ready prompt for it.

## How it works (3 layers)
| Layer | Folder | Job |
|---|---|---|
| Components | `core/library/components/*.json` | One json per model: parameters, collision shapes (box/cylinder), ports, tags |
| Visual shapes | `core/engine/visual/*.js`, `core/engine/mesh.js` | The real shape you see and export (flanges with bolt holes, torus bends, valve bodies ...), built from the same parameters and ports |
| Engine | `core/engine/*.js` | Builds geometry, snaps ports (`snap.js`), checks conflicts (`collision.js`), save/load (`io.js`), GLB/OBJ (`export.js`), rebar |
| Interface | `app/` | The Studio page. Calls the engine, shows the scene |

A **port** is a connection point: `{id, at, dir, type}`. Two ports mate when `core/rules/port-rules.json` allows their types and DN/PN/std match.
Types now: `flange` (pipes, valves, pump), `spigot`/`socket`, `face-h` (parts in a line: wall, door, window, gate), `face-v` (stacking: wall top, slab).

## What works now
Scene (orbit/pan/zoom), model library with drag and drop, auto-attach by ports, properties, conflict panel,
save/load (.json), export GLB and OBJ. Details: `app/README.md`.

## Components available now
| Component | Category | Connects with |
|---|---|---|
| di-pipe, di-pipe-fl, gate-valve, end-suction-pump | water-supply | flange ports, same DN/PN |
| **generator-room** (DG set room, all facilities, 62.5-1000 kVA) | electrical | `face-v` bottom (B) and roof top (T), `face-h` ends (L / R); see round 8 |
| **door** (rich, 17 designs) | building | `face-h` left/right (frame outer edges); see "Door" below |
| brick-wall, boundary-wall, window, gate | building | `face-h` left/right; `face-v` top/bottom for walls |
| rcc-slab | building | `face-v` (sits on a wall top, a wall stands on it) |
| rcc-column, rcc-wall-opening, table | structure / misc | (see `core/README.md`) |
| **di-bend-90, di-bend-45, di-tee, di-reducer** | water-supply / fitting | flange ports, DN/PN adopted; turn / branch = up, down, left, right |
| **dismantling-joint** (length 150-600), **check-valve**, **butterfly-valve** | water-supply | flange ports, same DN/PN |
| **blind-flange**, **ball-valve**, **air-valve**, **flow-meter** | water-supply | flange ports, same DN/PN. Air valve has one port facing down: put it on a tee branch pointing up. Lengths/heights are indicative envelopes, confirm with the maker |
| **rcc-beam**, **pump-plinth** | structure | `face-v`: beam on a column top, slab on a beam, plinth on a slab |

Example: select a wall, click Door, click Window, click Brick wall, click Gate = one wall line. Select the first wall, click Slab = slab on top.

## Drawing sheet (plan, elevations, sections)
Top bar > **Drawing**. Pick where the two sections cut (Section A-A and B-B: a plane across X, a plane across Y, or a horizontal cut at a height Z, positions in mm; they start at the middle of the model), then **Download DXF** or **Download SVG**.
The sheet is A3, scale chosen automatically (1:20, 1:50, 1:100 ...), and holds the plan, front / back / left / right elevations and the two sections, with overall dimensions, section marks, cut outlines (red) and hatch.
Line work: `docs/vdraw-engine.js` (hidden lines, section cut, hatch, DXF). Glue: `core/engine/drawing.js`. The DXF has only lines and text on layers (A-VIS, A-CUT, A-HATCH, A-DIM, A-TEXT, A-SECT, A-GROUND, A-FRAME). Indicative drawing from the 3D model: check all dimensions before manufacture or construction.
Limits: at most 2 sections per sheet; big assemblies (hundreds of parts) can take a few seconds.

## Bill of materials (BOM)
Top bar > **BOM**. A dialog lists every part of the design, grouped by model and size:

| Column | Meaning |
|---|---|
| Component / Component id | library name and id |
| DN, PN | from the parameters `DN` and `PN` (blank when the model has none) |
| Dimensions (mm) | the other numeric parameters, e.g. `len 1500`, `L 6000, W 5000, T 200`, reducer `DN2 200` |
| Options | choice parameters, e.g. door design, finish, handle |
| Qty | number of objects with exactly these parameters |
| Unit length (m), Total length (m) | **straight pipe only** (`di-pipe`, `di-pipe-fl`); blank for everything else |

Under the table: total number of parts and total straight pipe length. **Download CSV** / **Download XLSX** give the same tables (XLSX is written by `core/engine/xlsx.js`, no library). If the design has rebar sets, the bar schedule (bars, total length, kg per bar type, diameter and grade) is a second table (second sheet in XLSX).
What it does not do, on purpose: no prices, no weights of library parts (the library has none), no concrete volumes, no length for bends, tees, valves or walls. Bends and other parts that only differ by direction (bend turn, tee branch, valve open, door open angle) are one line. Column rebar settings (cover, bar sizes, ties) are not part of the column line: they appear in the rebar schedule.
Rebar sets come from an assembly file (they are not created in the Studio yet), so the second table appears after Load of such a file, for example `core/examples/column-with-rebar.assembly.json`. Manual bars in an assembly file (`bars`) are not part of the schedule, because the engine does not build them either.
Pump station example (`pump-station-line.assembly.json`): 12 objects in 11 lines (2 bends in one line, 3 flanged pipes of 1.2 / 1.5 / 2.0 m) and 4.7 m of straight pipe.

## Add a new model to the Studio
1. Write `core/library/components/<id>.json` (copy `door.json` as a template). Origin of building parts = bottom centre.
2. Add `<id>` to `core/library/components/manifest.json` (the Studio reads this list; no code change needed).
3. Run `cd core && npm test`, then open the Studio and try attaching it.
4. The BOM needs no change: the new model is listed with its parameters. Only if a parameter just turns or poses the part (like a bend direction), add `"bom": { "ignore": ["<parameter>"] }` to its json so it does not split a BOM line. A straight pipe model gets a length in the BOM when it has the tag `pipe` and a parameter `len` (mm).
   For a model with many options (like the door) use a generator instead of a fixed shape list: see "Door" below and `core/README.md`.

## Door (rich model, converted in round 3)
Source: `models/building/door/parametric/door.html`. Component: `core/library/components/door.json` (id `door`, same id as before, so it was replaced, not added).
The door has far too many options for a fixed list of boxes, so it is a **generator component**: the json lists the parameters, and
`core/engine/gen/door.js` builds the shapes and ports from them. The rest of the engine (attach, conflicts, save/load, GLB/OBJ) is unchanged and does not know the difference.

| Option | Values |
|---|---|
| Design (17) | Wood: 4 panel, 6 panel, 2 panel, Shaker, Half glass, Louvred, Modern grooved flush, Flush, Ledged and braced. Steel: Pressed 4 panel, Flush sheet, Fire-rated look with vision panel, Security grill. Aluminium: Full glass, Glass + lower panel. PVC/WPC: Ribbed flush, 2 panel |
| Finish | teak, mahogany, oak, walnut (wood) / grey, white, brown, black, green (steel) / silver, black, bronze, white (aluminium) / white, ivory, grey, oak (PVC). A finish that does not fit the design type falls back to the first finish of that type |
| Leaves, size | single or double; width (leaf total) 600-2400, height 1800-2700. A warning appears in Details if a single leaf is wider than 1200 or a double door narrower than 1000 |
| Thickness | Automatic (page rules: wood 32/38/45 by leaf width, other types 45 or 30) or 30/32/35/38/45/50 (snapped to what the type allows) |
| Hinges, swing | hinge side L/R (seen from outside), opens out/in, open angle 0-120 (0 = closed) |
| Hardware | stainless, brass, black; handle lever, knob, pull bar, digital lock + lever |
| Glass | 11 kinds (clear, frosted, tinted grey/bronze, reflective blue, low-E, reeded, pebble, wired, stained, mirror), tempered/laminated (recorded in Details only) |
| Frame extras | side glass none / one side / both sides, fanlight yes/no |
| Extras | peephole, closer, kick plate, letterbox, number plate |
| Wall data | wall thickness `t` and wall height `H` (the masonry above the frame): set them equal to the walls you attach |

How it attaches: origin = bottom centre of the whole unit (frame + side glass). Outside = -Y. Ports `L` and `R` (`face-h`) sit on the outer edges of the frame / side glass,
so a wall attaches to each side (wall - door - wall). The swing zone of every leaf is a `clearance` shape: a table or wall in the way gives a warning.
Frame depth (60-100 mm) is thinner than the wall (default 230): the wall reveals are not modelled, same as the page.

What is different from the page (honest list): no wood grain, no textures (frosted/reeded/pebble/wired/stained glass are plain tinted colours with opacity);
raised panels are flat boxes (the page uses bevelled frustums); a round door knob is a short cylinder; lever and hinge animation is replaced by the
single open-angle parameter (levers stay in the closed position); glass type only appears in Details; drawings, DXF and ZIP download stay on the page.
Door components saved before round 3 (simple door) still load, but a door that was attached to a wall now shows a "link no longer touches" notice because the
unit is wider by the frame (about 160 mm). Detach and attach again.

## Next model
Note: the components other than the door still use simple box/cylinder geometry. The remaining rich models in `models/` (window, staircase ...)
are still separate pages. Converting them is the next job. Prompt for a new chat (attach the repo zip):
```
Task: make the existing rich parametric model "<MODEL NAME>" (models/building/<name>/parametric/<name>.html) usable inside app/studio.js.
1. Read the HTML, extract geometry rules and parameters.
2. Write core/library/components/<id>.json (see core/schema/component.schema.json) with shapes and ports (face-h / face-v / flange).
3. Add the id to core/library/components/manifest.json. Test with core/tests (library.mjs checks every component).
4. Give me ONLY new/changed files, in folder structure. All software text English. Do not copy any CAD code.
Order: window, staircase, column, railing, room-interior, rebar   (door is done: see core/engine/gen/door.js, use it as the pattern).
If the model has many options like the door, add a generator in core/engine/gen/ and register it in core/engine/generate.js.
```

## Pump house on a clear water reservoir (example design, round 9)
File: `core/examples/pump-house-cwr.assembly.json` (Studio: Load). Built by `node tools/build-pump-house.mjs` (all design numbers are in the object `D` at the top of that script); BOM, drawing sheet (SVG + DXF) and previews are in `exports/pump-house-cwr/` (`node tools/export-pump-house.mjs`).
- **CWR** 15.0 x 8.0 m outside, RCC walls 300, internal height 3.5 m, base slab 300, roof slab 300 with three round openings (400 mm, kerb 150) and an inlet DN300 through the south wall (gate valve + blind flange outside).
- **Pump house** 12.0 x 6.0 m on the CWR roof: RCC frame (10 columns 300 x 300, beams 300 x 500, roof slab 150), brick infill 230, windows, personal door (north), equipment double door (west gable), control room (4th bay) with partition door, external door, window and 3 panels.
- **3 pumps** (2 duty + 1 standby assumed, DN200 PN16, vertical in-line `vertical-inline-pump`) on 300 mm plinths. Suction: dismantling joint, gate valve, bend down, DN200 pipe through the roof opening, reducer as bell mouth 300 mm above the CWR floor. Discharge: dismantling joint, check valve, butterfly valve, pipe, reducer, tee on the DN300 header. Header: air valve (DN150) tee, end blind flange; outlet to the west: dismantling joint, butterfly valve, pipe through the gable wall, flow meter, blind flange (connect the rising main here).
- 123 objects, 70 links, 0 conflicts, 0 warnings. Column cages from the rebar library (10 sets, 334 kg).
New parts: `rcc-wall`, `rcc-slab-openings` (roof with 3 pipe openings and kerbs), `control-panel`, `vertical-inline-pump` (realistic casing and motor; builder `core/engine/visual/pump-inline.js`). Changed: `rcc-slab` max length 12000 -> 20000, `visual/index.js` (registers the pump builder), `manifest.json`, `package.json`, `tests/pumphouse.mjs`.
Assumed, not calculated: flow 40 l/s per pump (about 1.3 m/s in DN200, 1.1 m/s in the DN300 header with 2 pumps running), sizes of structure are indicative (no structural design). Not in the library yet: hoist / monorail, roof hatch and handrail, CWR vent, overflow, scour, ladder, internal baffles, cable trench, pressure gauges, surge vessel, beam rebar (`rcc-beam` origin is the bottom face, `beam-cage` expects the centre), slab / wall mesh.
Not run in a real browser here (no three.js available in this sandbox); engine tests pass and the model was rendered with a separate software renderer.

## Pump house (what the owner wants the Studio for)
A big model such as a pump house: civil structure (slab, plinth, column, beam, walls, door, window) plus a pipe line (pump, dismantling joint, check valve, butterfly / gate valve, bends, tee, reducer) at different heights.
How to build: select a part, optionally pick **Next part attaches at** (port A / B / C ...), click the next model in the list: it attaches and becomes the selected part, so a line grows click by click.
For a bend or tee, set Turn / Branch (up, down, left, right) in Properties. Move, raise or turn the whole line with the buttons ("Move with attached parts" ticked).
Load `core/examples/pump-station-line.assembly.json` to see a finished line.
Honest limits: the bend is now a real torus arc in the 3D view (round 7), but its collision shape is still two straight arms; sizes are a generic envelope; walls attach only in a straight line (no corner part yet), so place wall corners by position;
the pump has flange ports only, so it is placed by position (raise it on a plinth so flanged fittings clear the floor: the conflict checker reports it if not);
pipe through a wall uses `rcc-wall-opening` (round opening) by position. Next steps are listed below.

## Changes in round 8 (new library item: generator room)
New component `generator-room` (generator component + real mesh, same pattern as the door): a complete diesel generator room, also published as a library page.
- What it is: floor slab, walls with REAL openings (wall pieces around doors, louvres, exhaust sleeve, fuel sleeve, so a pipe can pass through), roof with parapet, 1 or 2 DG sets (62.5-1000 kVA) on plinths, exhaust line (bellows, silencer, lagged pipe, sleeve, stack, rain cap; or straight up through the roof), day fuel tank with bund and fuel lines, inlet louvres + discharge louvre, double-leaf door or rolling shutter per set, personnel door, AMF panel, battery rack + charger, cable trench with cover plates and cables, monorail hoist, fire kit, lights, extraction fan, acoustic lining, floor drain.
- Parameters: set rating, number of sets, room length / width / height (0 = automatic smallest that fits the set, clearances, air and exhaust), wall thickness, exhaust exit, stack height (0 = guideline), day tank hours, 9 facility switches, equipment door type, doors open %, wall / set colour, cutaway (view only: hides roof and front wall, collision unchanged).
- Rules live in ONE place, `RULE` in `core/engine/gen/genroom.js` (indicative, generic envelopes): 1200 mm side clearance, radiator end 1500, alternator end 1800 (+900 with battery rack), height from the exhaust line (min 3600), air 0.025 m3/s per kVA, inlet louvre 4 m/s on 50 % free area, discharge up to 8 m/s, bund 110 % of the tank, stack 0.2 x sqrt(kVA) m above the roof, hoist = half the set mass. Too-small room sizes are raised to the minimum and a note appears in Details (soft rule, like the door); warnings (for example a stack below the guideline) show in Details and block the download on the library page.
- Files: `core/engine/gen/genroom.js` (plan(), rules, collision shapes, ports, details), `core/engine/visual/genroom.js` (real mesh), `core/library/components/generator-room.json`, `core/tests/genroom.mjs` (new, in `npm test`), `tools/generator-room-page.template.html` + `tools/build-generator-room-page.mjs` (build the library page by inlining the engine: ONE geometry source), `models/electrical/generator-room/` (README, model.json, `parametric/generator-room.html`).
- Changed: `core/engine/generate.js` (registers `genroom`), `core/engine/visual/index.js` (registers the builder; builder parts may now carry `opacity`), `core/library/components/manifest.json`, `core/tests/visual.mjs` (flange-face check only for flange ports), `core/package.json`, `commerce/catalog/catalog.json`, `site/index.html`, `docs/MODEL-ROADMAP.md`, `core/README.md`, `tools/README.md`.
- Ports: B (bottom, `face-v`), T (roof top, `face-v`), L / R (ends, `face-h`). Origin = bottom centre of the outer footprint. The room stands on a slab by its B port.
- Tested (Node): `cd core && npm test` passes. `tests/genroom.mjs`: all 88 combinations (11 sizes x 1/2 sets x wall/roof exit x door/shutter) build; rule numbers (room size, louvre area, discharge speed, bund 110 %, door size, hoist); openings are really empty and walls beside them solid; doors swing outward; ports; no self-conflict; mesh has 35+ parts and stays under 20 m; cutaway changes only the mesh. `tests/visual.mjs`: triangle winding 100 % for the room.
- Tested (Node, no browser): the library page script was run with real three.js r128 (stubbed renderer / exporters): it builds, the checks list is filled, rule violations block the download, ZIP download runs without error. The mesh was also rendered with a small software renderer (cutaway, 1 and 2 sets, roof exit, shutter) and looked right.
- NOT tested: a real browser (WebGL drawing, orbit controls, real GLB / OBJ files opened in Blender) and the Studio UI itself (properties panel with 22 parameters, drag and drop); the Studio draws the same mesh through the same code path as the door and the pump, but this was not clicked through.
- Limits: sizes are generic envelopes, not a maker's catalogue; air / fuel / stack numbers are rules of thumb (the stack formula is the common DG guideline, check the local rule); the exhaust collision shape is straight pieces (the mesh has real bends); no drawing sheet and no BOM lines for the facilities yet (the room is one BOM line); the room needs 12 m or more for 2 x 1000 kVA, that is expected.
- Delete nothing.


## Changes in round 7 (real shapes: the visual mesh layer, Stage 1 step 1)
Problem: every Studio part was only a box or a cylinder (a bend was two straight arms, a valve a drum with a box). The owner wants the ORIGINAL shape.
Now each component has two layers:
- **Collision layer** (unchanged): the boxes / cylinders in the component json. Conflict check, snap, BOM and the drawing sheet still use them, so nothing that worked before changes.
- **Visual layer** (new): `core/engine/visual/*.js` builds a real triangle mesh from the SAME parameters and ports. The Studio 3D view and GLB / OBJ export draw this mesh.
  Components without a builder are drawn from their own solid boxes / cylinders (walls, slabs, columns, beams, door, window, gate, table, plinth), so every component always has a visual mesh.

Parts with a real shape now (15 of 26): DI pipe (hollow barrel), flanged DI pipe, 90 and 45 degree bend (real torus arc), tee, reducer (smooth cone), blind flange,
dismantling joint (tie rods and nuts), gate valve (body, bonnet, rising stem that follows `open`, handwheel), butterfly valve (gear box, extension spindle, handwheel, disc), swing check valve (cover with bolts, flap),
ball valve (round body, lever), air valve (flange, body, hood), electromagnetic flow meter, pump set (base frame, casing, motor).
Every flange is a real EN 1092-2 ring: bore, bolt circle with real bolt holes (count and size by DN and PN), hub. Sizes: `core/engine/visual/flange-data.js` (same numbers as `library/standards/en1092-2-flanges.json`; a test keeps them equal).
Ports are untouched: `core/tests/visual.mjs` checks that every flange face lies exactly on its port plane, so auto-attach behaves as before.

Files: `core/engine/mesh.js` (mesh builder: box, lathe, tube/sweep, cone, hex ...), `core/engine/visual/index.js` (registry, `visualOf`, `visualItems`), `flange.js`, `flange-data.js`, `pipework.js`, `valves.js`, `pump.js`, `util.js`, `core/engine/colors.js`,
`core/engine/export.js` (GLB / OBJ take the visual mesh, materials double sided), `app/studio.js` (draws the visual mesh, geometry cached per part), `core/tests/visual.mjs` (in `npm test`).
How to give a component a real shape: write a builder `function ({ params, ports, color }) -> [{ name, geo, color }]` in `core/engine/visual/`, register it in `BUILDERS` in `visual/index.js` under the component id (or name it in the json: `"visual": "<builder>"`), run `npm test`.
The builder must keep every end face on its port plane (the test fails otherwise). The generators live in `visual/`, not in `gen/`, because `gen/` already holds the collision generators (door, bend, tee, reducer).

Honest limits (found while doing this):
- **Pump envelope is wrong for a real pump.** `end-suction-pump.json` puts both flange ports on one horizontal line at 0.8 DN above the floor, the motor box on top, and it is only a generic envelope. A real flange of DN100 is 220 mm wide, so its lower edge sits 30 mm BELOW the base frame.
  The visual follows the ports (as asked) and shows this. A true end-suction pump (suction on the shaft axis, discharge pointing up, motor beside) needs different ports, so it must be a new component (see the next prompt).
- Not done in this step: chambers, supports, gasket, bolts (Stage 2); staircase, railing, rebar models are not in the Studio yet; the library page (`models/*/parametric/*.html`) still has its own geometry (Stage 7 joins them).
- Tee: the branch bore is not cut through the run wall (looks right from outside and through the flange bores, not from deep inside).
- Butterfly disc is drawn 35 degrees open; a fully open disc reaches past the flange faces.
- Size of the meshes: about 6 000 triangles per fitting (a flange alone is 2 100). Fine for a pump line; for 500+ objects the Stage 7 job (instancing, level of detail) is needed.
- Sizes are a generic envelope (face to face, outer diameters from the component tables), not a maker's catalogue.
- Tested: `cd core && npm test` (120 checks in `visual.mjs`: every component of the manifest has a non-empty mesh and bounding box, finite numbers, winding matches normals, all table sizes and PN10 / PN16, flange faces on ports, bolt hole count and face area, GLB / OBJ).
  The viewer code was also run in Node with real three.js r128 (BufferGeometry, EdgesGeometry, mesh matrices) and the shapes were rendered to PNG with a software renderer. NOT tested: the Studio page in a real browser (no browser here), speed with many objects.

## Changes in round 6 (bill of materials)
- New: `core/engine/bom.js`, `core/engine/xlsx.js`, `core/tests/bom.mjs`
- Changed: `app/index.html` (BOM button, dialog, styles), `app/studio.js` (BOM dialog, CSV / XLSX download, arrow keys ignored while the dialog is open), `core/package.json` (npm test runs bom.mjs), `core/schema/component.schema.json` and `core/export/formats.json` (documentation only), `README.md`, `app/README.md`, `core/README.md`, `docs/STUDIO.md`
- Changed (one added key each, ids unchanged, old assemblies open as before): `di-bend-90`, `di-bend-45`, `di-tee`, `gate-valve`, `door`, `rcc-column` got `"bom": { "ignore": [...] }`
- Tested: `cd core && npm test` passes. `tests/bom.mjs` (114 checks): the pump station example gives exactly 12 objects, 11 lines, bend quantity 2, pipes 1.2 / 1.5 / 2 m and 4.7 m total; grouping rules; every library component gives a BOM line; rebar schedule of the column example (6 bars 17.52 m 27.65 kg, 19 stirrups 21.812 m 8.61 kg, total 36.26 kg, checked by hand); CSV (quotes, line breaks, formula-looking names); XLSX (own ZIP reader with CRC check, XML well-formedness, values, second sheet). Also run by hand, outside `npm test`: the XLSX opened in LibreOffice (converted to PDF and CSV) and read with openpyxl, values identical; the real Studio page in headless Chromium (Load example, click BOM, read the dialog, click both download buttons and read the downloaded files, key guard, Escape, empty design message, HTML in the design name).
- Not tested: Microsoft Excel itself; Safari, Firefox and phones; the browser run used a software renderer and three.js r128 served locally instead of the CDN; very large designs (800 objects were tested in the engine only).
- Nothing to delete.

## Changes in this update (round 5: pump house parts and easy placement)
- New: `core/engine/gen/pipefit.js`, `core/tests/pipefit.mjs`, `core/examples/pump-station-line.assembly.json`; components `di-bend-90`, `di-bend-45`, `di-tee`, `di-reducer`, `dismantling-joint`, `check-valve`, `butterfly-valve`, `rcc-beam`, `pump-plinth`
- Changed: `core/engine/snap.js` (fromPort / toPort, inlet preference, `bind`, `rotateInstance`), `core/engine/generate.js` (registers bend, tee, reducer), `core/rules/port-rules.json` (bearing <-> face-v), `core/package.json` (npm test runs pipefit tests), `app/studio.js` (new ids, port choice, move / turn buttons, arrow keys, "Move with attached parts" on by default), `app/README.md`, `core/README.md`, `docs/STUDIO.md`
- Tested: `cd core && npm test` = 110 checks (42 new): every size of every new part, all four turns, size adoption, reducer rules, port choice, rotate keeps links, beam on column, a 9-part pump line with no overlap.
- Not tested in a real browser: the new buttons, the port select, arrow keys, and how bends look in 3D (syntax check only).
- Nothing to delete.

## Changes in round 4 (open the Studio easily)
- New: `start-studio.bat` (Windows: starts a local server and opens the Studio)
- Changed: `site/index.html` ("Open 3D Studio" button + menu link to `../app/index.html`), `app/index.html` (clear red message for `file://` and for three.js load failure, "Getting started" box, three.js is loaded before `studio.js`), `app/studio.js` (hides the Getting started box once a model is placed; names the failing JSON file), `README.md`, `app/README.md`, `docs/STUDIO.md`
- Nothing to delete, nothing to move. No engine change; `cd core && npm test` still passes.
- Not tested in a real browser: the new button, banner and start box were checked only by syntax check.

## Changes in round 3 (rich door)
- New: `core/engine/generate.js` (generator registry), `core/engine/gen/door.js` (door generator), `core/tests/door.mjs` (door tests)
- Replaced: `core/library/components/door.json` (same id `door`; rich options, see "Door" above)
- Changed: `core/engine/assembly.js` (choice parameters with `options`, generator components, per-shape `color` / `opacity`, cylinder `rot`),
  `core/engine/snap.js` (ports come from the generator), `core/engine/export.js` (GLB uses shape colour), `core/schema/component.schema.json`,
  `core/package.json` (npm test runs the door tests too), `app/studio.js` (choice selects in Properties, Details list, glass colour/opacity),
  `app/README.md`, `core/README.md`, `docs/STUDIO.md`
- `manifest.json` already contains `door`, so no id was added.
- Nothing to delete.

## Changes in round 2
- New: `core/engine/io.js`, `core/engine/export.js`
- Changed: `app/index.html`, `app/studio.js` (conflict panel, Save, Load, Export GLB, Export OBJ, design name), `core/tests/run.mjs` (12 new checks),
  `app/README.md`, `docs/STUDIO.md`, `core/README.md`
- Nothing to delete.

## Changes in round 1 (earlier)
- New: `app/index.html`, `app/studio.js`, `app/README.md`, `docs/STUDIO.md`; components brick-wall, boundary-wall, door, window, gate, rcc-slab, end-suction-pump
- Changed: `core/engine/snap.js` (autoAttach prefers the port facing the selected one), `core/rules/port-rules.json` (face-h, face-v), `README.md`, `core/README.md`
