/**
 * Vial adapter — detects via koffi HID transport, reads via helper fallback.
 * When koffi transport read is fully implemented, the helper fallback goes away.
 */

import { BoardProfile } from "../types";
import { vialHidTransport } from "../transport";
import {
  readVialKeyboard,
  readLockStatus,
  readKeymapHash,
  readMatrixState,
} from "../vial/client";
import { DetectedDevice, FirmwareAdapter } from "./adapter";

export class VialAdapter implements FirmwareAdapter {
  readonly firmware = "qmk" as const;
  readonly displayName = "Vial (QMK)";

  async detectDevices(): Promise<DetectedDevice[]> {
    try {
      // Try koffi HID transport first (in-process, Store-compatible)
      const devices = await vialHidTransport.discover();
      return devices.map((d) => ({
        path: d.path,
        name: d.name,
        manufacturer: d.manufacturer || "Unknown",
        firmware: "qmk" as const,
        vendorId: d.vendorId || "",
        productId: d.productId || "",
        serialNumber: d.serialNumber,
        transport: "hid" as const,
      }));
    } catch {
      // Koffi not available — fall back to helper process
      const { detectVialDevices } = await import("../vial/client");
      const devices = await detectVialDevices();
      return devices.map((d) => ({
        path: d.path,
        name: d.product || "Vial Keyboard",
        manufacturer: d.manufacturer || "Unknown",
        firmware: "qmk" as const,
        vendorId: String(d.vendorId),
        productId: String(d.productId),
        serialNumber: d.serialNumber,
        transport: "hid" as const,
      }));
    }
  }

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
    // Use helper process (fully functional)
    return readVialKeyboard(device.path);
  }

  async getLockStatus() {
    return readLockStatus();
  }

  async getKeymapHash() {
    return readKeymapHash();
  }

  async getMatrixState() {
    return readMatrixState();
  }
}
