import { KeyCategory, KeycodeDefinition } from "../types";
import { KEYCODES } from "./keycodes-data";
import { VIAL_LABELS } from "./vendored-keycodes";
import { ZMK_LABELS } from "./vendored-zmk-keycodes";

// ── Lookup indices (built once at import time) ───────────

/** Primary lookup: exact code match (case-insensitive) */
const byCode = new Map<string, KeycodeDefinition>();

/** Alias lookup: any alias or code (case-insensitive) → definition */
const byAlias = new Map<string, KeycodeDefinition>();

for (const kc of KEYCODES) {
  const upper = kc.code.toUpperCase();
  byCode.set(upper, kc);
  byAlias.set(upper, kc);
  byAlias.set(kc.label.toUpperCase(), kc);
  for (const alias of kc.aliases) {
    byAlias.set(alias.toUpperCase(), kc);
  }
}

// ── Complex keycode patterns ─────────────────────────────

/** Matches mod-tap: MT(mod, kc) or LSFT_T(kc), LCTL_T(kc), etc. */
const MOD_TAP_RE = /^(?:MT\(([^,]+),\s*([^)]+)\)|(\w+)_T\(([^)]+)\))$/;

/** Matches layer-tap: LT(layer, kc) */
const LAYER_TAP_RE = /^LT\((\d+),\s*([^)]+)\)$/;

/** Matches momentary layer: MO(layer) */
const MO_RE = /^MO\((\d+)\)$/;

/** Matches toggle layer: TG(layer) */
const TG_RE = /^TG\((\d+)\)$/;

/** Matches one-shot layer: OSL(layer) */
const OSL_RE = /^OSL\((\d+)\)$/;

/** Matches to-layer: TO(layer) */
const TO_RE = /^TO\((\d+)\)$/;

/** Matches one-shot mod: OSM(mod) */
const OSM_RE = /^OSM\(([^)]+)\)$/;

/** Matches default layer: DF(layer) */
const DF_RE = /^DF\((\d+)\)$/;

/** Matches RGB keycodes: RGB_TOG, RGB_MOD, etc. */
const RGB_RE = /^RGB_(\w+)$/;

/** Matches MOD_xxx(KC_yyy) from numeric keycode converter */
const MOD_WRAP_RE = /^(MOD_\w+)\(([^)]+)\)$/;

/** Modifier aliases for mod-tap shorthand */
const MOD_TAP_PREFIXES: Record<string, string> = {
  LSFT: "Shift",
  RSFT: "RShift",
  LCTL: "Ctrl",
  RCTL: "RCtrl",
  LALT: "Alt",
  RALT: "RAlt",
  LGUI: "Cmd",
  RGUI: "RCmd",
  HYPR: "Hyper",
  MEH: "Meh",
  // C = Ctrl, S = Shift, A = Alt, G = GUI (QMK shorthand)
  C: "Ctrl",
  S: "Shift",
  A: "Alt",
  G: "Cmd",
};

const MOD_NAMES: Record<string, string> = {
  MOD_LSFT: "Shift",
  MOD_RSFT: "RShift",
  MOD_LCTL: "Ctrl",
  MOD_RCTL: "RCtrl",
  MOD_LALT: "Alt",
  MOD_RALT: "RAlt",
  MOD_LGUI: "Cmd",
  MOD_RGUI: "RCmd",
  MOD_HYPR: "Hyper",
  MOD_MEH: "Meh",
};

export interface ParsedKeycode {
  label: string; // Primary display label
  holdLabel?: string; // Secondary label for hold action (mod-tap, layer-tap)
  category: KeyCategory;
  raw: string; // Original keycode string
}

/** Look up a simple keycode by its exact code */
export function lookupKeycode(code: string): KeycodeDefinition | undefined {
  return byCode.get(code.toUpperCase());
}

/** Fuzzy search: find all keycodes matching a query string */
export function searchKeycodes(query: string): KeycodeDefinition[] {
  if (!query.trim()) return [];
  const q = query.toUpperCase().trim();

  // Exact match first
  const exact = byAlias.get(q);
  if (exact) return [exact];

  // Substring match across code, label, and aliases
  return KEYCODES.filter((kc) => {
    if (kc.code.toUpperCase().includes(q)) return true;
    if (kc.label.toUpperCase().includes(q)) return true;
    return kc.aliases.some((a) => a.toUpperCase().includes(q));
  });
}

/** Parse any QMK keycode string into display-ready labels + category */
export function parseKeycode(raw: string): ParsedKeycode {
  const trimmed = raw.trim();

  // Transparent
  if (
    trimmed === "KC_TRNS" ||
    trimmed === "_______" ||
    trimmed === "KC_TRANSPARENT"
  ) {
    return { label: "\u25BD", category: "transparent", raw: trimmed };
  }

  // None
  if (trimmed === "KC_NO" || trimmed === "XXXXXXX") {
    return { label: "\u2205", category: "none", raw: trimmed };
  }

  // Layer-tap: LT(n, kc)
  const ltMatch = trimmed.match(LAYER_TAP_RE);
  if (ltMatch) {
    const layerNum = ltMatch[1];
    const innerKc = lookupKeycode(ltMatch[2]);
    return {
      label: innerKc?.label ?? ltMatch[2].replace("KC_", ""),
      holdLabel: `L${layerNum}`,
      category: "layer",
      raw: trimmed,
    };
  }

  // Mod-tap: MT(mod, kc) or XXXX_T(kc)
  const mtMatch = trimmed.match(MOD_TAP_RE);
  if (mtMatch) {
    if (mtMatch[1] && mtMatch[2]) {
      // MT(MOD_LSFT, KC_T) form
      const modName = MOD_NAMES[mtMatch[1]] ?? mtMatch[1];
      const innerKc = lookupKeycode(mtMatch[2]);
      return {
        label: innerKc?.label ?? mtMatch[2].replace("KC_", ""),
        holdLabel: modName,
        category: "modifier",
        raw: trimmed,
      };
    }
    if (mtMatch[3] && mtMatch[4]) {
      // LSFT_T(KC_A) form
      const modName = MOD_TAP_PREFIXES[mtMatch[3]] ?? mtMatch[3];
      const innerKc = lookupKeycode(mtMatch[4]);
      return {
        label: innerKc?.label ?? mtMatch[4].replace("KC_", ""),
        holdLabel: modName,
        category: "modifier",
        raw: trimmed,
      };
    }
  }

  // Momentary layer: MO(n)
  const moMatch = trimmed.match(MO_RE);
  if (moMatch) {
    return {
      label: `MO(${moMatch[1]})`,
      holdLabel: `L${moMatch[1]}`,
      category: "layer",
      raw: trimmed,
    };
  }

  // Toggle layer: TG(n)
  const tgMatch = trimmed.match(TG_RE);
  if (tgMatch) {
    return { label: `TG(${tgMatch[1]})`, category: "layer", raw: trimmed };
  }

  // One-shot layer: OSL(n)
  const oslMatch = trimmed.match(OSL_RE);
  if (oslMatch) {
    return { label: `OSL(${oslMatch[1]})`, category: "layer", raw: trimmed };
  }

  // To layer: TO(n)
  const toMatch = trimmed.match(TO_RE);
  if (toMatch) {
    return { label: `TO(${toMatch[1]})`, category: "layer", raw: trimmed };
  }

  // Default layer: DF(n)
  const dfMatch = trimmed.match(DF_RE);
  if (dfMatch) {
    return { label: `DF(${dfMatch[1]})`, category: "layer", raw: trimmed };
  }

  // Tap-toggle layer: TT(n)
  const ttMatch = trimmed.match(/^TT\((\d+)\)$/);
  if (ttMatch) {
    return {
      label: `TT(${ttMatch[1]})`,
      holdLabel: `L${ttMatch[1]}`,
      category: "layer",
      raw: trimmed,
    };
  }

  // PDF(n) — persistent default layer
  const pdfMatch = trimmed.match(/^PDF\((\d+)\)$/);
  if (pdfMatch) {
    return { label: `PDF(${pdfMatch[1]})`, category: "layer", raw: trimmed };
  }

  // SH_T(kc) — swap hands tap
  const shtMatch = trimmed.match(/^SH_T\(([^)]+)\)$/);
  if (shtMatch) {
    const innerKc = lookupKeycode(shtMatch[1]);
    return {
      label: innerKc?.label ?? shtMatch[1].replace("KC_", ""),
      holdLabel: "Swap",
      category: "modifier",
      raw: trimmed,
    };
  }
  if (trimmed === "SH_TOGG")
    return { label: "Swap", category: "modifier", raw: trimmed };

  // TD(n) — tap dance
  const tdMatch = trimmed.match(/^TD\((\d+)\)$/);
  if (tdMatch) {
    return { label: `TD${tdMatch[1]}`, category: "tapdance", raw: trimmed };
  }

  // M0–M127 — macros
  const macroMatch = trimmed.match(/^M(\d+)$/);
  if (macroMatch) {
    return { label: `Macro ${macroMatch[1]}`, category: "macro", raw: trimmed };
  }

  // LM(layer, mod) — layer + mod
  const lmMatch = trimmed.match(/^LM\((\d+),\s*([^)]+)\)$/);
  if (lmMatch) {
    return {
      label: `LM(${lmMatch[1]})`,
      holdLabel: lmMatch[2],
      category: "layer",
      raw: trimmed,
    };
  }

  // KB_n — keyboard-specific keycodes (Vial's USER slots)
  const kbMatch = trimmed.match(/^KB_(\d+)$/);
  if (kbMatch) {
    return { label: `User ${kbMatch[1]}`, category: "macro", raw: trimmed };
  }

  // USER_n — user keycodes
  const userMatch = trimmed.match(/^USER_(\d+)$/);
  if (userMatch) {
    return { label: `User ${userMatch[1]}`, category: "macro", raw: trimmed };
  }

  // Decoded mod+key: Shift(KC_1), Ctrl+Alt(KC_DEL), etc.
  const decodedModMatch = trimmed.match(/^([A-Za-z+]+)\(([^)]+)\)$/);
  if (
    decodedModMatch &&
    !trimmed.startsWith("MT(") &&
    !trimmed.startsWith("LT(") &&
    !trimmed.startsWith("MO(") &&
    !trimmed.startsWith("OSM(") &&
    !trimmed.startsWith("MOD_")
  ) {
    const modName = decodedModMatch[1];
    const innerKc = lookupKeycode(decodedModMatch[2]);
    if (innerKc) {
      return {
        label: innerKc.label,
        holdLabel: modName,
        category: "modifier",
        raw: trimmed,
      };
    }
  }

  // One-shot mod: OSM(mod)
  const osmMatch = trimmed.match(OSM_RE);
  if (osmMatch) {
    const modName = MOD_NAMES[osmMatch[1]] ?? osmMatch[1].replace("MOD_", "");
    return { label: `OS${modName}`, category: "modifier", raw: trimmed };
  }

  // MOD_xxx(KC_yyy) — from numeric keycode converter (shifted keys, etc.)
  const modWrapMatch = trimmed.match(MOD_WRAP_RE);
  if (modWrapMatch) {
    const modName =
      MOD_NAMES[modWrapMatch[1]] ?? modWrapMatch[1].replace("MOD_", "");
    const innerKc = lookupKeycode(modWrapMatch[2]);
    return {
      label: innerKc?.label ?? modWrapMatch[2].replace("KC_", ""),
      holdLabel: modName,
      category: "modifier",
      raw: trimmed,
    };
  }

  // RGB keycodes
  const rgbMatch = trimmed.match(RGB_RE);
  if (rgbMatch) {
    const RGB_LABELS: Record<string, string> = {
      TOG: "RGB",
      MOD: "Mode+",
      RMOD: "Mode-",
      HUI: "Hue+",
      HUD: "Hue-",
      SAI: "Sat+",
      SAD: "Sat-",
      VAI: "Bri+",
      VAD: "Bri-",
      SPI: "Spd+",
      SPD: "Spd-",
    };
    return {
      label: RGB_LABELS[rgbMatch[1]] ?? `RGB ${rgbMatch[1]}`,
      category: "media",
      raw: trimmed,
    };
  }

  // System keycodes
  if (trimmed === "QK_BOOT")
    return { label: "Boot", category: "system", raw: trimmed };
  if (trimmed === "QK_RBT")
    return { label: "Reboot", category: "system", raw: trimmed };
  if (trimmed === "DB_TOGG")
    return { label: "Debug", category: "system", raw: trimmed };
  if (trimmed === "EE_CLR")
    return { label: "EEClr", category: "system", raw: trimmed };

  // Simple keycode lookup (hand-maintained DB)
  const kc = lookupKeycode(trimmed);
  if (kc) {
    return { label: kc.label, category: kc.category, raw: trimmed };
  }

  // Vendored Vial label database (540+ entries)
  const vialLabel = VIAL_LABELS[trimmed];
  if (vialLabel) {
    return { label: vialLabel, category: "alpha", raw: trimmed };
  }

  // Vendored ZMK label database (644 entries)
  const zmkKey = trimmed.replace(/^KC_/, "");
  const zmkLabel = ZMK_LABELS[zmkKey];
  if (zmkLabel) {
    return { label: zmkLabel, category: "alpha", raw: trimmed };
  }

  // Unknown: strip KC_ prefix and display as-is
  return {
    label: trimmed.replace(/^KC_/, ""),
    category: "alpha",
    raw: trimmed,
  };
}
