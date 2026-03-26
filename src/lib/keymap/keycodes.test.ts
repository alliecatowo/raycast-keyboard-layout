import { describe, it, expect } from "vitest";
import { parseKeycode, lookupKeycode, searchKeycodes } from "./keycodes";

describe("lookupKeycode", () => {
  it("finds basic keycodes by exact code", () => {
    expect(lookupKeycode("KC_A")).toBeDefined();
    expect(lookupKeycode("KC_A")?.label).toBe("A");
  });

  it("finds keycodes case-insensitively", () => {
    expect(lookupKeycode("kc_a")).toBeDefined();
    expect(lookupKeycode("KC_ESC")?.label).toBe("Esc");
  });

  it("returns undefined for unknown keycodes", () => {
    expect(lookupKeycode("KC_NONEXISTENT")).toBeUndefined();
  });
});

describe("searchKeycodes", () => {
  it("returns empty for empty query", () => {
    expect(searchKeycodes("")).toEqual([]);
    expect(searchKeycodes("  ")).toEqual([]);
  });

  it("finds exact matches", () => {
    const results = searchKeycodes("KC_A");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("KC_A");
  });

  it("finds by label", () => {
    const results = searchKeycodes("Esc");
    expect(results.some((r) => r.code === "KC_ESC")).toBe(true);
  });

  it("finds by alias", () => {
    const results = searchKeycodes("Backspace");
    expect(results.some((r) => r.code === "KC_BSPC")).toBe(true);
  });
});

describe("parseKeycode", () => {
  it("parses transparent", () => {
    expect(parseKeycode("KC_TRNS").category).toBe("transparent");
    expect(parseKeycode("_______").category).toBe("transparent");
  });

  it("parses none", () => {
    expect(parseKeycode("KC_NO").category).toBe("none");
    expect(parseKeycode("XXXXXXX").category).toBe("none");
  });

  it("parses basic keycodes", () => {
    const result = parseKeycode("KC_A");
    expect(result.label).toBe("A");
    expect(result.category).toBe("alpha");
  });

  it("parses modifiers", () => {
    const result = parseKeycode("KC_LSFT");
    expect(result.label).toBe("Shift");
    expect(result.category).toBe("modifier");
  });

  it("parses MO(n)", () => {
    const result = parseKeycode("MO(1)");
    expect(result.label).toBe("MO(1)");
    expect(result.holdLabel).toBe("L1");
    expect(result.category).toBe("layer");
  });

  it("parses LT(n, kc)", () => {
    const result = parseKeycode("LT(2, KC_SPC)");
    expect(result.label).toBe("Space");
    expect(result.holdLabel).toBe("L2");
    expect(result.category).toBe("layer");
  });

  it("parses MT(mod, kc)", () => {
    const result = parseKeycode("MT(MOD_LSFT, KC_T)");
    expect(result.label).toBe("T");
    expect(result.holdLabel).toBe("Shift");
    expect(result.category).toBe("modifier");
  });

  it("parses TG(n)", () => {
    const result = parseKeycode("TG(3)");
    expect(result.label).toBe("TG(3)");
    expect(result.category).toBe("layer");
  });

  it("parses OSL(n)", () => {
    const result = parseKeycode("OSL(1)");
    expect(result.label).toBe("OSL(1)");
    expect(result.category).toBe("layer");
  });

  it("parses TO(n)", () => {
    const result = parseKeycode("TO(0)");
    expect(result.label).toBe("TO(0)");
    expect(result.category).toBe("layer");
  });

  it("parses TT(n)", () => {
    const result = parseKeycode("TT(2)");
    expect(result.label).toBe("TT(2)");
    expect(result.holdLabel).toBe("L2");
    expect(result.category).toBe("layer");
  });

  it("parses TD(n)", () => {
    const result = parseKeycode("TD(5)");
    expect(result.label).toBe("TD5");
    expect(result.category).toBe("tapdance");
  });

  it("parses KB_n (user keycodes)", () => {
    const result = parseKeycode("KB_0");
    expect(result.label).toBe("User 0");
    expect(result.category).toBe("macro");
  });

  it("parses RGB keycodes", () => {
    const result = parseKeycode("RGB_TOG");
    expect(result.label).toBe("RGB");
    expect(result.category).toBe("media");
  });

  it("parses system keycodes", () => {
    expect(parseKeycode("QK_BOOT").label).toBe("Boot");
    expect(parseKeycode("EE_CLR").label).toBe("EEClr");
    expect(parseKeycode("DB_TOGG").label).toBe("Debug");
  });

  it("parses mod-tap shorthand", () => {
    const result = parseKeycode("LSFT_T(KC_A)");
    expect(result.label).toBe("A");
    expect(result.holdLabel).toBe("Shift");
  });

  it("strips KC_ prefix for unknown keycodes", () => {
    const result = parseKeycode("KC_UNKNOWN_THING");
    expect(result.label).toBe("UNKNOWN_THING");
  });
});
