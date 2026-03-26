import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import { generateSvg, clearSvgCache } from "./renderer";
import { PhysicalKey, Layer } from "../types";

const layout: PhysicalKey[] = [
  { x: 0, y: 0, w: 1, h: 1 },
  { x: 1, y: 0, w: 1, h: 1 },
  { x: 2, y: 0, w: 1, h: 1 },
  { x: 0, y: 1, w: 1, h: 1 },
  { x: 1, y: 1, w: 1, h: 1 },
  { x: 2, y: 1, w: 1, h: 1 },
];

const layers: Layer[] = [
  {
    index: 0,
    name: "Base",
    keycodes: ["KC_A", "KC_B", "KC_C", "KC_D", "KC_E", "KC_F"],
  },
  {
    index: 1,
    name: "Nav",
    keycodes: ["KC_TRNS", "KC_UP", "KC_TRNS", "KC_LEFT", "KC_DOWN", "KC_RGHT"],
  },
];

beforeAll(() => {
  clearSvgCache();
});

describe("generateSvg", () => {
  it("generates valid SVG markup", () => {
    const result = generateSvg(layout, {
      appearance: "dark",
      layerIndex: 0,
      layers,
    });
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("writes SVG to a file", () => {
    const result = generateSvg(layout, {
      appearance: "dark",
      layerIndex: 0,
      layers,
    });
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain("/tmp/keyviz/");
  });

  it("renders key labels in SVG", () => {
    const result = generateSvg(layout, {
      appearance: "dark",
      layerIndex: 0,
      layers,
    });
    expect(result.svg).toContain(">A<");
    expect(result.svg).toContain(">B<");
  });

  it("renders ghost keys for transparent layer", () => {
    const result = generateSvg(layout, {
      appearance: "dark",
      layerIndex: 1,
      layers,
      showGhostKeys: true,
    });
    // Ghost keys should show inherited keys at reduced opacity
    expect(result.svg).toContain('opacity="0.5"');
  });

  it("renders with light theme", () => {
    const result = generateSvg(layout, {
      appearance: "light",
      layerIndex: 0,
      layers,
    });
    expect(result.svg).toContain("<svg");
  });

  it("handles highlight keys", () => {
    const result = generateSvg(layout, {
      appearance: "dark",
      layerIndex: 0,
      layers,
      highlightKeys: [0, 2],
    });
    // Highlighted keys get a glow effect
    expect(result.svg).toContain("opacity");
  });

  it("caches identical renders", () => {
    const opts = { appearance: "dark" as const, layerIndex: 0, layers };
    const r1 = generateSvg(layout, opts);
    const r2 = generateSvg(layout, opts);
    expect(r1.filePath).toBe(r2.filePath);
  });

  it("generates different files for different options", () => {
    const r1 = generateSvg(layout, {
      appearance: "dark",
      layerIndex: 0,
      layers,
    });
    const r2 = generateSvg(layout, {
      appearance: "light",
      layerIndex: 0,
      layers,
    });
    expect(r1.filePath).not.toBe(r2.filePath);
  });

  it("supports split view filtering", () => {
    const splitLayout: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
      { x: 5, y: 0, w: 1, h: 1 }, // > 2u gap = split
      { x: 6, y: 0, w: 1, h: 1 },
    ];
    const splitLayers: Layer[] = [
      { index: 0, name: "Base", keycodes: ["KC_A", "KC_B", "KC_C", "KC_D"] },
    ];

    const left = generateSvg(splitLayout, {
      appearance: "dark",
      layerIndex: 0,
      layers: splitLayers,
      splitView: "left",
    });
    const right = generateSvg(splitLayout, {
      appearance: "dark",
      layerIndex: 0,
      layers: splitLayers,
      splitView: "right",
    });
    const both = generateSvg(splitLayout, {
      appearance: "dark",
      layerIndex: 0,
      layers: splitLayers,
      splitView: "both",
    });

    // Left half should be narrower than both
    expect(left.width).toBeLessThan(both.width);
    expect(right.width).toBeLessThan(both.width);
  });

  it("supports RGB color overlay", () => {
    const colors = [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "none",
      "#ffff00",
      "#ff00ff",
    ];
    const result = generateSvg(layout, {
      appearance: "dark",
      layerIndex: 0,
      layers,
      rgbColors: colors,
    });
    expect(result.svg).toContain("#ff0000");
    expect(result.svg).toContain("#00ff00");
  });

  it("throws for invalid layer index", () => {
    expect(() =>
      generateSvg(layout, {
        appearance: "dark",
        layerIndex: 99,
        layers,
      }),
    ).toThrow("Layer 99 not found");
  });

  it("supports theme selection", () => {
    const nord = generateSvg(layout, {
      appearance: "dark",
      theme: "nord",
      layerIndex: 0,
      layers,
    });
    const solarized = generateSvg(layout, {
      appearance: "dark",
      theme: "solarized",
      layerIndex: 0,
      layers,
    });
    expect(nord.svg).not.toBe(solarized.svg);
  });
});
