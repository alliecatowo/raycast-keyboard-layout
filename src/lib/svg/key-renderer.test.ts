import { describe, it, expect } from "vitest";
import { renderKey } from "./key-renderer";
import { getPalette } from "./colors";
import { parseKeycode } from "../keymap/keycodes";

const palette = getPalette("dark");

describe("renderKey", () => {
  it("renders a basic key", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_A"),
      palette,
      isHighlighted: false,
      isGhost: false,
    });
    expect(svg).toContain("<g>");
    expect(svg).toContain("<rect");
    expect(svg).toContain(">A<");
  });

  it("renders highlighted key with glow", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_B"),
      palette,
      isHighlighted: true,
      isGhost: false,
    });
    expect(svg).toContain("opacity");
  });

  it("renders ghost key with reduced opacity", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_C"),
      palette,
      isHighlighted: false,
      isGhost: true,
    });
    expect(svg).toContain('opacity="0.5"');
    expect(svg).toContain("stroke-dasharray");
  });

  it("renders transparent key with dashed border", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_TRNS"),
      palette,
      isHighlighted: false,
      isGhost: false,
    });
    expect(svg).toContain("stroke-dasharray");
  });

  it("renders none key", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_NO"),
      palette,
      isHighlighted: false,
      isGhost: false,
    });
    expect(svg).toContain("<g>");
  });

  it("renders key with hold label", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("LT(1, KC_SPC)"),
      palette,
      isHighlighted: false,
      isGhost: false,
    });
    expect(svg).toContain(">Space<");
    expect(svg).toContain(">L1<");
  });

  it("renders rotated key with transform", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_A"),
      palette,
      isHighlighted: false,
      isGhost: false,
      rotation: { angle: 15, cx: 35, cy: 35 },
    });
    expect(svg).toContain("transform");
    expect(svg).toContain("rotate(15");
  });

  it("renders RGB color overlay", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_A"),
      palette,
      isHighlighted: false,
      isGhost: false,
      rgbColor: "#ff0000",
    });
    expect(svg).toContain("#ff0000");
    expect(svg).toContain('opacity="0.85"');
  });

  it("does not render RGB when color is 'none'", () => {
    const svg = renderKey({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parsed: parseKeycode("KC_A"),
      palette,
      isHighlighted: false,
      isGhost: false,
      rgbColor: "none",
    });
    expect(svg).not.toContain('opacity="0.85"');
  });

  it("adjusts font size for long labels", () => {
    const short = renderKey({
      x: 10, y: 10, width: 50, height: 50,
      parsed: parseKeycode("KC_A"),
      palette, isHighlighted: false, isGhost: false,
    });
    const long = renderKey({
      x: 10, y: 10, width: 50, height: 50,
      parsed: parseKeycode("KC_PSCR"),
      palette, isHighlighted: false, isGhost: false,
    });
    // Short label gets bigger font
    expect(short).toContain('font-size="17"');
    // Longer label gets smaller font
    expect(long).not.toContain('font-size="17"');
  });
});
