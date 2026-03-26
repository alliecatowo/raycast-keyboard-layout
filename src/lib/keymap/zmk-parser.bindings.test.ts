import { describe, it, expect } from "vitest";
import { parseZmkKeymap } from "./zmk-parser";

function makeKeymap(bindings: string): string {
  return [
    "/ {",
    "  keymap {",
    '    compatible = "zmk,keymap";',
    "    test_layer {",
    `      bindings = <${bindings}>;`,
    "    };",
    "  };",
    "};",
  ].join("\n");
}

describe("zmkBindingToKeycode — all binding types", () => {
  it("parses &kp (key press)", () => {
    const result = parseZmkKeymap(makeKeymap("&kp A &kp SPACE"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("KC_A");
    expect(result.layers[0].keycodes[1]).toBe("KC_SPACE");
  });

  it("parses &none", () => {
    const result = parseZmkKeymap(makeKeymap("&none"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("KC_NO");
  });

  it("parses &trans", () => {
    const result = parseZmkKeymap(makeKeymap("&trans"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("KC_TRNS");
  });

  it("parses &mo (momentary layer)", () => {
    const result = parseZmkKeymap(makeKeymap("&mo 1"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("MO(1)");
  });

  it("parses &to (to layer)", () => {
    const result = parseZmkKeymap(makeKeymap("&to 2"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("TO(2)");
  });

  it("parses &tog (toggle layer)", () => {
    const result = parseZmkKeymap(makeKeymap("&tog 3"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("TG(3)");
  });

  it("parses &sl (sticky layer / one-shot layer)", () => {
    const result = parseZmkKeymap(makeKeymap("&sl 1"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("OSL(1)");
  });

  it("parses &sk (sticky key / one-shot mod)", () => {
    const result = parseZmkKeymap(makeKeymap("&sk LSHIFT"), "Test");
    const kc = result.layers[0].keycodes[0];
    expect(kc).toContain("OSM");
  });

  it("parses &mt (mod-tap)", () => {
    const result = parseZmkKeymap(makeKeymap("&mt LSHIFT A"), "Test");
    const kc = result.layers[0].keycodes[0];
    expect(kc).toContain("MT");
  });

  it("parses &lt (layer-tap)", () => {
    const result = parseZmkKeymap(makeKeymap("&lt 1 SPACE"), "Test");
    const kc = result.layers[0].keycodes[0];
    expect(kc).toContain("LT");
    expect(kc).toContain("1");
  });

  it("parses &bootloader", () => {
    const result = parseZmkKeymap(makeKeymap("&bootloader"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("QK_BOOT");
  });

  it("parses &sys_reset", () => {
    const result = parseZmkKeymap(makeKeymap("&sys_reset"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("QK_RBT");
  });

  it("parses &reset (legacy)", () => {
    const result = parseZmkKeymap(makeKeymap("&reset"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("QK_RBT");
  });

  it("handles unknown bindings by stripping &", () => {
    const result = parseZmkKeymap(makeKeymap("&custom_behavior"), "Test");
    expect(result.layers[0].keycodes[0]).toBe("custom_behavior");
  });

  it("handles multiple layers", () => {
    const keymap = [
      "/ {",
      "  keymap {",
      '    compatible = "zmk,keymap";',
      "    base { bindings = <&kp A &kp B>; };",
      "    upper { bindings = <&kp N1 &kp N2>; };",
      "  };",
      "};",
    ].join("\n");
    const result = parseZmkKeymap(keymap, "Test");
    expect(result.layers).toHaveLength(2);
    expect(result.layers[0].keycodes).toEqual(["KC_A", "KC_B"]);
    expect(result.layers[1].keycodes).toEqual(["KC_N1", "KC_N2"]);
  });

  it("uses node name when no display-name", () => {
    const keymap = [
      "/ {",
      "  keymap {",
      '    compatible = "zmk,keymap";',
      "    my_cool_layer { bindings = <&kp A>; };",
      "  };",
      "};",
    ].join("\n");
    const result = parseZmkKeymap(keymap, "Test");
    expect(result.layers[0].name).toBe("My cool");
  });

  it("strips _layer suffix from node name", () => {
    const keymap = [
      "/ {",
      "  keymap {",
      '    compatible = "zmk,keymap";',
      "    nav_layer { bindings = <&kp UP>; };",
      "  };",
      "};",
    ].join("\n");
    const result = parseZmkKeymap(keymap, "Test");
    expect(result.layers[0].name).toBe("Nav");
  });

  it("strips C-style comments", () => {
    const keymap = [
      "/* block comment */",
      "/ {",
      "  keymap {",
      '    compatible = "zmk,keymap";',
      "    base { bindings = <&kp A>; }; // line comment",
      "  };",
      "};",
    ].join("\n");
    const result = parseZmkKeymap(keymap, "Test");
    expect(result.layers).toHaveLength(1);
  });

  it("strips preprocessor directives", () => {
    const keymap = [
      "#include <behaviors.dtsi>",
      "#define MY_MACRO 42",
      "/ {",
      "  keymap {",
      '    compatible = "zmk,keymap";',
      "    base { bindings = <&kp A>; };",
      "  };",
      "};",
    ].join("\n");
    const result = parseZmkKeymap(keymap, "Test");
    expect(result.layers).toHaveLength(1);
  });
});
