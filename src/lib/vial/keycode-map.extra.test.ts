import { describe, it, expect } from "vitest";
import { numericKeycodeToString } from "./keycode-map";

describe("numericKeycodeToString — edge cases and remaining ranges", () => {
  // QK_LAYER_MOD (0x5000–0x51FF)
  it("converts QK_LAYER_MOD", () => {
    const result = numericKeycodeToString(0x5012);
    expect(result).toContain("LM");
  });

  // QK_PERSISTENT_DEF_LAYER (0x52E0–0x52FF)
  it("converts PDF (persistent default layer)", () => {
    expect(numericKeycodeToString(0x52e1)).toBe("PDF(1)");
  });

  // QK_SWAP_HANDS (0x5600–0x56FF)
  it("converts SH_TOGG (swap hands toggle)", () => {
    expect(numericKeycodeToString(0x5600)).toBe("SH_TOGG");
  });

  it("converts SH_T(kc) (swap hands tap)", () => {
    const result = numericKeycodeToString(0x5604);
    expect(result).toContain("SH_T");
    expect(result).toContain("KC_A");
  });

  // F-keys
  it("converts F13-F24", () => {
    expect(numericKeycodeToString(0x0068)).toBe("KC_F13");
    expect(numericKeycodeToString(0x0073)).toBe("KC_F24");
  });

  // Numpad
  it("converts numpad keys", () => {
    expect(numericKeycodeToString(0x0059)).toBe("KC_P1");
    expect(numericKeycodeToString(0x0062)).toBe("KC_P0");
    expect(numericKeycodeToString(0x0063)).toBe("KC_PDOT");
  });

  // Navigation
  it("converts navigation keys", () => {
    expect(numericKeycodeToString(0x004f)).toBe("KC_RGHT");
    expect(numericKeycodeToString(0x0050)).toBe("KC_LEFT");
    expect(numericKeycodeToString(0x004a)).toBe("KC_HOME");
    expect(numericKeycodeToString(0x004d)).toBe("KC_END");
  });

  // macOS keycodes
  it("converts macOS-specific keycodes", () => {
    expect(numericKeycodeToString(0x00d1)).toBe("KC_BRMU");
    expect(numericKeycodeToString(0x00d4)).toBe("KC_MCTL");
    expect(numericKeycodeToString(0x00d5)).toBe("KC_LPAD");
  });

  // Combined modifiers in QK_MODS
  it("decodes combined modifier keys", () => {
    // Ctrl+Shift = 0x03, KC_A = 0x04: 0x0304
    const result = numericKeycodeToString(0x0304);
    expect(result).toContain("Ctrl");
    expect(result).toContain("Shift");
  });

  // Hyper
  it("decodes Hyper modifier", () => {
    const result = numericKeycodeToString(0x0f04); // HYPR(KC_A)
    expect(result).toContain("Hyper");
  });

  // Meh
  it("decodes Meh modifier", () => {
    const result = numericKeycodeToString(0x0704); // MEH(KC_A)
    expect(result).toContain("Meh");
  });

  // Right modifiers in QK_MOD_TAP
  it("decodes right modifier in mod-tap", () => {
    // MT(RShift, KC_A) = 0x2000 | (0x12 << 8) | 0x04 = 0x3204
    const result = numericKeycodeToString(0x3204);
    expect(result).toContain("MT");
    expect(result).toContain("RShift");
  });

  // Quantum keycodes
  it("converts debug toggle", () => {
    expect(numericKeycodeToString(0x7c02)).toBe("DB_TOGG");
  });

  it("converts caps word toggle", () => {
    expect(numericKeycodeToString(0x7c73)).toBe("CW_TOGG");
  });

  it("converts repeat key", () => {
    expect(numericKeycodeToString(0x7c79)).toBe("QK_REP");
  });

  it("converts layer lock", () => {
    expect(numericKeycodeToString(0x7c7b)).toBe("QK_LLCK");
  });

  // RGB matrix keycodes
  it("converts RGB matrix keycodes", () => {
    expect(numericKeycodeToString(0x7840)).toBe("RM_ON");
    expect(numericKeycodeToString(0x7842)).toBe("RM_TOGG");
    expect(numericKeycodeToString(0x784c)).toBe("RM_SPDD");
  });

  // Backlight
  it("converts backlight keycodes", () => {
    expect(numericKeycodeToString(0x7800)).toBe("BL_ON");
    expect(numericKeycodeToString(0x7802)).toBe("BL_TOGG");
  });

  // Unknown basic keycode
  it("handles unknown basic keycodes", () => {
    const result = numericKeycodeToString(0x00fe);
    expect(result).toContain("KC_");
  });

  // Vendored fallback
  it("uses vendored keycode DB for known codes not in our map", () => {
    // Grave escape is in the quantum range (0x7C16)
    expect(numericKeycodeToString(0x7c16)).toBe("KC_GESC");
  });
});
