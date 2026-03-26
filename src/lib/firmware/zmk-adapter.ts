/**
 * ZMK adapter using serial + BLE transports.
 * Serial: POSIX stty + fs (no native modules)
 * BLE: koffi → SimpleBLE (prebuilt, same pattern as HIDAPI)
 */

import { BoardProfile } from "../types";
import { zmkSerialTransport, zmkBleTransport } from "../transport";
import { DetectedDevice, FirmwareAdapter } from "./adapter";

export class ZmkAdapter implements FirmwareAdapter {
  readonly firmware = "zmk" as const;
  readonly displayName = "ZMK Studio";

  async detectDevices(): Promise<DetectedDevice[]> {
    // Try both USB serial and BLE in parallel
    const [serialDevices, bleDevices] = await Promise.allSettled([
      zmkSerialTransport.discover(),
      zmkBleTransport.discover().catch(() => []),
    ]);

    const devices: DetectedDevice[] = [];

    if (serialDevices.status === "fulfilled") {
      devices.push(
        ...serialDevices.value.map((d) => ({
          path: d.path,
          name: d.name,
          manufacturer: "ZMK",
          firmware: "zmk" as const,
          vendorId: "",
          productId: "",
          transport: "serial" as const,
        })),
      );
    }

    if (bleDevices.status === "fulfilled") {
      devices.push(
        ...bleDevices.value.map((d) => ({
          path: d.path,
          name: d.name,
          manufacturer: "ZMK (BLE)",
          firmware: "zmk" as const,
          vendorId: "",
          productId: "",
          transport: "serial" as const, // TODO: change to "ble" when BLE connect works
        })),
      );
    }

    return devices;
  }

  async readBoard(device: DetectedDevice): Promise<BoardProfile> {
    const conn = zmkSerialTransport.connect({
      ...device,
      transportType: device.transport === "serial" ? "serial" : "ble",
    });
    try {
      // Verify connectivity by sending getDeviceInfo
      conn.sendAndReceive([0x01]); // placeholder — needs protobuf encoding
      throw new Error(
        "Full ZMK board read coming soon. Device detected at: " + device.path,
      );
    } finally {
      conn.close();
    }
  }
}
