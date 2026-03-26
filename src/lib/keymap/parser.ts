import * as nodeCrypto from "crypto";
import { BoardProfile, Layer, QmkKeymapFile } from "../types";

/** Layer name suggestions based on common keycode patterns */
const LAYER_HEURISTICS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /KC_(UP|DOWN|LEFT|RGHT|RIGHT|HOME|END|PGUP|PGDN)/i, name: "Nav" },
  { pattern: /KC_F\d+/i, name: "Fn" },
  { pattern: /KC_(MUTE|VOLU|VOLD|MNXT|MPRV|MPLY)/i, name: "Media" },
  { pattern: /KC_(MS_|BTN|WH_|ACL)/i, name: "Mouse" },
  { pattern: /KC_P\d|KC_NUM|KC_PDOT|KC_PENT/i, name: "Numpad" },
  { pattern: /KC_(TILD|EXLM|AT|HASH|DLR|PERC|CIRC|AMPR|ASTR|LPRN|RPRN)/i, name: "Sym" },
];

/** Auto-suggest a layer name based on its keycodes */
function suggestLayerName(index: number, keycodes: string[]): string {
  if (index === 0) return "Base";

  // Count non-transparent, non-none keys by heuristic category
  const nonTrivial = keycodes.filter((kc) => kc !== "KC_TRNS" && kc !== "KC_NO" && kc !== "_______" && kc !== "XXXXXXX");
  const counts = new Map<string, number>();

  for (const kc of nonTrivial) {
    for (const { pattern, name } of LAYER_HEURISTICS) {
      if (pattern.test(kc)) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
  }

  // Pick the most common category
  let best = "";
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }

  return best || `Layer ${index}`;
}

/** Validate and parse a QMK keymap.json file */
export function parseQmkKeymapJson(content: string): QmkKeymapFile {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON: could not parse keymap file");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid keymap: expected a JSON object");
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.keyboard !== "string" || !obj.keyboard) {
    throw new Error("Invalid keymap: missing 'keyboard' field");
  }
  if (typeof obj.layout !== "string" || !obj.layout) {
    throw new Error("Invalid keymap: missing 'layout' field");
  }
  if (!Array.isArray(obj.layers) || obj.layers.length === 0) {
    throw new Error("Invalid keymap: missing or empty 'layers' array");
  }

  // Validate each layer is an array of strings
  for (let i = 0; i < obj.layers.length; i++) {
    const layer = obj.layers[i];
    if (!Array.isArray(layer)) {
      throw new Error(`Invalid keymap: layer ${i} is not an array`);
    }
    for (let j = 0; j < layer.length; j++) {
      if (typeof layer[j] !== "string") {
        throw new Error(`Invalid keymap: layer ${i}, key ${j} is not a string`);
      }
    }
  }

  return {
    keyboard: obj.keyboard,
    keymap: typeof obj.keymap === "string" ? obj.keymap : "custom",
    layout: obj.layout,
    layers: obj.layers as string[][],
  };
}

/** Convert a parsed QMK keymap into a BoardProfile (without physical layout — that comes from QMK API) */
export function keymapToBoardProfile(
  keymap: QmkKeymapFile,
  name: string,
  sourceFile?: string,
): Omit<BoardProfile, "physicalLayout"> {
  const now = new Date().toISOString();

  const layers: Layer[] = keymap.layers.map((keycodes, index) => ({
    index,
    name: suggestLayerName(index, keycodes),
    keycodes,
  }));

  return {
    id: nodeCrypto.randomUUID(),
    name,
    keyboard: keymap.keyboard,
    layoutKey: keymap.layout,
    firmware: "qmk",
    layers,
    sourceFile,
    createdAt: now,
    updatedAt: now,
  };
}
