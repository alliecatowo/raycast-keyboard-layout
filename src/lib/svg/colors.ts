import { KeyCategory } from "../types";

export interface ColorPalette {
  background: string;
  keyFill: string;
  keyStroke: string;
  keyCapFill: string; // Inner keycap (3D effect)
  keyText: string;
  secondaryText: string; // Hold labels, ghost keys
  headerText: string;
  headerBg: string;
  // Category overrides (keycap fill)
  modifier: string;
  navigation: string;
  layer: string;
  function: string;
  media: string;
  mouse: string;
  system: string;
  transparent: string;
  none: string;
  // Highlight (search)
  highlightFill: string;
  highlightStroke: string;
  highlightGlow: string;
  // Ghost key (inherited from lower layer)
  ghostText: string;
  ghostStroke: string;
}

/** Light mode palette — inspired by GMK Minimal */
export const LIGHT: ColorPalette = {
  background: "#ffffff",
  keyFill: "#e8e8e8",
  keyStroke: "#d0d0d0",
  keyCapFill: "#f5f5f5",
  keyText: "#1a1a1a",
  secondaryText: "#888888",
  headerText: "#333333",
  headerBg: "#f0f0f0",
  modifier: "#dce4ed",
  navigation: "#d4efd4",
  layer: "#d4deff",
  function: "#e8daf0",
  media: "#f0dae8",
  mouse: "#daf0f0",
  system: "#f0e0d0",
  transparent: "#fafafa",
  none: "#d0d0d0",
  highlightFill: "#fff3c4",
  highlightStroke: "#f0b429",
  highlightGlow: "#f0b429",
  ghostText: "#bbbbbb",
  ghostStroke: "#e0e0e0",
};

/** Dark mode palette — inspired by GMK Dracula */
export const DARK: ColorPalette = {
  background: "#1e1e2e",
  keyFill: "#313244",
  keyStroke: "#45475a",
  keyCapFill: "#3b3b52",
  keyText: "#cdd6f4",
  secondaryText: "#6c7086",
  headerText: "#cdd6f4",
  headerBg: "#2a2a3c",
  modifier: "#2d3555",
  navigation: "#2a4035",
  layer: "#2d3060",
  function: "#3d2d50",
  media: "#4d2d3d",
  mouse: "#2d4545",
  system: "#453525",
  transparent: "#282838",
  none: "#252535",
  highlightFill: "#4a3a10",
  highlightStroke: "#f0b429",
  highlightGlow: "#f0b429",
  ghostText: "#585b70",
  ghostStroke: "#3b3b52",
};

/** Get the keycap fill color for a given key category */
export function getCategoryColor(category: KeyCategory, palette: ColorPalette): string {
  switch (category) {
    case "modifier":
      return palette.modifier;
    case "navigation":
      return palette.navigation;
    case "layer":
      return palette.layer;
    case "function":
      return palette.function;
    case "media":
      return palette.media;
    case "mouse":
      return palette.mouse;
    case "system":
      return palette.system;
    case "transparent":
      return palette.transparent;
    case "none":
      return palette.none;
    default:
      return palette.keyCapFill;
  }
}

export function getPalette(appearance: "light" | "dark"): ColorPalette {
  return appearance === "dark" ? DARK : LIGHT;
}
