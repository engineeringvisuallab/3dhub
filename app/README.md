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
- The 3D view draws the REAL shape of each part (`core/engine/visual`: flanges with bolt holes, torus bends, valve bodies, handwheels), not the collision boxes. GLB / OBJ export uses the same mesh.
- 3D scene: orbit (left drag), pan (right drag or Shift+drag), zoom (wheel), grid, "Frame all".
- "3D models" tab (left): categories + search. Drag a model into the scene to place it freely.
- Select an object, then click a model: it **auto-attaches** to a free compatible port of the selected object (size/PN adopted).
- Properties (right): **Next part attaches at** (choose the free port, or Auto), **Move and turn** (step 10-1000 mm, -X +X -Y +Y Down Up, Turn +-90; arrow keys and Page Up / Down do the same), parameters (numbers, or choice lists for models like the door), a Details list for generated models, position, rotation, "move with attached parts", delete.
- **Conflict panel** (right, under Properties): uses `core/engine/collision.js`. Conflicts are red, warnings amber.
  Objects in a conflict are tinted red in the scene. Click an item: it selects the object and frames the objects involved.
- **Save / Load** (header): Save downloads `<name>.json` (assembly, see `core/schema/assembly.schema.json`). Load reads it back and
  rejects bad files with a clear message (unknown model, out-of-range parameter, broken link).
- **Export GLB / OBJ** (header): generated from the assembly with our own writer (`core/engine/export.js`).
  Units: metres, Y-up (the glTF rule). Helper zones (clearance, openings) are not exported.
- **Drawing** (header): plan, four elevations and two sections on one A3 sheet, download as DXF or SVG (see `docs/STUDIO.md`). Needs `docs/vdraw-engine.js`.
- **BOM** (header): bill of materials of the whole design in a dialog, grouped by model and size (name, id, DN / PN or main dimensions, quantity; length in metres for straight pipe only). **Download CSV** and **Download XLSX** give the same tables. If the design has rebar sets (they come from a loaded assembly file, there is no rebar editor yet) the bar schedule is a second table. No weights or prices are invented. Code: `../core/engine/bom.js` (numbers, CSV), `../core/engine/xlsx.js` (XLSX writer). Arrow keys and Delete are ignored while the dialog is open.
- Status bar: object/link count, broken links, conflict and warning counts.

## Moving parts
"Move with attached parts" is ticked by default: moving or turning a part moves everything connected to it, so a pipe line stays joined. Untick it to move one part alone (its links are removed and the status bar says so).

## Next
- Convert the rich parametric models in `models/` into library components (see `docs/STUDIO.md`).
- Rebar panel (edit rebar sets inside the Studio; the bar schedule export is done, it is the second table of the BOM).
