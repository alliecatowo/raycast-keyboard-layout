import { VIAL_NUMERIC } from "../keymap/vendored-keycodes";

/**
 * Maps QMK numeric keycodes (as received from Vial USB) to their string names.
 *
 * Ranges from quantum/keycodes.h (QMK keycodes version 0.0.8):
 *
 *   QK_BASIC              0x0000–0x00FF
 *   QK_MODS               0x0100–0x1FFF
 *   QK_MOD_TAP            0x2000–0x3FFF
 *   QK_LAYER_TAP          0x4000–0x4FFF
 *   QK_LAYER_MOD          0x5000–0x51FF
 *   QK_TO                 0x5200–0x521F
 *   QK_MOMENTARY          0x5220–0x523F
 *   QK_DEF_LAYER          0x5240–0x525F
 *   QK_TOGGLE_LAYER       0x5260–0x527F
 *   QK_ONE_SHOT_LAYER     0x5280–0x529F
 *   QK_ONE_SHOT_MOD       0x52A0–0x52BF
 *   QK_LAYER_TAP_TOGGLE   0x52C0–0x52DF
 *   QK_PERSISTENT_DEF     0x52E0–0x52FF
 *   QK_SWAP_HANDS         0x5600–0x56FF
 *   QK_TAP_DANCE          0x5700–0x57FF
 *   QK_MAGIC              0x7000–0x70FF
 *   QK_MIDI               0x7100–0x71FF
 *   QK_MACRO              0x7700–0x777F
 *   QK_LIGHTING           0x7800–0x78FF
 *   QK_QUANTUM            0x7C00–0x7DFF
 *   QK_KB                 0x7E00–0x7E3F  (Vial maps USER00–USER15 here!)
 *   QK_USER               0x7E40–0x7FFF
 */

// ── Basic keycodes (HID usage table) ─────────────────────

const BASIC_KEYCODES: Record<number, string> = {
  0x0000: "KC_NO",
  0x0001: "KC_TRNS",
  // Letters
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
  // Numbers
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
  // Editing
  0x0028: "KC_ENT",
  0x0029: "KC_ESC",
  0x002a: "KC_BSPC",
  0x002b: "KC_TAB",
  0x002c: "KC_SPC",
  // Symbols
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
  // Locks
  0x0039: "KC_CAPS",
  // F-keys
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
  // System
  0x0046: "KC_PSCR",
  0x0047: "KC_SCRL",
  0x0048: "KC_PAUS",
  0x0049: "KC_INS",
  0x004a: "KC_HOME",
  0x004b: "KC_PGUP",
  0x004c: "KC_DEL",
  0x004d: "KC_END",
  0x004e: "KC_PGDN",
  // Arrows
  0x004f: "KC_RGHT",
  0x0050: "KC_LEFT",
  0x0051: "KC_DOWN",
  0x0052: "KC_UP",
  // Numpad
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
  // Misc
  0x0065: "KC_APP",
  // Extended F-keys
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
  // Media / Consumer
  0x00a5: "KC_MPLY",
  0x00a6: "KC_MSTP",
  0x00a7: "KC_MPRV",
  0x00a8: "KC_MUTE",
  0x00a9: "KC_VOLU",
  0x00aa: "KC_VOLD",
  0x00ab: "KC_MNXT",
  // macOS specific
  0x00d1: "KC_BRMU",
  0x00d2: "KC_BRMD",
  0x00d4: "KC_MCTL",
  0x00d5: "KC_LPAD",
};

// ── Shifted symbol shortcuts ─────────────────────────────

const SHIFTED_SYMBOLS: Record<number, string> = {
  0x1e: "KC_EXLM",
  0x1f: "KC_AT",
  0x20: "KC_HASH",
  0x21: "KC_DLR",
  0x22: "KC_PERC",
  0x23: "KC_CIRC",
  0x24: "KC_AMPR",
  0x25: "KC_ASTR",
  0x26: "KC_LPRN",
  0x27: "KC_RPRN",
  0x2d: "KC_UNDS",
  0x2e: "KC_PLUS",
  0x2f: "KC_LCBR",
  0x30: "KC_RCBR",
  0x31: "KC_PIPE",
  0x33: "KC_COLN",
  0x34: "KC_DQUO",
  0x35: "KC_TILD",
  0x36: "KC_LABK",
  0x37: "KC_RABK",
  0x38: "KC_QUES",
};

// ── QK_LIGHTING named keycodes (0x7800–0x78FF) ──────────

const LIGHTING_KEYCODES: Record<number, string> = {
  // Backlight
  0x7800: "BL_ON",
  0x7801: "BL_OFF",
  0x7802: "BL_TOGG",
  0x7803: "BL_DEC",
  0x7804: "BL_INC",
  0x7805: "BL_STEP",
  0x7806: "BL_BRTG",
  // Underglow (RGB_* — LED strip)
  0x7820: "RGB_TOG",
  0x7821: "RGB_MOD",
  0x7822: "RGB_RMOD",
  0x7823: "RGB_HUI",
  0x7824: "RGB_HUD",
  0x7825: "RGB_SAI",
  0x7826: "RGB_SAD",
  0x7827: "RGB_VAI",
  0x7828: "RGB_VAD",
  0x7829: "RGB_SPI",
  0x782a: "RGB_SPD",
  // RGB Matrix (RM_* — per-key)
  0x7840: "RM_ON",
  0x7841: "RM_OFF",
  0x7842: "RM_TOGG",
  0x7843: "RM_NEXT",
  0x7844: "RM_PREV",
  0x7845: "RM_HUEU",
  0x7846: "RM_HUED",
  0x7847: "RM_SATU",
  0x7848: "RM_SATD",
  0x7849: "RM_VALU",
  0x784a: "RM_VALD",
  0x784b: "RM_SPDU",
  0x784c: "RM_SPDD",
};

// ── QK_QUANTUM named keycodes (0x7C00–0x7DFF) ───────────

const QUANTUM_KEYCODES: Record<number, string> = {
  0x7c00: "QK_BOOT",
  0x7c01: "QK_RBT",
  0x7c02: "DB_TOGG",
  0x7c03: "EE_CLR",
  0x7c16: "KC_GESC",
  0x7c73: "CW_TOGG", // Caps Word
  0x7c79: "QK_REP", // Repeat Key
  0x7c7a: "QK_AREP", // Alt Repeat Key
  0x7c7b: "QK_LLCK", // Layer Lock
};

// ── Modifier decoding ────────────────────────────────────

function decodeMods(mods: number): string {
  const EXACT: Record<number, string> = {
    0x01: "Ctrl",
    0x02: "Shift",
    0x04: "Alt",
    0x08: "Cmd",
    0x11: "RCtrl",
    0x12: "RShift",
    0x14: "RAlt",
    0x18: "RCmd",
    0x0f: "Hyper",
    0x07: "Meh",
  };
  if (EXACT[mods]) return EXACT[mods];

  const parts: string[] = [];
  const isRight = (mods & 0x10) !== 0;
  const baseMods = mods & 0x0f;
  if (baseMods & 0x08) parts.push(isRight ? "RCmd" : "Cmd");
  if (baseMods & 0x04) parts.push(isRight ? "RAlt" : "Alt");
  if (baseMods & 0x02) parts.push(isRight ? "RShift" : "Shift");
  if (baseMods & 0x01) parts.push(isRight ? "RCtrl" : "Ctrl");
  return parts.join("+") || `Mod(${mods})`;
}

function basicToStr(basic: number): string {
  return BASIC_KEYCODES[basic] ?? `0x${basic.toString(16).padStart(2, "0")}`;
}

// ── Main converter ───────────────────────────────────────

export function numericKeycodeToString(keycode: number): string {
  // KC_NO
  if (keycode === 0x0000) return "KC_NO";
  // KC_TRNS
  if (keycode === 0x0001) return "KC_TRNS";

  // QK_BASIC (0x0000–0x00FF)
  if (keycode <= 0x00ff) {
    return (
      BASIC_KEYCODES[keycode] ?? `KC_0x${keycode.toString(16).padStart(2, "0")}`
    );
  }

  // QK_MODS (0x0100–0x1FFF): Modifier + basic key
  if (keycode >= 0x0100 && keycode <= 0x1fff) {
    const mods = (keycode >> 8) & 0x1f;
    const basic = keycode & 0xff;
    if (mods === 0x02) {
      const shifted = SHIFTED_SYMBOLS[basic];
      if (shifted) return shifted;
    }
    return `${decodeMods(mods)}(${basicToStr(basic)})`;
  }

  // QK_MOD_TAP (0x2000–0x3FFF): MT(mod, kc)
  if (keycode >= 0x2000 && keycode <= 0x3fff) {
    const mods = (keycode >> 8) & 0x1f;
    const basic = keycode & 0xff;
    return `MT(${decodeMods(mods)}, ${basicToStr(basic)})`;
  }

  // QK_LAYER_TAP (0x4000–0x4FFF): LT(layer, kc)
  if (keycode >= 0x4000 && keycode <= 0x4fff) {
    const layer = (keycode >> 8) & 0x0f;
    const basic = keycode & 0xff;
    return `LT(${layer}, ${basicToStr(basic)})`;
  }

  // QK_LAYER_MOD (0x5000–0x51FF): LM(layer, mod)
  if (keycode >= 0x5000 && keycode <= 0x51ff) {
    const layer = (keycode >> 4) & 0x0f;
    const mod = keycode & 0x0f;
    return `LM(${layer}, ${decodeMods(mod)})`;
  }

  // QK_TO (0x5200–0x521F)
  if (keycode >= 0x5200 && keycode <= 0x521f) {
    return `TO(${keycode & 0x1f})`;
  }

  // QK_MOMENTARY (0x5220–0x523F)
  if (keycode >= 0x5220 && keycode <= 0x523f) {
    return `MO(${keycode & 0x1f})`;
  }

  // QK_DEF_LAYER (0x5240–0x525F)
  if (keycode >= 0x5240 && keycode <= 0x525f) {
    return `DF(${keycode & 0x1f})`;
  }

  // QK_TOGGLE_LAYER (0x5260–0x527F)
  if (keycode >= 0x5260 && keycode <= 0x527f) {
    return `TG(${keycode & 0x1f})`;
  }

  // QK_ONE_SHOT_LAYER (0x5280–0x529F)
  if (keycode >= 0x5280 && keycode <= 0x529f) {
    return `OSL(${keycode & 0x1f})`;
  }

  // QK_ONE_SHOT_MOD (0x52A0–0x52BF)
  if (keycode >= 0x52a0 && keycode <= 0x52bf) {
    return `OSM(${decodeMods(keycode & 0x1f)})`;
  }

  // QK_LAYER_TAP_TOGGLE (0x52C0–0x52DF)
  if (keycode >= 0x52c0 && keycode <= 0x52df) {
    return `TT(${keycode & 0x1f})`;
  }

  // QK_PERSISTENT_DEF_LAYER (0x52E0–0x52FF)
  if (keycode >= 0x52e0 && keycode <= 0x52ff) {
    return `PDF(${keycode & 0x1f})`;
  }

  // QK_SWAP_HANDS (0x5600–0x56FF)
  if (keycode >= 0x5600 && keycode <= 0x56ff) {
    const basic = keycode & 0xff;
    return basic === 0 ? "SH_TOGG" : `SH_T(${basicToStr(basic)})`;
  }

  // QK_TAP_DANCE (0x5700–0x57FF)
  if (keycode >= 0x5700 && keycode <= 0x57ff) {
    return `TD(${keycode & 0xff})`;
  }

  // QK_MACRO (0x7700–0x777F)
  if (keycode >= 0x7700 && keycode <= 0x777f) {
    return `M${keycode & 0x7f}`;
  }

  // QK_LIGHTING (0x7800–0x78FF)
  if (LIGHTING_KEYCODES[keycode]) return LIGHTING_KEYCODES[keycode];

  // QK_QUANTUM (0x7C00–0x7DFF)
  if (QUANTUM_KEYCODES[keycode]) return QUANTUM_KEYCODES[keycode];

  // QK_KB (0x7E00–0x7E3F) — Vial maps USER00–USER15 here
  if (keycode >= 0x7e00 && keycode <= 0x7e3f) {
    return `KB_${keycode - 0x7e00}`;
  }

  // QK_USER (0x7E40–0x7FFF)
  if (keycode >= 0x7e40 && keycode <= 0x7fff) {
    return `USER_${keycode - 0x7e40}`;
  }

  // Vendored fallback: check the full Vial keycode database
  const vendored = VIAL_NUMERIC[keycode];
  if (vendored) return vendored;

  // Last resort: hex
  return `0x${keycode.toString(16).toUpperCase().padStart(4, "0")}`;
}
