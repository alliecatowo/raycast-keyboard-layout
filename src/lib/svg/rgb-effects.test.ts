import { describe, it, expect } from "vitest";
import { computeKeyColors, RgbState } from "./rgb-effects";

const positions = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
];

describe("computeKeyColors", () => {
  it("returns 'none' for all keys when brightness is 0", () => {
    const state: RgbState = {
      mode: 1,
      hue: 128,
      saturation: 255,
      brightness: 0,
      speed: 128,
    };
    const colors = computeKeyColors(state, positions);
    expect(colors.every((c) => c === "none")).toBe(true);
  });

  it("returns 'none' for mode 0 (off)", () => {
    const state: RgbState = {
      mode: 0,
      hue: 128,
      saturation: 255,
      brightness: 255,
      speed: 128,
    };
    const colors = computeKeyColors(state, positions);
    expect(colors.every((c) => c === "none")).toBe(true);
  });

  it("returns uniform color for solid mode (1)", () => {
    const state: RgbState = {
      mode: 1,
      hue: 0,
      saturation: 255,
      brightness: 255,
      speed: 128,
    };
    const colors = computeKeyColors(state, positions);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(colors.every((c) => c === colors[0])).toBe(true);
  });

  it("returns varying colors for rainbow swirl (4)", () => {
    const state: RgbState = {
      mode: 4,
      hue: 0,
      saturation: 255,
      brightness: 255,
      speed: 128,
    };
    const colors = computeKeyColors(state, positions);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
    // Colors should vary by position
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("returns correct number of colors", () => {
    const state: RgbState = {
      mode: 1,
      hue: 128,
      saturation: 255,
      brightness: 128,
      speed: 128,
    };
    const colors = computeKeyColors(state, positions);
    expect(colors).toHaveLength(positions.length);
  });

  it("handles snake effect (5)", () => {
    const state: RgbState = {
      mode: 5,
      hue: 128,
      saturation: 255,
      brightness: 255,
      speed: 128,
    };
    const manyPositions = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: 0,
    }));
    const colors = computeKeyColors(state, manyPositions);
    const litKeys = colors.filter((c) => c !== "none");
    const darkKeys = colors.filter((c) => c === "none");
    expect(litKeys.length).toBeGreaterThan(0);
    expect(darkKeys.length).toBeGreaterThan(0);
  });

  it("handles static gradient (8)", () => {
    const state: RgbState = {
      mode: 8,
      hue: 0,
      saturation: 255,
      brightness: 255,
      speed: 128,
    };
    const colors = computeKeyColors(state, positions);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("falls back to solid for unknown modes", () => {
    const state: RgbState = {
      mode: 99,
      hue: 128,
      saturation: 255,
      brightness: 128,
      speed: 128,
    };
    const colors = computeKeyColors(state, positions);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(colors.every((c) => c === colors[0])).toBe(true);
  });
});
