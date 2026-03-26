import { BoardProfile } from "../types";
import {
  detectVialDevices,
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

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
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
