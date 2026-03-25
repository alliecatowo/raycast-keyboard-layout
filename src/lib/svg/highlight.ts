import { Layer } from "../types";
import { searchKeycodes, parseKeycode } from "../keymap/keycodes";

export interface KeySearchResult {
  boardId: string;
  boardName: string;
  layerIndex: number;
  layerName: string;
  keyIndex: number;
  label: string;
  raw: string;
}

/** Search for a key across all layers of a board, returning matching positions */
export function findKeyInLayers(
  query: string,
  layers: Layer[],
  boardId: string,
  boardName: string,
): KeySearchResult[] {
  if (!query.trim()) return [];

  const results: KeySearchResult[] = [];
  const q = query.toUpperCase().trim();

  // Get matching keycode definitions
  const matchingDefs = searchKeycodes(query);
  const matchingCodes = new Set(matchingDefs.map((d) => d.code.toUpperCase()));

  for (const layer of layers) {
    for (let keyIndex = 0; keyIndex < layer.keycodes.length; keyIndex++) {
      const raw = layer.keycodes[keyIndex];
      if (!raw) continue;

      // Skip transparent/none
      if (raw === "KC_TRNS" || raw === "_______" || raw === "KC_NO" || raw === "XXXXXXX") continue;

      const upperRaw = raw.toUpperCase();

      // Match by: exact code, parsed label, or substring
      let isMatch = matchingCodes.has(upperRaw);

      if (!isMatch) {
        const parsed = parseKeycode(raw);
        if (parsed.label.toUpperCase().includes(q)) isMatch = true;
        if (parsed.holdLabel?.toUpperCase().includes(q)) isMatch = true;
        if (upperRaw.includes(q)) isMatch = true;
      }

      if (isMatch) {
        const parsed = parseKeycode(raw);
        results.push({
          boardId,
          boardName,
          layerIndex: layer.index,
          layerName: layer.name,
          keyIndex,
          label: parsed.label + (parsed.holdLabel ? ` (hold: ${parsed.holdLabel})` : ""),
          raw,
        });
      }
    }
  }

  return results;
}
