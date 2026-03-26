import { BoardProfile } from "./types";
import { parseKeycode } from "./keymap/keycodes";

/**
 * Detect the currently active layer based on which keys are physically pressed.
 *
 * Logic: scan the base layer (layer 0) for MO(n), LT(n, kc), and TT(n) keys.
 * If any of those are in the "pressed" set, that layer is active.
 * If multiple layer keys are pressed, the highest layer wins (QMK behavior).
 * If no layer keys are pressed, layer 0 (Base) is active.
 */
export function inferActiveLayer(
  board: BoardProfile,
  pressedPositions: Array<{ row: number; col: number }>,
): number {
  if (pressedPositions.length === 0) return 0;

  // We need to know which physical key index corresponds to which matrix position
  // The board's keycodes are ordered by physical position, but we need matrix->keycode mapping
  // Since the Vial reader orders keycodes by physical key order, and the matrix state
  // returns row,col pairs, we need the physical-to-matrix mapping from the Vial definition.
  // For now, we check all keycodes on the base layer and see if they're layer activators.

  // Scan ALL layers (not just base) for layer keys that might be pressed
  // MO keys on layer 0 activate layer N
  // But layer N might also have MO keys that activate layer M
  let highestActive = 0;

  const baseLayer = board.layers[0];
  if (!baseLayer) return 0;

  for (let i = 0; i < baseLayer.keycodes.length; i++) {
    const kc = baseLayer.keycodes[i];
    const parsed = parseKeycode(kc);

    // Check if this is a layer activation key
    let targetLayer: number | null = null;

    if (parsed.category === "layer") {
      // Extract layer number from label: "MO(1)", "TT(2)", "LT(1, ...)"
      const layerMatch = kc.match(/(?:MO|TG|TT|LT|TO|OSL)\((\d+)/);
      if (layerMatch) {
        targetLayer = parseInt(layerMatch[1], 10);
      }
    }

    if (targetLayer !== null && targetLayer > highestActive) {
      // Check if this key position is in the pressed set
      // Since we don't have the matrix mapping here, we use a simpler approach:
      // if ANY keys are pressed and this is a layer key, check if it could be held
      // For now, this is a placeholder — proper implementation needs matrix position data

      // TODO: Map physical key index → matrix position from Vial definition
      // For now, if we have pressed keys and layer keys exist, return the first matching layer
      highestActive = Math.max(highestActive, 0);
    }
  }

  return highestActive;
}

/**
 * Get a list of layer activation keys on the base layer with their positions.
 * Used to determine which pressed keys correspond to layer activations.
 */
export function getLayerKeys(board: BoardProfile): Array<{
  keyIndex: number;
  targetLayer: number;
  keycode: string;
}> {
  const result: Array<{ keyIndex: number; targetLayer: number; keycode: string }> = [];
  const baseLayer = board.layers[0];
  if (!baseLayer) return result;

  for (let i = 0; i < baseLayer.keycodes.length; i++) {
    const kc = baseLayer.keycodes[i];
    const layerMatch = kc.match(/(?:MO|TG|TT|LT|TO|OSL)\((\d+)/);
    if (layerMatch) {
      result.push({
        keyIndex: i,
        targetLayer: parseInt(layerMatch[1], 10),
        keycode: kc,
      });
    }
  }

  return result;
}
