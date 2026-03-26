import { describe, it, expect } from "vitest";
import { numericKeycodeToString } from "./keycode-map";

describe("numericKeycodeToString", () => {
  it("converts KC_NO (0x0000)", () => {
    expect(numericKeycodeToString(0x0000)).toBe("KC_NO");
  });

  it("converts KC_TRNS (0x0001)", () => {
    expect(numericKeycodeToString(0x0001)).toBe("KC_TRNS");
  });

  it("converts basic letters", () => {
    expect(numericKeycodeToString(0x0004)).toBe("KC_A");
    expect(numericKeycodeToString(0x001d)).toBe("KC_Z");
  });

  it("converts numbers", () => {
    expect(numericKeycodeToString(0x001e)).toBe("KC_1");
    expect(numericKeycodeToString(0x0027)).toBe("KC_0");
  });

  it("converts modifiers", () => {
    expect(numericKeycodeToString(0x00e0)).toBe("KC_LCTL");
    expect(numericKeycodeToString(0x00e1)).toBe("KC_LSFT");
    expect(numericKeycodeToString(0x00e3)).toBe("KC_LGUI");
  });

  it("converts shifted symbols (QK_MODS range)", () => {
    // S(KC_1) = 0x0200 | 0x1e = 0x021e → KC_EXLM
    expect(numericKeycodeToString(0x021e)).toBe("KC_EXLM");
    // S(KC_2) = 0x021f → KC_AT
    expect(numericKeycodeToString(0x021f)).toBe("KC_AT");
  });

  it("converts QK_MOD_TAP (0x2000–0x3FFF)", () => {
    // MT(Shift, KC_A) = 0x2000 | (0x02 << 8) | 0x04 = 0x2204
    const result = numericKeycodeToString(0x2204);
    expect(result).toContain("MT");
    expect(result).toContain("Shift");
    expect(result).toContain("KC_A");
  });

  it("converts QK_LAYER_TAP (0x4000–0x4FFF)", () => {
    // LT(1, KC_SPC) = 0x4000 | (1 << 8) | 0x2c = 0x412c
    const result = numericKeycodeToString(0x412c);
    expect(result).toBe("LT(1, KC_SPC)");
  });

  it("converts QK_TO (0x5200–0x521F)", () => {
    expect(numericKeycodeToString(0x5201)).toBe("TO(1)");
  });

  it("converts QK_MOMENTARY (0x5220–0x523F)", () => {
    expect(numericKeycodeToString(0x5221)).toBe("MO(1)");
    expect(numericKeycodeToString(0x5222)).toBe("MO(2)");
  });

  it("converts QK_DEF_LAYER (0x5240–0x525F)", () => {
    expect(numericKeycodeToString(0x5240)).toBe("DF(0)");
  });

  it("converts QK_TOGGLE_LAYER (0x5260–0x527F)", () => {
    expect(numericKeycodeToString(0x5261)).toBe("TG(1)");
  });

  it("converts QK_ONE_SHOT_LAYER (0x5280–0x529F)", () => {
    expect(numericKeycodeToString(0x5281)).toBe("OSL(1)");
  });

  it("converts QK_ONE_SHOT_MOD (0x52A0–0x52BF)", () => {
    const result = numericKeycodeToString(0x52a2);
    expect(result).toContain("OSM");
    expect(result).toContain("Shift");
  });

  it("converts QK_LAYER_TAP_TOGGLE (0x52C0–0x52DF)", () => {
    expect(numericKeycodeToString(0x52c1)).toBe("TT(1)");
  });

  it("converts QK_TAP_DANCE (0x5700–0x57FF)", () => {
    expect(numericKeycodeToString(0x5703)).toBe("TD(3)");
  });

  it("converts QK_MACRO (0x7700–0x777F)", () => {
    expect(numericKeycodeToString(0x7700)).toBe("M0");
    expect(numericKeycodeToString(0x7705)).toBe("M5");
  });

  it("converts QK_BOOTLOADER (0x7C00)", () => {
    expect(numericKeycodeToString(0x7c00)).toBe("QK_BOOT");
  });

  it("converts QK_CLEAR_EEPROM (0x7C03)", () => {
    expect(numericKeycodeToString(0x7c03)).toBe("EE_CLR");
  });

  it("converts QK_KB (0x7E00–0x7E3F)", () => {
    expect(numericKeycodeToString(0x7e00)).toBe("KB_0");
    expect(numericKeycodeToString(0x7e05)).toBe("KB_5");
  });

  it("converts QK_USER (0x7E40–0x7FFF)", () => {
    expect(numericKeycodeToString(0x7e40)).toBe("USER_0");
    expect(numericKeycodeToString(0x7e45)).toBe("USER_5");
  });

  it("converts lighting keycodes", () => {
    expect(numericKeycodeToString(0x7820)).toBe("RGB_TOG");
    expect(numericKeycodeToString(0x7821)).toBe("RGB_MOD");
  });

  it("falls back to hex for truly unknown keycodes", () => {
    const result = numericKeycodeToString(0xffff);
    expect(result).toMatch(/^0x/i);
  });
});
