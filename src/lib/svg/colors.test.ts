import { describe, it, expect } from "vitest";
import { getPalette, getCategoryColor, getTheme, THEMES } from "./colors";

describe("getPalette", () => {
  it("returns dark palette for dark appearance", () => {
    const palette = getPalette("dark");
    expect(palette.background).toMatch(/^#/);
    expect(palette.keyText).toMatch(/^#/);
  });

  it("returns light palette for light appearance", () => {
    const palette = getPalette("light");
    expect(palette.background).toBe("#ffffff");
  });

  it("respects theme selection", () => {
    const nord = getPalette("dark", "nord");
    const catppuccin = getPalette("dark", "catppuccin");
    expect(nord.background).not.toBe(catppuccin.background);
  });

  it("falls back to auto theme for unknown theme ID", () => {
    const palette = getPalette("dark", "nonexistent" as never);
    expect(palette).toBeDefined();
  });
});

describe("getCategoryColor", () => {
  it("returns modifier color for modifier category", () => {
    const palette = getPalette("dark");
    expect(getCategoryColor("modifier", palette)).toBe(palette.modifier);
  });

  it("returns layer color for layer category", () => {
    const palette = getPalette("light");
    expect(getCategoryColor("layer", palette)).toBe(palette.layer);
  });

  it("returns default keycap fill for alpha", () => {
    const palette = getPalette("dark");
    expect(getCategoryColor("alpha", palette)).toBe(palette.keyCapFill);
  });

  it("returns specific colors for all categories", () => {
    const palette = getPalette("dark");
    const categories = [
      "modifier",
      "navigation",
      "layer",
      "function",
      "media",
      "mouse",
      "system",
      "transparent",
      "none",
    ] as const;
    for (const cat of categories) {
      expect(getCategoryColor(cat, palette)).toBeDefined();
      expect(getCategoryColor(cat, palette)).not.toBe(palette.keyCapFill);
    }
  });
});

describe("getTheme", () => {
  it("returns theme by ID", () => {
    const theme = getTheme("nord");
    expect(theme.name).toBe("Nord");
  });

  it("returns auto theme for unknown ID", () => {
    const theme = getTheme("unknown" as never);
    expect(theme.id).toBe("auto");
  });
});

describe("THEMES", () => {
  it("has at least 5 themes", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(5);
  });

  it("each theme has light and dark palettes", () => {
    for (const theme of THEMES) {
      expect(theme.light.background).toBeDefined();
      expect(theme.dark.background).toBeDefined();
      expect(theme.light.background).not.toBe(theme.dark.background);
    }
  });
});
