# Parshall flume (Round 1)

First type taken to model level. Everything below is checked by `node core/tests/parshall.mjs`.

## What is there

| Piece | Where |
|---|---|
| Data (Utah Tables 1 to 3, Arkon P1 to P9) | `core/library/wtp/data/parshall.json` |
| Calculations | `core/engine/wtp/parshall.js` |
| 3D geometry (pure, no three.js) | `core/engine/wtp/parshall-geometry.js` |
| Model page (3D, ON/OFF groups, results, checks, plan, elevations, sections, exports through the shared kit) | `models/treatment-plant/rapid-mix/parametric/parshall-flume.html` |
| Page template and build tool | `tools/templates/parshall-flume.html`, `tools/build-parshall-page.mjs` |
| Expert rules (15, each with a source) | `core/library/wtp/rules/rapid-mix-and-measurement.json` |

The page is one file with the data and the engine embedded. After changing the engine, data or template, run `node tools/build-parshall-page.mjs`; the test fails if the page is stale.

## Implemented calculations (status tested)

Free-flow discharge from Ha for 13 sizes (3 in to 8 ft) and the inverse; standard dimensions A to Y; free or submerged check against the transition submergence (Table 2); installation levels for free flow (crest depth and rise of the water upstream); free-flow size selection from maximum flow, downstream depth and allowed rise; correction for an as-built throat width; gauge points (Ha at 2/3 C, Hb tap X and Y); Arkon discharge `Q = a h^b` as a cross-check; checks that mirror rules PF-CHK-001 to 007.

## How the data was verified

- **Table 1** (all 13 rows, 12 columns): read from the rendered page image, not from the OCR text. Tests then check relations that a typing error would break: B = W + 12 in, 2/3 C, the 9 in over 24 in throat slope, the 6 in over 36 in outlet rise, and the converging wall length against the plan geometry.
- **Table 2**: transcribed from the text and the image, tested as a row.
- **Table 3**: the PDF text layer is too damaged to read all 241 rows. Each column of Table 3 is a power law `Q = K Ha^n`, so K and n were recovered by weighted least squares from 28 printed rows (315 cells, read from the clean transcription of the pages). The fit reproduces every one of those cells to within 1.73 units of the last printed digit. For W of 1 ft and above K comes out as 4 W to four digits, which is a further sign the fit is sound. **The 213 rows not used as anchors were not compared one by one.** Use of the table value itself is advised where a design is close to a limit.
- **Worked examples of the report** (1, 4, 5, 6, 7 and Figure 3) are reproduced by the code.
- **Arkon cross-check**: the Arkon equation gives 0 to 10 percent lower flow than the Utah table at the same head for the seven matching widths. The two flumes are not geometrically identical and the head is read at different points (B-prime against 2/3 C), so this is a plausibility band, not a second source for the Utah values.

## Gaps, stated plainly

1. **Submerged-flow discharge is not calculated.** The report gives it only as calibration charts (Figures 6 to 18, with the nomographs 4 and 5). The code detects submergence, warns, and tells the user to use the charts. Digitising twelve log-log charts needs its own careful round and should be checked against Examples 3 and 7 (21.3 cfs and 27.8 cfs).
2. **Hydraulic-jump mixing energy** (G value at the jump) is planned: it needs a method from Schulz and Okun chapter 5, which is a scanned book not yet read.
3. **Figure 19** (head loss through the flume) is a chart and is not used. The installation procedure from the text (Example 6) is implemented instead.
4. **Drawings and exports** come from the shared kit. The page is registered in the catalog and `tools/check-library.mjs` passes, but the page has not been opened in a browser (no browser is available here). The three.js script was run headlessly with the real three.js library and a stub DOM for all 13 sizes without error.
5. The water surface in the 3D model is schematic, and wall and slab thicknesses are indicative.
6. The `Hb` tap position follows Table 1 columns X and Y as read from Figure 2; the exact reading of X and Y should be confirmed against the report figure before use in a drawing.
