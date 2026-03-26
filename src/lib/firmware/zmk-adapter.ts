/**
 * ZMK adapter — uses serial transport for USB, BLE transport for wireless.
 * Probes serial ports for ZMK Studio boards using the protobuf protocol.
 */

import { BoardProfile } from "../types";
import { zmkSerialTransport } from "../transport";
import {
  getDeviceInfo,
  readZmkBoard,
  getLockState,
  setLayerName,
} from "../protocol/zmk-studio";
import { DetectedDevice, FirmwareAdapter } from "./adapter";

export class ZmkAdapter implements FirmwareAdapter {
  readonly firmware = "zmk" as const;
  readonly displayName = "ZMK Studio";

  async detectDevices(): Promise<DetectedDevice[]> {
    const candidates = await zmkSerialTransport.discover();
    const devices: DetectedDevice[] = [];

    for (const candidate of candidates) {
      try {
        const conn = zmkSerialTransport.connect(candidate);
        try {
          const info = getDeviceInfo(conn);
          devices.push({
            path: candidate.path,
            name: info.name,
            manufacturer: "ZMK",
            firmware: "zmk" as const,
            vendorId: "",
            productId: "",
            serialNumber: info.serialNumber,
            transport: "serial" as const,
          });
        } finally {
          conn.close();
        }
      } catch {
        // Not a ZMK Studio board — skip
      }
    }

    return devices;
  }

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
    const conn = zmkSerialTransport.connect({
      ...device,
      transportType: "serial",
    });
    try {
      return readZmkBoard(conn);
    } finally {
      conn.close();
    }
  }

  async getLockStatus(device: DetectedDevice): Promise<boolean> {
    const conn = zmkSerialTransport.connect({
      ...device,
      transportType: "serial",
    });
    try {
      return getLockState(conn);
    } finally {
      conn.close();
    }
  }

  async setLayerName(
    device: DetectedDevice,
    layerId: number,
    name: string,
  ): Promise<void> {
    const conn = zmkSerialTransport.connect({
      ...device,
      transportType: "serial",
    });
    try {
      setLayerName(conn, layerId, name);
    } finally {
      conn.close();
    }
  }
}
