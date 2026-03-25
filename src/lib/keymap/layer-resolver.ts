import { Layer } from "../types";
import { parseKeycode, ParsedKeycode } from "./keycodes";

/**
 * Resolve the effective keycode for a position, walking down the layer stack
 * to resolve KC_TRNS (transparent) keys.
 *
 * QMK behavior: when a key is KC_TRNS on the current layer, it falls through
 * to the highest active layer below that has a non-transparent key at that position.
 * For visualization, we walk from the given layer down to layer 0.
 */
export function resolveEffectiveKey(
  layers: Layer[],
  layerIndex: number,
  keyIndex: number,
): { parsed: ParsedKeycode; fromLayer: number } {
  for (let i = layerIndex; i >= 0; i--) {
    const kc = layers[i]?.keycodes[keyIndex];
    if (!kc) continue;

    const isTransparent =
      kc === "KC_TRNS" || kc === "_______" || kc === "KC_TRANSPARENT";

    if (!isTransparent) {
      return { parsed: parseKeycode(kc), fromLayer: i };
    }
  }

  // If we reach here, every layer is transparent at this position — treat as none
  return {
    parsed: { label: "\u2205", category: "none", raw: "KC_NO" },
    fromLayer: 0,
  };
}
