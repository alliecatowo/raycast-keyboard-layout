import * as nodeCrypto from "crypto";
import { BoardProfile, Layer } from "../types";

/**
 * Parse a ZMK .keymap file (devicetree format) to extract layers and bindings.
 *
 * ZMK keymaps use C-preprocessor-like devicetree syntax:
 *
 *   / {
 *     keymap {
 *       compatible = "zmk,keymap";
 *       default_layer {
 *         display-name = "Base";
 *         bindings = <
 *           &kp Q &kp W &kp E ...
 *         >;
 *       };
 *     };
 *   };
 *
 * This parser handles the common cases without a full devicetree parser.
 * It strips comments and preprocessor directives, then extracts layer blocks.
 */

// ── ZMK binding → QMK-style keycode mapping ──────────────

const ZMK_TO_QMK: Record<string, string> = {
  // Letters (ZMK uses different names)
  A: "KC_A", B: "KC_B", C: "KC_C", D: "KC_D", E: "KC_E",
  F: "KC_F", G: "KC_G", H: "KC_H", I: "KC_I", J: "KC_J",
  K: "KC_K", L: "KC_L", M: "KC_M", N: "KC_N", O: "KC_O",
  P: "KC_P", Q: "KC_Q", R: "KC_R", S: "KC_S", T: "KC_T",
  U: "KC_U", V: "KC_V", W: "KC_W", X: "KC_X", Y: "KC_Y", Z: "KC_Z",

  // Numbers
  N1: "KC_1", N2: "KC_2", N3: "KC_3", N4: "KC_4", N5: "KC_5",
  N6: "KC_6", N7: "KC_7", N8: "KC_8", N9: "KC_9", N0: "KC_0",
  NUMBER_1: "KC_1", NUMBER_2: "KC_2", NUMBER_3: "KC_3",
  NUMBER_4: "KC_4", NUMBER_5: "KC_5", NUMBER_6: "KC_6",
  NUMBER_7: "KC_7", NUMBER_8: "KC_8", NUMBER_9: "KC_9", NUMBER_0: "KC_0",

  // Modifiers
  LSHIFT: "KC_LSFT", RSHIFT: "KC_RSFT", LSHFT: "KC_LSFT", RSHFT: "KC_RSFT",
  LCTRL: "KC_LCTL", RCTRL: "KC_RCTL",
  LALT: "KC_LALT", RALT: "KC_RALT",
  LGUI: "KC_LGUI", RGUI: "KC_RGUI",
  LCMD: "KC_LGUI", RCMD: "KC_RGUI",
  LMETA: "KC_LGUI", RMETA: "KC_RGUI",

  // Navigation
  UP: "KC_UP", DOWN: "KC_DOWN", LEFT: "KC_LEFT", RIGHT: "KC_RGHT",
  HOME: "KC_HOME", END: "KC_END",
  PG_UP: "KC_PGUP", PG_DN: "KC_PGDN", PAGE_UP: "KC_PGUP", PAGE_DOWN: "KC_PGDN",

  // Editing
  ENTER: "KC_ENT", RET: "KC_ENT", RETURN: "KC_ENT",
  ESCAPE: "KC_ESC", ESC: "KC_ESC",
  BACKSPACE: "KC_BSPC", BSPC: "KC_BSPC",
  TAB: "KC_TAB",
  SPACE: "KC_SPC",
  DELETE: "KC_DEL", DEL: "KC_DEL",
  INSERT: "KC_INS",
  CAPS: "KC_CAPS", CAPSLOCK: "KC_CAPS", CLCK: "KC_CAPS",

  // Symbols
  MINUS: "KC_MINS", EQUAL: "KC_EQL",
  LBKT: "KC_LBRC", RBKT: "KC_RBRC",
  LEFT_BRACKET: "KC_LBRC", RIGHT_BRACKET: "KC_RBRC",
  BACKSLASH: "KC_BSLS", BSLH: "KC_BSLS",
  SEMICOLON: "KC_SCLN", SEMI: "KC_SCLN",
  APOSTROPHE: "KC_QUOT", APOS: "KC_QUOT", SQT: "KC_QUOT",
  GRAVE: "KC_GRV",
  COMMA: "KC_COMM",
  PERIOD: "KC_DOT", DOT: "KC_DOT",
  SLASH: "KC_SLSH", FSLH: "KC_SLSH",

  // Shifted symbols
  EXCLAMATION: "KC_EXLM", EXCL: "KC_EXLM",
  AT_SIGN: "KC_AT", AT: "KC_AT",
  HASH: "KC_HASH", POUND: "KC_HASH",
  DOLLAR: "KC_DLR", DLLR: "KC_DLR",
  PERCENT: "KC_PERC", PRCNT: "KC_PERC",
  CARET: "KC_CIRC",
  AMPERSAND: "KC_AMPR", AMPS: "KC_AMPR",
  ASTERISK: "KC_ASTR", STAR: "KC_ASTR",
  LEFT_PARENTHESIS: "KC_LPRN", LPAR: "KC_LPRN",
  RIGHT_PARENTHESIS: "KC_RPRN", RPAR: "KC_RPRN",
  UNDERSCORE: "KC_UNDS", UNDER: "KC_UNDS",
  PLUS: "KC_PLUS",
  LEFT_BRACE: "KC_LCBR", LBRC: "KC_LCBR",
  RIGHT_BRACE: "KC_RCBR", RBRC: "KC_RCBR",
  PIPE: "KC_PIPE",
  COLON: "KC_COLN",
  DOUBLE_QUOTES: "KC_DQUO", DQT: "KC_DQUO",
  LESS_THAN: "KC_LABK", LT: "KC_LABK",
  GREATER_THAN: "KC_RABK", GT: "KC_RABK",
  QUESTION: "KC_QUES", QMARK: "KC_QUES",
  TILDE: "KC_TILD",

  // Function keys
  F1: "KC_F1", F2: "KC_F2", F3: "KC_F3", F4: "KC_F4",
  F5: "KC_F5", F6: "KC_F6", F7: "KC_F7", F8: "KC_F8",
  F9: "KC_F9", F10: "KC_F10", F11: "KC_F11", F12: "KC_F12",

  // Media
  C_MUTE: "KC_MUTE", C_VOL_UP: "KC_VOLU", C_VOL_DN: "KC_VOLD",
  C_NEXT: "KC_MNXT", C_PREV: "KC_MPRV", C_STOP: "KC_MSTP",
  C_PP: "KC_MPLY", C_PLAY_PAUSE: "KC_MPLY",
  C_BRI_UP: "KC_BRIU", C_BRI_DN: "KC_BRID",

  // System
  PRINTSCREEN: "KC_PSCR", PSCRN: "KC_PSCR",
  SCROLLLOCK: "KC_SCRL", SLCK: "KC_SCRL",
  PAUSE_BREAK: "KC_PAUS",
};

/** Convert a single ZMK binding to a QMK-style keycode string */
function zmkBindingToKeycode(binding: string): string {
  const trimmed = binding.trim();

  // &none
  if (trimmed === "&none") return "KC_NO";

  // &trans
  if (trimmed === "&trans") return "KC_TRNS";

  // &kp KEY — key press
  const kpMatch = trimmed.match(/^&kp\s+(.+)$/);
  if (kpMatch) {
    const key = kpMatch[1].trim();
    return ZMK_TO_QMK[key] ?? `KC_${key}`;
  }

  // &mt MOD KEY — mod-tap (hold=mod, tap=key)
  const mtMatch = trimmed.match(/^&mt\s+(\S+)\s+(\S+)$/);
  if (mtMatch) {
    const mod = ZMK_TO_QMK[mtMatch[1]] ?? mtMatch[1];
    const key = ZMK_TO_QMK[mtMatch[2]] ?? mtMatch[2];
    return `MT(${mod}, ${key})`;
  }

  // &lt LAYER KEY — layer-tap (hold=layer, tap=key)
  const ltMatch = trimmed.match(/^&lt\s+(\d+)\s+(\S+)$/);
  if (ltMatch) {
    const key = ZMK_TO_QMK[ltMatch[2]] ?? ltMatch[2];
    return `LT(${ltMatch[1]}, ${key})`;
  }

  // &mo LAYER — momentary layer
  const moMatch = trimmed.match(/^&mo\s+(\d+)$/);
  if (moMatch) return `MO(${moMatch[1]})`;

  // &to LAYER — to layer
  const toMatch = trimmed.match(/^&to\s+(\d+)$/);
  if (toMatch) return `TO(${toMatch[1]})`;

  // &tog LAYER — toggle layer
  const togMatch = trimmed.match(/^&tog\s+(\d+)$/);
  if (togMatch) return `TG(${togMatch[1]})`;

  // &sl LAYER — sticky/one-shot layer
  const slMatch = trimmed.match(/^&sl\s+(\d+)$/);
  if (slMatch) return `OSL(${slMatch[1]})`;

  // &sk MOD — sticky/one-shot mod
  const skMatch = trimmed.match(/^&sk\s+(\S+)$/);
  if (skMatch) {
    const mod = ZMK_TO_QMK[skMatch[1]] ?? skMatch[1];
    return `OSM(${mod})`;
  }

  // &bootloader
  if (trimmed === "&bootloader") return "QK_BOOT";

  // &sys_reset or &reset
  if (trimmed === "&sys_reset" || trimmed === "&reset") return "QK_RBT";

  // Unknown binding — return as-is
  return trimmed.replace(/^&/, "");
}

/** Check if a string looks like a ZMK .keymap file */
export function isZmkKeymap(content: string): boolean {
  return (
    content.includes("compatible") &&
    content.includes("zmk,keymap") &&
    content.includes("bindings")
  );
}

/** Check if a string looks like a QMK keymap.json */
export function isQmkKeymapJson(content: string): boolean {
  try {
    const data = JSON.parse(content);
    return typeof data.keyboard === "string" && Array.isArray(data.layers);
  } catch {
    return false;
  }
}

/** Detect the firmware type from file contents */
export function detectFirmwareType(content: string): "qmk" | "zmk" | "unknown" {
  if (isQmkKeymapJson(content)) return "qmk";
  if (isZmkKeymap(content)) return "zmk";
  return "unknown";
}

/** Parse a ZMK .keymap file into a partial BoardProfile */
export function parseZmkKeymap(
  content: string,
  boardName: string,
  sourceFile?: string,
): Omit<BoardProfile, "physicalLayout"> {
  // Strip C-style comments
  let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/\/\/.*$/gm, "");

  // Strip preprocessor directives (#include, #define, etc.)
  cleaned = cleaned.replace(/^#.*$/gm, "");

  // Find the keymap node
  const keymapMatch = cleaned.match(/keymap\s*\{[\s\S]*?compatible\s*=\s*"zmk,keymap"\s*;([\s\S]*?)\n\s*\};/);
  if (!keymapMatch) {
    throw new Error("Could not find keymap node with compatible = \"zmk,keymap\"");
  }

  const keymapBlock = keymapMatch[1];

  // Extract layer blocks
  // Pattern: layer_name { display-name = "Name"; bindings = < ... >; };
  const layerPattern = /(\w+)\s*\{([^}]*bindings\s*=\s*<([\s\S]*?)>[^}]*)\}/g;
  const layers: Layer[] = [];
  let match;

  while ((match = layerPattern.exec(keymapBlock)) !== null) {
    const nodeName = match[1];
    const layerBody = match[2];
    const bindingsStr = match[3];

    // Extract display-name if present
    const displayNameMatch = layerBody.match(/display-name\s*=\s*"([^"]+)"/);
    const displayName = displayNameMatch?.[1];

    // Parse bindings: split on & (each binding starts with &)
    const bindings = bindingsStr
      .trim()
      .split(/(?=&)/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const keycodes = bindings.map(zmkBindingToKeycode);

    const layerName = displayName ?? nodeName.replace(/_layer$/, "").replace(/_/g, " ");

    layers.push({
      index: layers.length,
      name: layerName.charAt(0).toUpperCase() + layerName.slice(1),
      keycodes,
    });
  }

  if (layers.length === 0) {
    throw new Error("No layers found in ZMK keymap file");
  }

  const now = new Date().toISOString();

  return {
    id: nodeCrypto.randomUUID(),
    name: boardName,
    keyboard: "zmk:unknown",
    layoutKey: "zmk_keymap",
    firmware: "zmk",
    layers,
    sourceFile,
    createdAt: now,
    updatedAt: now,
  };
}
