# app - EVLab 3D Studio (browser app)

**What this is:** a "ready to build" assembly tool. It is NOT a drafting tool like AutoCAD.
The user takes ready 3D models from the library (wall, door, window, slab, gate, pipe, valve, pump ...) and
**attaches them to each other** to build a bigger model (a building, a boundary wall with gate, a pump-pipe-valve line).
No existing CAD software is copied: own UI, own code, own library.

**Language rule:** all text inside the software (buttons, menus, messages, errors) is English only. No Bangla.

## Files
- `index.html` - the page (layout + styles). Loads three.js from a CDN.
- `studio.js` - the interface. Uses the engine in `../core/engine` (assembly, snap, collision, io, export). Z is up, units are mm.

## How to run
Windows: double-click `start-studio.bat` in the repo root (needs Python). It starts a local server and opens the Studio.
The site home (`site/index.html`) has an **Open 3D Studio** button and a "3D Studio" menu link.
If the page is opened by double-click (`file://`) or three.js cannot load, a red message in the 3D area says what to do.
Manual way:
Open through a web server (browsers block JSON loading from `file://`):
`python -m http.server` in the repo root, then open `http://localhost:8000/app/index.html`.
On GitHub Pages: `<site>/app/index.html`.

## What works now
- 3D scene: orbit (left drag), pan (right drag or Shift+drag), zoom (wheel), grid, "Frame all".
- "3D models" tab (left): categories + search. Drag a model into the scene to place it freely.
- Select an object, then click a model: it **auto-attaches** to a free compatible port of the selected object (size/PN adopted).
- Properties (right): parameters (numbers, or choice lists for models like the door), a Details list for generated models, position, rotation, "move with attached parts", delete.
- **Conflict panel** (right, under Properties): uses `core/engine/collision.js`. Conflicts are red, warnings amber.
  Objects in a conflict are tinted red in the scene. Click an item: it selects the object and frames the objects involved.
- **Save / Load** (header): Save downloads `<name>.json` (assembly, see `core/schema/assembly.schema.json`). Load reads it back and
  rejects bad files with a clear message (unknown model, out-of-range parameter, broken link).
- **Export GLB / OBJ** (header): generated from the assembly with our own writer (`core/engine/export.js`).
  Units: metres, Y-up (the glTF rule). Helper zones (clearance, openings) are not exported.
- Status bar: object/link count, broken links, conflict and warning counts.

## Next
- Convert the rich parametric models in `models/` into library components (see `docs/STUDIO.md`).
- Rebar panel, bar schedule export, drawing sheets (plan / section / elevation).
