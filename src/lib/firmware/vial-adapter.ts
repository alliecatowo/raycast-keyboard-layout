/**
 * Vial adapter — full in-process implementation via koffi HID transport.
 */

import { BoardProfile } from "../types";
import { vialHidTransport } from "../transport";
import { readVialBoard } from "../protocol/vial";
import { DetectedDevice, FirmwareAdapter } from "./adapter";

export class VialAdapter implements FirmwareAdapter {
  readonly firmware = "qmk" as const;
  readonly displayName = "Vial (QMK)";

  async detectDevices(): Promise<DetectedDevice[]> {
    try {
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
      return [];
    }
  }

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
    const conn = vialHidTransport.connect({
      ...device,
      transportType: "hid",
    });
    try {
      return readVialBoard(conn);
    } finally {
      conn.close();
    }
  }
}
