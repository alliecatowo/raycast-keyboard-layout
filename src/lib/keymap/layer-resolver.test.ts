import { describe, it, expect } from "vitest";
import { resolveEffectiveKey } from "./layer-resolver";
import { Layer } from "../types";

const layers: Layer[] = [
  { index: 0, name: "Base", keycodes: ["KC_A", "KC_B", "KC_C", "KC_D"] },
  { index: 1, name: "Nav", keycodes: ["KC_TRNS", "KC_UP", "KC_TRNS", "KC_NO"] },
  {
    index: 2,
    name: "Fn",
    keycodes: ["KC_TRNS", "KC_TRNS", "KC_F1", "KC_TRNS"],
  },
];

describe("resolveEffectiveKey", () => {
  it("returns the key from the requested layer if not transparent", () => {
    const result = resolveEffectiveKey(layers, 1, 1);
    expect(result.parsed.label).toBe("Up");
    expect(result.fromLayer).toBe(1);
  });

  it("falls through transparent keys to the layer below", () => {
    const result = resolveEffectiveKey(layers, 1, 0);
    expect(result.parsed.label).toBe("A");
    expect(result.fromLayer).toBe(0);
  });

  it("falls through multiple transparent layers", () => {
    const result = resolveEffectiveKey(layers, 2, 0);
    expect(result.parsed.label).toBe("A");
    expect(result.fromLayer).toBe(0);
  });

  it("returns none if all layers are transparent at a position", () => {
    // Layer 2, key 3: TRNS → Layer 1, key 3: KC_NO
    const result = resolveEffectiveKey(layers, 2, 3);
    expect(result.parsed.category).toBe("none");
  });

  it("returns base layer key directly when on layer 0", () => {
    const result = resolveEffectiveKey(layers, 0, 2);
    expect(result.parsed.label).toBe("C");
    expect(result.fromLayer).toBe(0);
  });

  it("resolves _______ as transparent", () => {
    const customLayers: Layer[] = [
      { index: 0, name: "Base", keycodes: ["KC_Z"] },
      { index: 1, name: "Upper", keycodes: ["_______"] },
    ];
    const result = resolveEffectiveKey(customLayers, 1, 0);
    expect(result.parsed.label).toBe("Z");
    expect(result.fromLayer).toBe(0);
  });
});
