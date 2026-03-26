import { describe, it, expect } from "vitest";
import { getLayerKeys } from "./layer-detect";
import { BoardProfile } from "./types";

function makeBoard(keycodes: string[]): BoardProfile {
  return {
    id: "test",
    name: "Test",
    keyboard: "test",
    layoutKey: "LAYOUT",
    firmware: "qmk",
    layers: [{ index: 0, name: "Base", keycodes }],
    physicalLayout: keycodes.map((_, i) => ({ x: i, y: 0, w: 1, h: 1 })),
    createdAt: "",
    updatedAt: "",
  };
}

describe("getLayerKeys", () => {
  it("finds MO keys", () => {
    const board = makeBoard(["KC_A", "MO(1)", "KC_B", "MO(2)"]);
    const result = getLayerKeys(board);
    expect(result).toHaveLength(2);
    expect(result[0].targetLayer).toBe(1);
    expect(result[1].targetLayer).toBe(2);
  });

  it("finds TG keys", () => {
    const board = makeBoard(["TG(3)", "KC_A"]);
    const result = getLayerKeys(board);
    expect(result).toHaveLength(1);
    expect(result[0].targetLayer).toBe(3);
  });

  it("finds LT keys", () => {
    const board = makeBoard(["LT(1, KC_SPC)", "KC_A"]);
    const result = getLayerKeys(board);
    expect(result).toHaveLength(1);
    expect(result[0].targetLayer).toBe(1);
  });

  it("finds TT keys", () => {
    const board = makeBoard(["TT(2)"]);
    const result = getLayerKeys(board);
    expect(result).toHaveLength(1);
    expect(result[0].targetLayer).toBe(2);
  });

  it("returns empty for boards with no layer keys", () => {
    const board = makeBoard(["KC_A", "KC_B", "KC_C"]);
    expect(getLayerKeys(board)).toHaveLength(0);
  });

  it("returns empty for boards with no layers", () => {
    const board = makeBoard([]);
    expect(getLayerKeys(board)).toHaveLength(0);
  });

  it("tracks key index correctly", () => {
    const board = makeBoard(["KC_A", "KC_B", "MO(1)", "KC_C"]);
    const result = getLayerKeys(board);
    expect(result[0].keyIndex).toBe(2);
  });
});
