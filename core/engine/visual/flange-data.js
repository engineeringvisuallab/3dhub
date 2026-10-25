// EN 1092-2 flange sizes used by the visual meshes: DN -> [outer dia, bolt circle, number of bolts, bolt hole dia, thickness].
// DN 100..600 are the same numbers as library/standards/en1092-2-flanges.json (core/tests/visual.mjs checks that they stay equal).
// DN 50, 65, 80, 125 are only needed by the pump (generic envelope, PN16 values from models/water-supply/pumps).
export const FLANGE = {
  PN16: { 50: [165, 125, 4, 16, 19], 65: [185, 145, 4, 16, 19], 80: [200, 160, 8, 16, 19], 100: [220, 180, 8, 16, 19], 125: [250, 210, 8, 16, 19],
    150: [285, 240, 8, 20, 19], 200: [340, 295, 12, 20, 20], 250: [405, 355, 12, 24, 22], 300: [460, 410, 12, 24, 24.5],
    400: [580, 525, 16, 27, 28], 500: [715, 650, 20, 33, 31.5], 600: [840, 770, 20, 36, 36] },
  PN10: { 50: [165, 125, 4, 16, 19], 65: [185, 145, 4, 16, 19], 80: [200, 160, 8, 16, 19], 100: [220, 180, 8, 16, 19], 125: [250, 210, 8, 16, 19],
    150: [285, 240, 8, 20, 19], 200: [340, 295, 8, 20, 20], 250: [395, 350, 12, 20, 22], 300: [445, 400, 12, 20, 24.5],
    400: [565, 515, 16, 24, 24.5], 500: [670, 620, 20, 24, 26.5], 600: [780, 725, 20, 27, 30] }
};
// PN other than 10 / 16 uses the PN16 row (the visual only; DN/PN matching stays in port-rules.json)
export function flangeData(DN, PN = 16) {
  const t = (PN <= 10 ? FLANGE.PN10 : FLANGE.PN16)[DN];
  if (!t) throw new Error(`No flange data for DN ${DN}`);
  const [OD, k, n, hole, T] = t; return { OD, k, n, hole, T, DN };
}
// pipe outside diameter by DN (ductile iron, same table as the components)
export const PIPE_OD = { 50: 66, 65: 82, 80: 98, 100: 118, 125: 144, 150: 170, 200: 222, 250: 274, 300: 326, 400: 429, 500: 532, 600: 635 };
