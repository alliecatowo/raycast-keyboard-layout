import { describe, it, expect } from "vitest";
import { parseQmkKeymapJson, keymapToBoardProfile } from "./parser";

describe("parseQmkKeymapJson", () => {
  it("parses valid QMK keymap.json", () => {
    const json = JSON.stringify({
      keyboard: "crkbd/rev1",
      keymap: "default",
      layout: "LAYOUT_split_3x6_3",
      layers: [
        ["KC_ESC", "KC_Q", "KC_W"],
        ["KC_TRNS", "KC_1", "KC_2"],
      ],
    });

    const result = parseQmkKeymapJson(json);
    expect(result.keyboard).toBe("crkbd/rev1");
    expect(result.layout).toBe("LAYOUT_split_3x6_3");
    expect(result.layers).toHaveLength(2);
    expect(result.layers[0]).toEqual(["KC_ESC", "KC_Q", "KC_W"]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseQmkKeymapJson("not json")).toThrow("Invalid JSON");
  });

  it("throws on missing keyboard field", () => {
    expect(() =>
      parseQmkKeymapJson(JSON.stringify({ layout: "X", layers: [[]] })),
    ).toThrow("missing 'keyboard'");
  });

  it("throws on missing layout field", () => {
    expect(() =>
      parseQmkKeymapJson(JSON.stringify({ keyboard: "test", layers: [[]] })),
    ).toThrow("missing 'layout'");
  });

  it("throws on empty layers", () => {
    expect(() =>
      parseQmkKeymapJson(
        JSON.stringify({ keyboard: "test", layout: "X", layers: [] }),
      ),
    ).toThrow("missing or empty 'layers'");
  });
});

describe("keymapToBoardProfile", () => {
  it("converts parsed keymap to board profile", () => {
    const keymap = {
      keyboard: "crkbd/rev1",
      keymap: "custom",
      layout: "LAYOUT_split_3x6_3",
      layers: [
        ["KC_A", "KC_B", "KC_C"],
        ["KC_UP", "KC_DOWN", "KC_LEFT"],
      ],
    };

    const profile = keymapToBoardProfile(keymap, "My Corne");
    expect(profile.name).toBe("My Corne");
    expect(profile.keyboard).toBe("crkbd/rev1");
    expect(profile.firmware).toBe("qmk");
    expect(profile.layers).toHaveLength(2);
    expect(profile.layers[0].name).toBe("Base");
    expect(profile.layers[1].name).toBe("Nav"); // heuristic from arrows
  });

  it("auto-names layers based on keycodes", () => {
    const keymap = {
      keyboard: "test",
      keymap: "test",
      layout: "LAYOUT",
      layers: [
        ["KC_A"],
        ["KC_F1", "KC_F2", "KC_F3"],
        ["KC_MUTE", "KC_VOLU", "KC_VOLD"],
      ],
    };

    const profile = keymapToBoardProfile(keymap, "Test");
    expect(profile.layers[0].name).toBe("Base");
    expect(profile.layers[1].name).toBe("Fn");
    expect(profile.layers[2].name).toBe("Media");
  });

  it("stores source file path", () => {
    const keymap = {
      keyboard: "test",
      keymap: "test",
      layout: "LAYOUT",
      layers: [["KC_A"]],
    };
    const profile = keymapToBoardProfile(
      keymap,
      "Test",
      "/path/to/keymap.json",
    );
    expect(profile.sourceFile).toBe("/path/to/keymap.json");
  });
});
