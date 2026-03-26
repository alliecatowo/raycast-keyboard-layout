import { KeyCategory } from "../types";

export interface ColorPalette {
  background: string;
  keyFill: string;
  keyStroke: string;
  keyCapFill: string;
  keyText: string;
  secondaryText: string;
  headerText: string;
  headerBg: string;
  modifier: string;
  navigation: string;
  layer: string;
  function: string;
  media: string;
  mouse: string;
  system: string;
  transparent: string;
  none: string;
  highlightFill: string;
  highlightStroke: string;
  highlightGlow: string;
  ghostText: string;
  ghostStroke: string;
}

// ── Theme Definitions ────────────────────────────────────

/** GMK Minimal — clean whites and light grays */
const MINIMAL_LIGHT: ColorPalette = {
  background: "#ffffff",
  keyFill: "#e8e8e8", keyStroke: "#d0d0d0", keyCapFill: "#f5f5f5",
  keyText: "#1a1a1a", secondaryText: "#888888",
  headerText: "#333333", headerBg: "#f0f0f0",
  modifier: "#dce4ed", navigation: "#d4efd4", layer: "#d4deff",
  function: "#e8daf0", media: "#f0dae8", mouse: "#daf0f0",
  system: "#f0e0d0", transparent: "#fafafa", none: "#d0d0d0",
  highlightFill: "#fff3c4", highlightStroke: "#f0b429", highlightGlow: "#f0b429",
  ghostText: "#bbbbbb", ghostStroke: "#e0e0e0",
};

/** Catppuccin Mocha — soft pastels on dark */
const CATPPUCCIN_DARK: ColorPalette = {
  background: "#1e1e2e",
  keyFill: "#313244", keyStroke: "#45475a", keyCapFill: "#3b3b52",
  keyText: "#cdd6f4", secondaryText: "#6c7086",
  headerText: "#cdd6f4", headerBg: "#2a2a3c",
  modifier: "#2d3555", navigation: "#2a4035", layer: "#2d3060",
  function: "#3d2d50", media: "#4d2d3d", mouse: "#2d4545",
  system: "#453525", transparent: "#282838", none: "#252535",
  highlightFill: "#4a3a10", highlightStroke: "#f0b429", highlightGlow: "#f0b429",
  ghostText: "#585b70", ghostStroke: "#3b3b52",
};

/** Nord — arctic blue tones */
const NORD_LIGHT: ColorPalette = {
  background: "#eceff4",
  keyFill: "#d8dee9", keyStroke: "#c0c8d4", keyCapFill: "#e5e9f0",
  keyText: "#2e3440", secondaryText: "#7b88a0",
  headerText: "#2e3440", headerBg: "#d8dee9",
  modifier: "#b0c4de", navigation: "#a3be8c33", layer: "#5e81ac33",
  function: "#b48ead33", media: "#bf616a22", mouse: "#88c0d033",
  system: "#d0876633", transparent: "#eceff4", none: "#d8dee9",
  highlightFill: "#ebcb8b44", highlightStroke: "#d08770", highlightGlow: "#d08770",
  ghostText: "#a0aabb", ghostStroke: "#d8dee9",
};

/** Nord Polar Night — dark nord */
const NORD_DARK: ColorPalette = {
  background: "#2e3440",
  keyFill: "#3b4252", keyStroke: "#434c5e", keyCapFill: "#434c5e",
  keyText: "#eceff4", secondaryText: "#7b88a0",
  headerText: "#eceff4", headerBg: "#3b4252",
  modifier: "#4c566a", navigation: "#3b524a", layer: "#3b4565",
  function: "#4a3b55", media: "#553b45", mouse: "#3b5555",
  system: "#554a3b", transparent: "#333b48", none: "#2e3440",
  highlightFill: "#ebcb8b33", highlightStroke: "#ebcb8b", highlightGlow: "#d08770",
  ghostText: "#5a657a", ghostStroke: "#434c5e",
};

/** Solarized Light */
const SOLARIZED_LIGHT: ColorPalette = {
  background: "#fdf6e3",
  keyFill: "#eee8d5", keyStroke: "#d6cdb5", keyCapFill: "#fdf6e3",
  keyText: "#586e75", secondaryText: "#93a1a1",
  headerText: "#073642", headerBg: "#eee8d5",
  modifier: "#d5dde0", navigation: "#d5e8d0", layer: "#d0d8e8",
  function: "#e0d5e8", media: "#e8d5d5", mouse: "#d5e8e8",
  system: "#e8e0d0", transparent: "#fdf6e3", none: "#eee8d5",
  highlightFill: "#ffeaa7", highlightStroke: "#b58900", highlightGlow: "#b58900",
  ghostText: "#b8c4c4", ghostStroke: "#eee8d5",
};

/** Solarized Dark */
const SOLARIZED_DARK: ColorPalette = {
  background: "#002b36",
  keyFill: "#073642", keyStroke: "#0a4a5a", keyCapFill: "#0a3f4f",
  keyText: "#93a1a1", secondaryText: "#586e75",
  headerText: "#93a1a1", headerBg: "#073642",
  modifier: "#0d4555", navigation: "#0d4a40", layer: "#0d3555",
  function: "#2d2555", media: "#3d1545", mouse: "#0d4545",
  system: "#352d15", transparent: "#053545", none: "#002b36",
  highlightFill: "#b5890033", highlightStroke: "#b58900", highlightGlow: "#cb4b16",
  ghostText: "#3a5560", ghostStroke: "#073642",
};

/** High Contrast — maximum readability */
const HIGH_CONTRAST_LIGHT: ColorPalette = {
  background: "#ffffff",
  keyFill: "#e0e0e0", keyStroke: "#999999", keyCapFill: "#f0f0f0",
  keyText: "#000000", secondaryText: "#555555",
  headerText: "#000000", headerBg: "#e0e0e0",
  modifier: "#c8d8ec", navigation: "#c0e8c0", layer: "#c0c8f0",
  function: "#e0c8f0", media: "#f0c8d8", mouse: "#c0e8e8",
  system: "#f0d8c0", transparent: "#f8f8f8", none: "#c0c0c0",
  highlightFill: "#ffee55", highlightStroke: "#cc8800", highlightGlow: "#cc8800",
  ghostText: "#aaaaaa", ghostStroke: "#d0d0d0",
};

/** High Contrast Dark */
const HIGH_CONTRAST_DARK: ColorPalette = {
  background: "#0a0a0a",
  keyFill: "#1a1a1a", keyStroke: "#444444", keyCapFill: "#222222",
  keyText: "#ffffff", secondaryText: "#aaaaaa",
  headerText: "#ffffff", headerBg: "#1a1a1a",
  modifier: "#1a2a40", navigation: "#1a3a20", layer: "#1a2050",
  function: "#301a40", media: "#401a2a", mouse: "#1a3a3a",
  system: "#3a2a10", transparent: "#151515", none: "#111111",
  highlightFill: "#665500", highlightStroke: "#ffcc00", highlightGlow: "#ffcc00",
  ghostText: "#555555", ghostStroke: "#222222",
};

// ── Theme Registry ───────────────────────────────────────

export type ThemeId = "auto" | "minimal" | "catppuccin" | "nord" | "solarized" | "highcontrast";

interface ThemeDefinition {
  id: ThemeId;
  name: string;
  light: ColorPalette;
  dark: ColorPalette;
}

export const THEMES: ThemeDefinition[] = [
  { id: "auto", name: "Auto (Minimal / Catppuccin)", light: MINIMAL_LIGHT, dark: CATPPUCCIN_DARK },
  { id: "minimal", name: "Minimal", light: MINIMAL_LIGHT, dark: CATPPUCCIN_DARK },
  { id: "catppuccin", name: "Catppuccin", light: MINIMAL_LIGHT, dark: CATPPUCCIN_DARK },
  { id: "nord", name: "Nord", light: NORD_LIGHT, dark: NORD_DARK },
  { id: "solarized", name: "Solarized", light: SOLARIZED_LIGHT, dark: SOLARIZED_DARK },
  { id: "highcontrast", name: "High Contrast", light: HIGH_CONTRAST_LIGHT, dark: HIGH_CONTRAST_DARK },
];

export function getTheme(themeId: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === themeId) ?? THEMES[0];
}

/** Get the keycap fill color for a given key category */
export function getCategoryColor(category: KeyCategory, palette: ColorPalette): string {
  switch (category) {
    case "modifier": return palette.modifier;
    case "navigation": return palette.navigation;
    case "layer": return palette.layer;
    case "function": return palette.function;
    case "media": return palette.media;
    case "mouse": return palette.mouse;
    case "system": return palette.system;
    case "transparent": return palette.transparent;
    case "none": return palette.none;
    default: return palette.keyCapFill;
  }
}

export function getPalette(appearance: "light" | "dark", themeId: ThemeId = "auto"): ColorPalette {
  const theme = getTheme(themeId);
  return appearance === "dark" ? theme.dark : theme.light;
}
