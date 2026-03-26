/**
 * Vial adapter using koffi FFI — runs in-process, no child_process.
 * Store-compatible replacement for the helper-based VialAdapter.
 */

import { BoardProfile } from "../types";
import {
  detectVialDevicesKoffi,
  readVialKeyboardKoffi,
} from "../hid/vial-reader-inprocess";
import { DetectedDevice, FirmwareAdapter } from "./adapter";

export class KoffiVialAdapter implements FirmwareAdapter {
  readonly firmware = "qmk" as const;
  readonly displayName = "Vial (QMK)";

  async detectDevices(): Promise<DetectedDevice[]> {
    try {
      const devices = await detectVialDevicesKoffi();
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
    } catch {
      return [];
    }
  }

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
    return readVialKeyboardKoffi(device.path);
  }
}
