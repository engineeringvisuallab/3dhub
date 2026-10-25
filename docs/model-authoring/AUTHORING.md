# Preparing a model for the Hub
1. Units mm, Y up, pipe axis along X, pipe centerline at Y=0, origin at model centre.
2. Name parts: <Part>_<DN>_<PN> e.g. GateValve_300_PN16.
3. Add ports (flange faces) as empties named PORT_in / PORT_out with arrow along outward direction.
4. Add clearance boxes named CLR_handwheel, CLR_bolt, CLR_access.
5. Fill model.json using models/_schema/model.schema.json.
6. Export GLB for preview. Original .blend/.skp goes in source/.

## Functional models (required)
- Every model is a hierarchy of named groups, e.g. Door: Chowkath, Palla (Hardware: Lever, Latch), Wall. Valve: Body, Gate, Handwheel.
- Moving parts have their own group with the pivot at its axis, unique names.
- States are ON/OFF (Open/Close). GLB carries animation clips named Open and Close; spec.json lists groups and animations.

## Glass and extras (doors, windows)
- Glass kinds: clear, frosted, tinted grey/bronze, reflective blue, low-E, reeded, pebble, wired, stained, mirror.
- Treatment: annealed, tempered, laminated. Safety glass is mandatory for all door glass, and for windows with glass below 800 mm from the floor or panes over 2 m2.
- Door extras: handle (lever, knob, pull bar, digital), side glass, fanlight, peephole, closer, kick plate, letterbox, number plate.
- Window extras: mosquito net, roller / venetian blind, louvred side shutters, safety grill.

## Drawings and DXF (all models)
Every model page makes a real vector drawing from the 3D geometry, not a screenshot: plan, front / back / left / right elevation, section A-A and section B-B on one A3 sheet.
- Hidden lines are removed (software z-buffer), silhouettes of round parts are kept, section cuts are hatched.
- Export: button "Export DXF", format "Drawings only (DXF)", or inside the ZIP (`*_drawings.dxf` plus a `*_drawings.png` preview).
- DXF is R12 ASCII, units mm, drawn full size, scale shown on the sheet. Layers: A-VIS (visible lines), A-CUT (cut outline), A-HATCH, A-DIM (overall dimensions), A-TEXT, A-SECT (section marks), A-GROUND, A-FRAME.
- Each page defines `cfg()` with the two cut planes (door/window: vertical at centre + horizontal at 1000 mm / mid height; chamber: along the pipe axis + across at the first valve; staircase: along and across flight 1). Plane positions are in metres.
- Glass meshes carry `material.userData.glass = true`: they do not hide lines and are not hatched.
- Engine: `vdCollect`, `vdEdges`, `vdView`, `vdBuild`, `vdDXF` (pure JS, tested on synthetic geometry).
