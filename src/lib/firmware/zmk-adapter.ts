import { BoardProfile } from "../types";
import {
  detectZmkDevices,
  readZmkKeyboard,
  readZmkLockStatus,
  writeZmkLayerName,
} from "../vial/client";
import { DetectedDevice, FirmwareAdapter } from "./adapter";

export class ZmkAdapter implements FirmwareAdapter {
  readonly firmware = "zmk" as const;
  readonly displayName = "ZMK Studio";

  async detectDevices(): Promise<DetectedDevice[]> {
    const devices = await detectZmkDevices();
    return devices.map((d) => ({
      path: d.path,
      name: d.product || "ZMK Keyboard",
      manufacturer: d.manufacturer || "Unknown",
      firmware: "zmk" as const,
      vendorId: String(d.vendorId),
      productId: String(d.productId),
      serialNumber: d.serialNumber,
      transport: "serial" as const,
    }));
  }

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
    return readZmkKeyboard(device.path);
  }

  async getLockStatus(portPath: string) {
    return readZmkLockStatus(portPath);
  }

  async setLayerName(portPath: string, layerId: number, name: string) {
    return writeZmkLayerName(portPath, layerId, name);
  }
}
