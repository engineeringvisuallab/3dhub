// Colours by component tag (used by the Studio viewer, GLB/OBJ export and the visual mesh builders).
export const COLORS = { pipe: 0x3b82c4, valve: 0x2fa36b, concrete: 0x9aa0a6, masonry: 0xb5654a, wood: 0x9c6b3f, glass: 0x7fc4e8, steel: 0x5d6b7a, pump: 0x2b6f9e, rebar: 0xc0392b };
export function colorOf(tags = []) { for (const t of tags) if (COLORS[t]) return COLORS[t]; return 0xc9a36a; }
