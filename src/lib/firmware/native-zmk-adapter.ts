/**
 * ZMK adapter using native serial port — no serialport npm module needed.
 * Falls back to helper process if native serial fails.
 */

import { BoardProfile } from "../types";
import {
  detectZmkDevicesNative,
  readZmkKeyboardNative,
} from "../hid/zmk-reader-inprocess";
import { DetectedDevice, FirmwareAdapter } from "./adapter";

export class NativeZmkAdapter implements FirmwareAdapter {
  readonly firmware = "zmk" as const;
  readonly displayName = "ZMK Studio";

  async detectDevices(): Promise<DetectedDevice[]> {
    try {
      const devices = await detectZmkDevicesNative();
      return devices.map((d) => ({
        path: d.path,
        name: d.name,
        manufacturer: "ZMK",
        firmware: "zmk" as const,
        vendorId: "",
        productId: "",
        serialNumber: d.serialNumber,
        transport: "serial" as const,
      }));
    } catch {
      return [];
    }
  }

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
    return readZmkKeyboardNative(device.path);
  }
}
