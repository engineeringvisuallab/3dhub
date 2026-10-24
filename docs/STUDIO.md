# EVLab 3D Studio - purpose and guide

Not tested in a real browser yet: the engine (attach, conflicts, save/load, GLB/OBJ writers, the rich door) is covered by `cd core && npm test`;
the page itself (buttons, panel, how the door looks in 3D) needs a first run on the owner's side. The Properties panel code for the door was run headless with a fake page (no real browser).

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
| Components | `core/library/components/*.json` | One json per model: parameters, shapes (box/cylinder), ports, tags |
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
| **door** (rich, 17 designs) | building | `face-h` left/right (frame outer edges); see "Door" below |
| brick-wall, boundary-wall, window, gate | building | `face-h` left/right; `face-v` top/bottom for walls |
| rcc-slab | building | `face-v` (sits on a wall top, a wall stands on it) |
| rcc-column, rcc-wall-opening, table | structure / misc | (see `core/README.md`) |
| **di-bend-90, di-bend-45, di-tee, di-reducer** | water-supply / fitting | flange ports, DN/PN adopted; turn / branch = up, down, left, right |
| **dismantling-joint** (length 150-600), **check-valve**, **butterfly-valve** | water-supply | flange ports, same DN/PN |
| **rcc-beam**, **pump-plinth** | structure | `face-v`: beam on a column top, slab on a beam, plinth on a slab |

Example: select a wall, click Door, click Window, click Brick wall, click Gate = one wall line. Select the first wall, click Slab = slab on top.

## Add a new model to the Studio
1. Write `core/library/components/<id>.json` (copy `door.json` as a template). Origin of building parts = bottom centre.
2. Add `<id>` to the `IDS` list at the top of `app/studio.js`.
3. Run `cd core && npm test`, then open the Studio and try attaching it.
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
3. Register the id in IDS of app/studio.js. Test with core/tests.
4. Give me ONLY new/changed files, in folder structure. All software text English. Do not copy any CAD code.
Order: window, staircase, column, railing, room-interior, rebar   (door is done: see core/engine/gen/door.js, use it as the pattern).
If the model has many options like the door, add a generator in core/engine/gen/ and register it in core/engine/generate.js.
```

## Pump house (what the owner wants the Studio for)
A big model such as a pump house: civil structure (slab, plinth, column, beam, walls, door, window) plus a pipe line (pump, dismantling joint, check valve, butterfly / gate valve, bends, tee, reducer) at different heights.
How to build: select a part, optionally pick **Next part attaches at** (port A / B / C ...), click the next model in the list: it attaches and becomes the selected part, so a line grows click by click.
For a bend or tee, set Turn / Branch (up, down, left, right) in Properties. Move, raise or turn the whole line with the buttons ("Move with attached parts" ticked).
Load `core/examples/pump-station-line.assembly.json` to see a finished line.
Honest limits: a bend is two straight arms (a smooth bend needs a new `torus` shape type in `core/engine/shapes.js`, not done); sizes are a generic envelope; walls attach only in a straight line (no corner part yet), so place wall corners by position;
the pump has flange ports only, so it is placed by position (raise it on a plinth so flanged fittings clear the floor: the conflict checker reports it if not);
pipe through a wall uses `rcc-wall-opening` (round opening) by position. Next steps are listed below.

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
- `IDS` in `app/studio.js` already contains `door`, so no id was added.
- Nothing to delete.

## Changes in round 2
- New: `core/engine/io.js`, `core/engine/export.js`
- Changed: `app/index.html`, `app/studio.js` (conflict panel, Save, Load, Export GLB, Export OBJ, design name), `core/tests/run.mjs` (12 new checks),
  `app/README.md`, `docs/STUDIO.md`, `core/README.md`
- Nothing to delete.

## Changes in round 1 (earlier)
- New: `app/index.html`, `app/studio.js`, `app/README.md`, `docs/STUDIO.md`; components brick-wall, boundary-wall, door, window, gate, rcc-slab, end-suction-pump
- Changed: `core/engine/snap.js` (autoAttach prefers the port facing the selected one), `core/rules/port-rules.json` (face-h, face-v), `README.md`, `core/README.md`
