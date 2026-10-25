# Column

RCC column, rectangular or round. Page: `parametric/column.html`.

- Rebar is generated from the shared rebar rules, as separate named objects (Main_Bars, Ties, Crossties) - never merged into the concrete.
- User changes bar dia/count, tie dia/spacing, seismic end zones, cover, embed into footing, top lap, and can add extra ties at chosen heights.
- Cross-ties are added automatically where a bar would be more than 150 mm clear from a supported bar.
- Download: GLB, OBJ (concrete and rebar as separate objects, or only one of them), DXF drawing (elevation + section), bar bending schedule (CSV), spec.json.
- Rules are indicative (ACI 318 / BNBC style). Designs that fail cannot be downloaded.
