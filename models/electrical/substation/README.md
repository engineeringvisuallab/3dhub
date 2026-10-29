# Electrical substation (five types)

One page (parametric/substation.html) and one Studio component (`core/library/components/substation.json`). Both use the same code:
`core/engine/gen/substation.js` (plan, tables, rules, collision shapes, ports) and `core/engine/visual/substation.js` (real mesh).
The page is built with `node tools/build-substation-page.mjs` from `tools/substation-page.template.html` (it inlines the engine, one geometry source).

Types
- **Pole-mounted 11/0.4 kV** (25-200 kVA): single pole up to 63 kVA, H-pole with platform from 100 kVA; HT cross arm, DO fuses, arresters, LT fuse box, stay wire, earth pits, fence.
- **Compact kiosk 11/0.4 kV** (200-1600 kVA): enclosure with RMU (3 ways), transformer and LT panel compartments, louvres, doors, plinth.
- **Indoor 11/0.4 kV** (500-2000 kVA, 1-2 transformers): HT room with MV panel lineup, transformer rooms (soak pit, monorail hoist, door and louvres), LT room (panels, capacitor panel), cable trench, earth bar, lights.
- **Outdoor AIS 33/11 kV or 132/33 kV**: line gantries, line bays (arrester, CVT, isolator, CT, breaker, bus isolator), bus on posts, transformer bays, power transformers on plinths with oil pits, fire walls, NER, jumpers, control building (MV switchgear room, control and relay room, battery room, AC room), capacitor bank, cable trenches, road, masts, flood poles, earth grid and pits, fence with sliding gate.
- **GIS 33/11 kV or 132/33 kV**: GIS hall with bays (bus tank, breaker, disconnectors, control cubicle), wall bushings, line towers, SF6 ducts to the outdoor transformers, overhead crane, same control building, fence, masts.

Rules (indicative, `YARD` and `RULE` in `gen/substation.js`): phase spacing, bay width, terminal and bus heights, sectional clearance 2.8 m / 4.0 m, fence margin, live parts above ground, transformer gap with or without fire wall, oil pit sized for 100 % of the oil, indoor wall and panel clearances, panel counts from transformers and feeders. The plan adapts (voltage and rating snap to what the type offers, notes say so).

Download: ZIP (GLB + OBJ + spec.json with bill of quantities), GLB or OBJ. The download always holds the complete model (no cutaway).

Honest limits: sizes are generic and indicative, not a maker's catalogue or a code; single bus only (no double or transfer bus); GIS cable basement not modelled; no cable, earth mat or relay calculation; no lightning protection zone check; collision uses simple boxes and cylinders (the mesh has the real shapes); no drawing sheet and no per-equipment BOM lines in the Studio yet (one BOM line).
Next: double bus and bus coupler, drawing sheet (plan, single line diagram, elevations), loads and cable sizing.
