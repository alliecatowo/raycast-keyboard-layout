/**
 * Maps QMK numeric keycodes (as received from Vial USB) to their string names.
 *
 * QMK keycodes are 16-bit values. The basic keycodes (0x0000–0x00FF) map to
 * HID usage IDs. Modifiers, layer functions, etc. are encoded in the upper bits.
 *
 * Reference: quantum/keycodes.h in QMK firmware
 */

// Basic keycodes (HID usage table)
const BASIC_KEYCODES: Record<number, string> = {
  0x0000: "KC_NO",
  0x0001: "KC_TRNS",
  0x0004: "KC_A",
  0x0005: "KC_B",
  0x0006: "KC_C",
  0x0007: "KC_D",
  0x0008: "KC_E",
  0x0009: "KC_F",
  0x000a: "KC_G",
  0x000b: "KC_H",
  0x000c: "KC_I",
  0x000d: "KC_J",
  0x000e: "KC_K",
  0x000f: "KC_L",
  0x0010: "KC_M",
  0x0011: "KC_N",
  0x0012: "KC_O",
  0x0013: "KC_P",
  0x0014: "KC_Q",
  0x0015: "KC_R",
  0x0016: "KC_S",
  0x0017: "KC_T",
  0x0018: "KC_U",
  0x0019: "KC_V",
  0x001a: "KC_W",
  0x001b: "KC_X",
  0x001c: "KC_Y",
  0x001d: "KC_Z",
  0x001e: "KC_1",
  0x001f: "KC_2",
  0x0020: "KC_3",
  0x0021: "KC_4",
  0x0022: "KC_5",
  0x0023: "KC_6",
  0x0024: "KC_7",
  0x0025: "KC_8",
  0x0026: "KC_9",
  0x0027: "KC_0",
  0x0028: "KC_ENT",
  0x0029: "KC_ESC",
  0x002a: "KC_BSPC",
  0x002b: "KC_TAB",
  0x002c: "KC_SPC",
  0x002d: "KC_MINS",
  0x002e: "KC_EQL",
  0x002f: "KC_LBRC",
  0x0030: "KC_RBRC",
  0x0031: "KC_BSLS",
  0x0033: "KC_SCLN",
  0x0034: "KC_QUOT",
  0x0035: "KC_GRV",
  0x0036: "KC_COMM",
  0x0037: "KC_DOT",
  0x0038: "KC_SLSH",
  0x0039: "KC_CAPS",
  0x003a: "KC_F1",
  0x003b: "KC_F2",
  0x003c: "KC_F3",
  0x003d: "KC_F4",
  0x003e: "KC_F5",
  0x003f: "KC_F6",
  0x0040: "KC_F7",
  0x0041: "KC_F8",
  0x0042: "KC_F9",
  0x0043: "KC_F10",
  0x0044: "KC_F11",
  0x0045: "KC_F12",
  0x0046: "KC_PSCR",
  0x0047: "KC_SCRL",
  0x0048: "KC_PAUS",
  0x0049: "KC_INS",
  0x004a: "KC_HOME",
  0x004b: "KC_PGUP",
  0x004c: "KC_DEL",
  0x004d: "KC_END",
  0x004e: "KC_PGDN",
  0x004f: "KC_RGHT",
  0x0050: "KC_LEFT",
  0x0051: "KC_DOWN",
  0x0052: "KC_UP",
  0x0053: "KC_NUM",
  0x0054: "KC_PSLS",
  0x0055: "KC_PAST",
  0x0056: "KC_PMNS",
  0x0057: "KC_PPLS",
  0x0058: "KC_PENT",
  0x0059: "KC_P1",
  0x005a: "KC_P2",
  0x005b: "KC_P3",
  0x005c: "KC_P4",
  0x005d: "KC_P5",
  0x005e: "KC_P6",
  0x005f: "KC_P7",
  0x0060: "KC_P8",
  0x0061: "KC_P9",
  0x0062: "KC_P0",
  0x0063: "KC_PDOT",
  0x0065: "KC_APP",
  0x0068: "KC_F13",
  0x0069: "KC_F14",
  0x006a: "KC_F15",
  0x006b: "KC_F16",
  0x006c: "KC_F17",
  0x006d: "KC_F18",
  0x006e: "KC_F19",
  0x006f: "KC_F20",
  0x0070: "KC_F21",
  0x0071: "KC_F22",
  0x0072: "KC_F23",
  0x0073: "KC_F24",
  // Modifiers
  0x00e0: "KC_LCTL",
  0x00e1: "KC_LSFT",
  0x00e2: "KC_LALT",
  0x00e3: "KC_LGUI",
  0x00e4: "KC_RCTL",
  0x00e5: "KC_RSFT",
  0x00e6: "KC_RALT",
  0x00e7: "KC_RGUI",
  // Media
  0x00a8: "KC_MUTE",
  0x00a9: "KC_VOLU",
  0x00aa: "KC_VOLD",
};

// Modifier bits for mod-tap and layer-tap
const MOD_BITS: Record<number, string> = {
  0x01: "MOD_LCTL",
  0x02: "MOD_LSFT",
  0x04: "MOD_LALT",
  0x08: "MOD_LGUI",
  0x11: "MOD_RCTL",
  0x12: "MOD_RSFT",
  0x14: "MOD_RALT",
  0x18: "MOD_RGUI",
};

/**
 * Convert a QMK numeric keycode to its string representation.
 * Handles basic keys, mod-tap, layer-tap, MO, TG, TO, OSL, OSM.
 */
export function numericKeycodeToString(keycode: number): string {
  // KC_NO
  if (keycode === 0x0000) return "KC_NO";

  // KC_TRNS
  if (keycode === 0x0001) return "KC_TRNS";

  // Basic keycodes (0x0004–0x00FF)
  if (keycode <= 0x00ff) {
    return BASIC_KEYCODES[keycode] ?? `KC_${keycode.toString(16).toUpperCase().padStart(4, "0")}`;
  }

  // QMK keycode ranges (from quantum/keycodes.h):
  // 0x0100–0x1FFF: Mods + basic key
  // 0x4000–0x4FFF: Layer Tap (LT)
  // 0x5100–0x51FF: Momentary layer (MO)
  // 0x5200–0x52FF: Default layer (DF)
  // 0x5300–0x53FF: Toggle layer (TG)
  // 0x5400–0x54FF: One-shot layer (OSL)
  // 0x5500–0x55FF: To layer (TO)
  // 0x5C00–0x5CFF: One-shot mod (OSM)
  // 0x6000–0x7FFF: Mod-Tap (MT)

  // Mod + basic key (0x0100–0x1FFF)
  if (keycode >= 0x0100 && keycode <= 0x1fff) {
    const mods = (keycode >> 8) & 0x1f;
    const basic = keycode & 0xff;
    const basicStr = BASIC_KEYCODES[basic] ?? `0x${basic.toString(16)}`;
    const modStr = MOD_BITS[mods] ?? `MOD(0x${mods.toString(16)})`;
    return `${modStr}(${basicStr})`;
  }

  // Layer-Tap: LT(layer, kc) — 0x4000–0x4FFF
  if (keycode >= 0x4000 && keycode <= 0x4fff) {
    const layer = (keycode >> 8) & 0x0f;
    const basic = keycode & 0xff;
    const basicStr = BASIC_KEYCODES[basic] ?? `0x${basic.toString(16)}`;
    return `LT(${layer}, ${basicStr})`;
  }

  // MO(layer) — 0x5100–0x51FF
  if (keycode >= 0x5100 && keycode <= 0x51ff) {
    return `MO(${keycode & 0xff})`;
  }

  // TG(layer) — 0x5300–0x53FF
  if (keycode >= 0x5300 && keycode <= 0x53ff) {
    return `TG(${keycode & 0xff})`;
  }

  // OSL(layer) — 0x5400–0x54FF
  if (keycode >= 0x5400 && keycode <= 0x54ff) {
    return `OSL(${keycode & 0xff})`;
  }

  // TO(layer) — 0x5500–0x55FF
  if (keycode >= 0x5500 && keycode <= 0x55ff) {
    return `TO(${keycode & 0xff})`;
  }

  // OSM(mod) — 0x5C00–0x5CFF
  if (keycode >= 0x5c00 && keycode <= 0x5cff) {
    const mod = keycode & 0xff;
    const modStr = MOD_BITS[mod] ?? `MOD(0x${mod.toString(16)})`;
    return `OSM(${modStr})`;
  }

  // Mod-Tap: MT(mod, kc) — 0x6000–0x7FFF
  if (keycode >= 0x6000 && keycode <= 0x7fff) {
    const mods = (keycode >> 8) & 0x1f;
    const basic = keycode & 0xff;
    const basicStr = BASIC_KEYCODES[basic] ?? `0x${basic.toString(16)}`;
    const modStr = MOD_BITS[mods] ?? `MOD(0x${mods.toString(16)})`;
    return `MT(${modStr}, ${basicStr})`;
  }

  // QK_BOOT (0x5C10 in some versions, 0x7C00 in others)
  if (keycode === 0x7c00 || keycode === 0x5c10) return "QK_BOOT";

  // Fallback: hex representation
  return `0x${keycode.toString(16).toUpperCase().padStart(4, "0")}`;
}
