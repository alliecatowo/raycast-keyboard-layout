import { describe, it, expect } from "vitest";
import { getFirmwareConfig } from "./config";

describe("getFirmwareConfig", () => {
  it("returns Vial config for qmk firmware", () => {
    const config = getFirmwareConfig("qmk");
    expect(config.displayName).toContain("Vial");
    expect(config.hasUsbSettings).toBe(true);
    expect(config.hasRgbControl).toBe(true);
    expect(config.hasMatrixState).toBe(true);
    expect(config.hasLockDetection).toBe(true);
    expect(config.configuratorUrl).toContain("vial");
  });

  it("returns VIA config for via firmware", () => {
    const config = getFirmwareConfig("via");
    expect(config.displayName).toBe("VIA");
    expect(config.hasUsbSettings).toBe(false);
    expect(config.hasRgbControl).toBe(true);
    expect(config.hasTapDance).toBe(false);
    expect(config.configuratorUrl).toContain("usevia");
  });

  it("returns Vial config for vial firmware", () => {
    const config = getFirmwareConfig("vial");
    expect(config.displayName).toBe("Vial");
    expect(config.hasUsbSettings).toBe(true);
    expect(config.hasCombos).toBe(true);
    expect(config.hasKeyOverrides).toBe(true);
  });

  it("returns ZMK config for zmk firmware", () => {
    const config = getFirmwareConfig("zmk");
    expect(config.displayName).toContain("ZMK");
    expect(config.hasUsbSettings).toBe(false);
    expect(config.hasRgbControl).toBe(false);
    expect(config.hasWritableLayerNames).toBe(true);
    expect(config.hasMatrixState).toBe(false);
    expect(config.configuratorUrl).toContain("zmk");
  });

  it("returns different configurator URLs for each firmware", () => {
    const urls = new Set([
      getFirmwareConfig("qmk").configuratorUrl,
      getFirmwareConfig("via").configuratorUrl,
      getFirmwareConfig("zmk").configuratorUrl,
    ]);
    expect(urls.size).toBe(3);
  });

  it("has unique display names", () => {
    const names = [
      getFirmwareConfig("qmk").displayName,
      getFirmwareConfig("via").displayName,
      getFirmwareConfig("vial").displayName,
      getFirmwareConfig("zmk").displayName,
    ];
    expect(new Set(names).size).toBe(4);
  });
});
