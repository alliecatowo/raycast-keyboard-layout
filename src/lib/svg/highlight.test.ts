import { describe, it, expect } from "vitest";
import { findKeyInLayers } from "./highlight";
import { Layer } from "../types";

const layers: Layer[] = [
  {
    index: 0,
    name: "Base",
    keycodes: ["KC_A", "KC_B", "KC_ESC", "MO(1)"],
  },
  {
    index: 1,
    name: "Nav",
    keycodes: ["KC_TRNS", "KC_UP", "KC_DOWN", "KC_TRNS"],
  },
];

describe("findKeyInLayers", () => {
  it("finds keys by exact keycode", () => {
    const results = findKeyInLayers("KC_A", layers, "board1", "Test Board");
    expect(results).toHaveLength(1);
    expect(results[0].layerIndex).toBe(0);
    expect(results[0].keyIndex).toBe(0);
  });

  it("finds keys by label", () => {
    const results = findKeyInLayers("Esc", layers, "board1", "Test");
    expect(results.some((r) => r.raw === "KC_ESC")).toBe(true);
  });

  it("finds keys across multiple layers", () => {
    const results = findKeyInLayers("Up", layers, "board1", "Test");
    expect(results.some((r) => r.layerIndex === 1)).toBe(true);
  });

  it("skips transparent and none keys", () => {
    const results = findKeyInLayers("KC_TRNS", layers, "board1", "Test");
    expect(results).toHaveLength(0);
  });

  it("returns empty for no matches", () => {
    const results = findKeyInLayers("NONEXISTENT", layers, "board1", "Test");
    expect(results).toHaveLength(0);
  });

  it("returns empty for empty query", () => {
    expect(findKeyInLayers("", layers, "board1", "Test")).toHaveLength(0);
    expect(findKeyInLayers("  ", layers, "board1", "Test")).toHaveLength(0);
  });

  it("includes board info in results", () => {
    const results = findKeyInLayers("KC_A", layers, "my-board-id", "My Board");
    expect(results[0].boardId).toBe("my-board-id");
    expect(results[0].boardName).toBe("My Board");
  });

  it("finds layer keys by substring", () => {
    const results = findKeyInLayers("MO", layers, "board1", "Test");
    expect(results.some((r) => r.raw === "MO(1)")).toBe(true);
  });
});
