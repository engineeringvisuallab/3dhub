# tools

Scripts: validate models, generate thumbnails, build catalog

- `build-generator-room-page.mjs` + `generator-room-page.template.html`: build `models/electrical/generator-room/parametric/generator-room.html` by inlining the engine modules (`node tools/build-generator-room-page.mjs` from the repo root). Re-run it after any change in `core/engine/gen/genroom.js` or `core/engine/visual/genroom.js`.
- `build-substation-page.mjs` + `substation-page.template.html`: build `models/electrical/substation/parametric/substation.html` the same way. It uses `_bundle.mjs`. Re-run the builder after any change in the engine files of that item.
