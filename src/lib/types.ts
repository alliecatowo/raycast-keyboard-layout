// ============================================================
// Core data model for Keyboard Layout Visualizer
// ============================================================

/** A saved keyboard profile with physical layout + user's keymap */
export interface BoardProfile {
  id: string;
  name: string; // User-friendly: "Work Corne", "Home Sofle"
  keyboard: string; // QMK keyboard ID: "crkbd/rev1"
  layoutKey: string; // "LAYOUT_split_3x6_3"
  firmware: FirmwareType;
  layers: Layer[];
  physicalLayout: PhysicalKey[];
  sourceFile?: string; // Original import path for re-import
  createdAt: string; // ISO date
  updatedAt: string;
}

export type FirmwareType = "qmk" | "zmk";

/** A single layer in a keymap */
export interface Layer {
  index: number;
  name: string; // Auto-named ("Base", "Nav") or user-customized
  keycodes: string[]; // Raw QMK keycodes, positional
}

/** Physical position/size of a single key on the PCB */
export interface PhysicalKey {
  x: number; // Position in key units (1u = standard key)
  y: number;
  w: number; // Width, default 1
  h: number; // Height, default 1
  r?: number; // Rotation in degrees
  rx?: number; // Rotation origin X
  ry?: number; // Rotation origin Y
}

/** Categories for color-coding keys in the SVG */
export type KeyCategory =
  | "alpha"
  | "number"
  | "modifier"
  | "navigation"
  | "function"
  | "media"
  | "symbol"
  | "layer"
  | "system"
  | "mouse"
  | "transparent"
  | "none"
  | "macro"
  | "tapdance";

/** A keycode with its display label, category, and search aliases */
export interface KeycodeDefinition {
  code: string; // "KC_ESC"
  label: string; // "Esc"
  aliases: string[]; // ["Escape", "KC_ESCAPE"]
  category: KeyCategory;
}

/** Parsed result from a QMK keymap.json file */
export interface QmkKeymapFile {
  keyboard: string;
  keymap: string;
  layout: string;
  layers: string[][];
}

/** Physical layout data from QMK API info.json */
export interface QmkInfoLayout {
  layout: Array<{
    matrix: [number, number];
    x: number;
    y: number;
    w?: number;
    h?: number;
    r?: number;
    rx?: number;
    ry?: number;
    label?: string;
  }>;
}

/** Options for SVG rendering */
export interface RenderOptions {
  appearance: "light" | "dark";
  theme?: string; // Theme ID from preferences
  highlightKeys?: number[]; // Indices of keys to highlight (for search)
  showGhostKeys?: boolean; // Show inherited keys for KC_TRNS
  layerIndex: number;
  layers: Layer[]; // Full layer stack (for ghost key resolution)
  width?: number; // Target width in pixels
  splitView?: "both" | "left" | "right"; // Which half(s) to render
}

/** Result of SVG generation */
export interface SvgResult {
  svg: string; // Raw SVG markup
  filePath: string; // Path to written SVG file
  width: number;
  height: number;
}
