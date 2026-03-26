import { FirmwareType } from "../types";

/**
 * Centralized firmware configuration.
 * Instead of scattered `board.firmware === "zmk"` checks,
 * query capabilities and display info from here.
 */

interface FirmwareConfig {
  /** Display name shown in UI */
  displayName: string;
  /** URL to open the companion configurator */
  configuratorUrl: string;
  /** Label for the "Open configurator" action */
  configuratorLabel: string;
  /** Whether this firmware supports USB settings (QMK Settings / QSIDs) */
  hasUsbSettings: boolean;
  /** Whether this firmware supports RGB over USB */
  hasRgbControl: boolean;
  /** Whether this firmware supports reading keymap over USB */
  hasUsbKeymap: boolean;
  /** Whether this firmware supports lock/unlock */
  hasLockDetection: boolean;
  /** Whether this firmware supports matrix state reading */
  hasMatrixState: boolean;
  /** Whether layer names can be written back to the board */
  hasWritableLayerNames: boolean;
  /** Whether this firmware supports encoders */
  hasEncoders: boolean;
  /** Whether this firmware supports tap-dance config */
  hasTapDance: boolean;
  /** Whether this firmware supports combo config */
  hasCombos: boolean;
  /** Whether this firmware supports key overrides */
  hasKeyOverrides: boolean;
}

const FIRMWARE_CONFIGS: Record<FirmwareType, FirmwareConfig> = {
  vial: {
    displayName: "Vial",
    configuratorUrl: "https://vial.rocks",
    configuratorLabel: "Open Vial Web",
    hasUsbSettings: true,
    hasRgbControl: true,
    hasUsbKeymap: true,
    hasLockDetection: true,
    hasMatrixState: true,
    hasWritableLayerNames: false,
    hasEncoders: true,
    hasTapDance: true,
    hasCombos: true,
    hasKeyOverrides: true,
  },
  via: {
    displayName: "VIA",
    configuratorUrl: "https://usevia.app",
    configuratorLabel: "Open VIA Web",
    hasUsbSettings: false,
    hasRgbControl: true,
    hasUsbKeymap: true,
    hasLockDetection: false,
    hasMatrixState: false,
    hasWritableLayerNames: false,
    hasEncoders: true,
    hasTapDance: false,
    hasCombos: false,
    hasKeyOverrides: false,
  },
  qmk: {
    displayName: "QMK (Vial)",
    configuratorUrl: "https://vial.rocks",
    configuratorLabel: "Open Vial Web",
    hasUsbSettings: true,
    hasRgbControl: true,
    hasUsbKeymap: true,
    hasLockDetection: true,
    hasMatrixState: true,
    hasWritableLayerNames: false,
    hasEncoders: true,
    hasTapDance: true,
    hasCombos: true,
    hasKeyOverrides: true,
  },
  zmk: {
    displayName: "ZMK Studio",
    configuratorUrl: "https://zmk.studio",
    configuratorLabel: "Open ZMK Studio",
    hasUsbSettings: false,
    hasRgbControl: false,
    hasUsbKeymap: true,
    hasLockDetection: true,
    hasMatrixState: false,
    hasWritableLayerNames: true,
    hasEncoders: false,
    hasTapDance: false,
    hasCombos: false,
    hasKeyOverrides: false,
  },
};

/** Get the firmware configuration for a board */
export function getFirmwareConfig(firmware: FirmwareType): FirmwareConfig {
  return FIRMWARE_CONFIGS[firmware] ?? FIRMWARE_CONFIGS.qmk;
}
