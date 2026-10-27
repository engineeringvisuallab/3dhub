# Generator room (DG set room with all facilities)

One page (parametric/generator-room.html) and one Studio component (`core/library/components/generator-room.json`): a complete diesel generator room.
Both use the same geometry code (`core/engine/gen/genroom.js` = sizes, rules, collision shapes; `core/engine/visual/genroom.js` = real mesh).
The page is built from `tools/generator-room-page.template.html` with `node tools/build-generator-room-page.mjs` (inlines the engine, so there is one source of truth).

What is inside: floor slab (with cable trench), walls with real openings, roof slab with parapet, 1 or 2 DG sets on plinths (skid, radiator with fan, engine, alternator),
exhaust (bellows, silencer, lagged pipe, wall sleeve, stack with brackets and rain cap, or straight through the roof), day fuel tank with bund, fill and supply lines,
cooling-air inlet louvres and discharge louvre, equipment door (double leaf or rolling shutter) per set, personnel door, control (AMF) panel, battery rack and charger,
cable trench with cover plates and cables, monorail chain hoist, fire extinguishers and smoke detectors, LED lights, emergency and exit light, extraction fan, acoustic lining, floor drain.

Parameters: DG set 62.5 to 1000 kVA, 1 or 2 sets, exhaust exit, equipment door, room size (0 = automatic smallest), wall thickness, stack height, day tank autonomy, nine facility switches, door opening %, colours, cutaway (view only).
Rules (indicative, see `RULE` in `genroom.js`): clearances around the set, room height from the exhaust line, inlet louvre free area at 4 m/s, discharge speed up to 8 m/s, bund 110 % of the tank, stack guideline 0.2 x sqrt(kVA) m, hoist half the set mass. A design that fails a rule cannot be downloaded.
Download: ZIP (GLB + OBJ + spec.json), GLB or OBJ. The download always holds the full room (roof and all walls), even when the cutaway is on.

Honest limits: sizes are generic envelopes, not a maker's catalogue; air, fuel and stack numbers are rules of thumb; no structural design of the roof, no earthing or lightning design, no cable sizing, no drawing sheet yet.
Confirm with the DG set maker, the local code and the fire authority. Next: drawing sheet (plan and sections), synchronising panel and fuel bulk tank outside.
