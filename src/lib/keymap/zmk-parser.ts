import * as nodeCrypto from "crypto";
import { BoardProfile, Layer } from "../types";
import { ZMK_LABELS } from "./vendored-zmk-keycodes";

/**
 * Parse a ZMK .keymap file (devicetree format) to extract layers and bindings.
 *
 * ZMK keycodes stay in ZMK-native format (no QMK translation).
 * Display labels come from vendored ZMK_LABELS (644 entries).
 */

/**
 * Convert a ZMK binding to a display-ready keycode string.
 * Keys are stored as KC_{ZMK_NAME} — the display parser resolves
 * them via ZMK_LABELS.
 */
function zmkBindingToKeycode(binding: string): string {
  const trimmed = binding.trim();

  if (trimmed === "&none") return "KC_NO";
  if (trimmed === "&trans") return "KC_TRNS";

  // &kp KEY — key press (store as KC_ prefixed ZMK name)
  const kpMatch = trimmed.match(/^&kp\s+(.+)$/);
  if (kpMatch) return `KC_${kpMatch[1].trim()}`;

  // &mt MOD KEY — mod-tap
  const mtMatch = trimmed.match(/^&mt\s+(\S+)\s+(\S+)$/);
  if (mtMatch) {
    const mod = ZMK_LABELS[mtMatch[1]] ?? mtMatch[1];
    return `MT(${mod}, KC_${mtMatch[2]})`;
  }

  // &lt LAYER KEY — layer-tap
  const ltMatch = trimmed.match(/^&lt\s+(\d+)\s+(\S+)$/);
  if (ltMatch) return `LT(${ltMatch[1]}, KC_${ltMatch[2]})`;

  // Layer behaviors
  const moMatch = trimmed.match(/^&mo\s+(\d+)$/);
  if (moMatch) return `MO(${moMatch[1]})`;

  const toMatch = trimmed.match(/^&to\s+(\d+)$/);
  if (toMatch) return `TO(${toMatch[1]})`;

  const togMatch = trimmed.match(/^&tog\s+(\d+)$/);
  if (togMatch) return `TG(${togMatch[1]})`;

  const slMatch = trimmed.match(/^&sl\s+(\d+)$/);
  if (slMatch) return `OSL(${slMatch[1]})`;

  // &sk MOD — sticky/one-shot mod
  const skMatch = trimmed.match(/^&sk\s+(\S+)$/);
  if (skMatch) {
    const mod = ZMK_LABELS[skMatch[1]] ?? skMatch[1];
    return `OSM(${mod})`;
  }

  // System behaviors
  if (trimmed === "&bootloader") return "QK_BOOT";
  if (trimmed === "&sys_reset" || trimmed === "&reset") return "QK_RBT";

  // Unknown — strip & prefix
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

  // Strip preprocessor directives
  cleaned = cleaned.replace(/^#.*$/gm, "");

  // Find the keymap node
  const keymapMatch = cleaned.match(
    /keymap\s*\{[\s\S]*?compatible\s*=\s*"zmk,keymap"\s*;([\s\S]*?)\n\s*\};/,
  );
  if (!keymapMatch) {
    throw new Error(
      'Could not find keymap node with compatible = "zmk,keymap"',
    );
  }

  const keymapBlock = keymapMatch[1];

  // Extract layer blocks
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

    // Parse bindings
    const bindings = bindingsStr
      .trim()
      .split(/(?=&)/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const keycodes = bindings.map(zmkBindingToKeycode);

    const layerName =
      displayName ?? nodeName.replace(/_layer$/, "").replace(/_/g, " ");

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
