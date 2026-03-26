import { describe, it, expect } from "vitest";
import {
  parseZmkKeymap,
  isZmkKeymap,
  isQmkKeymapJson,
  detectFirmwareType,
} from "./zmk-parser";

// Must match real ZMK keymap formatting — closing }; on its own line with proper indentation
const SAMPLE_ZMK_KEYMAP = [
  "#include <behaviors.dtsi>",
  "#include <dt-bindings/zmk/keys.h>",
  "",
  "/ {",
  "  keymap {",
  '    compatible = "zmk,keymap";',
  "",
  "    default_layer {",
  '      display-name = "Base";',
  "      bindings = <&kp Q &kp W &kp E &kp R &kp A &kp S &kp D &kp F>;",
  "    };",
  "",
  "    nav_layer {",
  '      display-name = "Nav";',
  "      bindings = <&trans &trans &kp UP &trans &trans &kp LEFT &kp DOWN &kp RIGHT>;",
  "    };",
  "  };",
  "};",
].join("\n");

describe("isZmkKeymap", () => {
  it("detects ZMK keymap files", () => {
    expect(isZmkKeymap(SAMPLE_ZMK_KEYMAP)).toBe(true);
  });

  it("rejects non-ZMK content", () => {
    expect(isZmkKeymap('{"keyboard": "test"}')).toBe(false);
    expect(isZmkKeymap("random text")).toBe(false);
  });
});

describe("isQmkKeymapJson", () => {
  it("detects QMK keymap.json", () => {
    expect(
      isQmkKeymapJson(JSON.stringify({ keyboard: "test", layers: [["KC_A"]] })),
    ).toBe(true);
  });

  it("rejects non-QMK content", () => {
    expect(isQmkKeymapJson(SAMPLE_ZMK_KEYMAP)).toBe(false);
    expect(isQmkKeymapJson("not json")).toBe(false);
  });
});

describe("detectFirmwareType", () => {
  it("detects QMK from JSON", () => {
    expect(
      detectFirmwareType(
        JSON.stringify({ keyboard: "test", layers: [["KC_A"]] }),
      ),
    ).toBe("qmk");
  });

  it("detects ZMK from keymap", () => {
    expect(detectFirmwareType(SAMPLE_ZMK_KEYMAP)).toBe("zmk");
  });

  it("returns unknown for unrecognized content", () => {
    expect(detectFirmwareType("hello world")).toBe("unknown");
  });
});

describe("parseZmkKeymap", () => {
  it("parses layers from ZMK keymap", () => {
    const result = parseZmkKeymap(SAMPLE_ZMK_KEYMAP, "My Board");
    expect(result.name).toBe("My Board");
    expect(result.firmware).toBe("zmk");
    expect(result.layers).toHaveLength(2);
  });

  it("extracts display-name for layers", () => {
    const result = parseZmkKeymap(SAMPLE_ZMK_KEYMAP, "Test");
    expect(result.layers[0].name).toBe("Base");
    expect(result.layers[1].name).toBe("Nav");
  });

  it("parses key bindings", () => {
    const result = parseZmkKeymap(SAMPLE_ZMK_KEYMAP, "Test");
    expect(result.layers[0].keycodes).toHaveLength(8);
    expect(result.layers[0].keycodes[0]).toBe("KC_Q");
    expect(result.layers[1].keycodes[0]).toBe("KC_TRNS");
  });

  it("parses &mo bindings as MO(n)", () => {
    const keymap = [
      "/ {",
      "  keymap {",
      '    compatible = "zmk,keymap";',
      "    base {",
      "      bindings = <&kp A &mo 1>;",
      "    };",
      "    upper {",
      "      bindings = <&trans &kp B>;",
      "    };",
      "  };",
      "};",
    ].join("\n");
    const result = parseZmkKeymap(keymap, "Test");
    expect(result.layers[0].keycodes[1]).toBe("MO(1)");
  });

  it("throws for missing keymap node", () => {
    expect(() => parseZmkKeymap("/ { other {} };", "Test")).toThrow(
      "Could not find keymap node",
    );
  });

  it("throws for empty layers", () => {
    const keymap = [
      "/ {",
      "  keymap {",
      '    compatible = "zmk,keymap";',
      "  };",
      "};",
    ].join("\n");
    expect(() => parseZmkKeymap(keymap, "Test")).toThrow("No layers found");
  });

  it("stores source file", () => {
    const result = parseZmkKeymap(
      SAMPLE_ZMK_KEYMAP,
      "Test",
      "/path/to/file.keymap",
    );
    expect(result.sourceFile).toBe("/path/to/file.keymap");
  });
});
