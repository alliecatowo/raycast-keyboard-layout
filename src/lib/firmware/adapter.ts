import { BoardProfile, FirmwareType } from "../types";

/**
 * Firmware adapter interface — polymorphic handling of QMK/Vial/ZMK boards.
 *
 * Each firmware type implements this interface for detection, reading,
 * and (eventually) writing keymaps. The detect-board command queries
 * all adapters in parallel.
 */

export interface DetectedDevice {
  path: string;
  name: string;
  manufacturer: string;
  firmware: FirmwareType;
  vendorId: string;
  productId: string;
  serialNumber?: string;
  transport: "hid" | "serial" | "file";
}

export interface FirmwareAdapter {
  /** Firmware type this adapter handles */
  readonly firmware: FirmwareType;

  /** Human-readable name for this adapter */
  readonly displayName: string;

  /** Detect connected devices of this firmware type */
  detectDevices(): Promise<DetectedDevice[]>;

  /** Read the full board profile from a detected device */
  readBoard(device: DetectedDevice): Promise<BoardProfile>;
}

/**
 * Registry of all firmware adapters.
 * New adapters can be registered here.
 */
const adapters: FirmwareAdapter[] = [];

export function registerAdapter(adapter: FirmwareAdapter): void {
  adapters.push(adapter);
}

export function getAdapters(): FirmwareAdapter[] {
  return [...adapters];
}

/** Detect all devices across all registered firmware adapters */
export async function detectAllDevicesViaAdapters(): Promise<DetectedDevice[]> {
  const results = await Promise.allSettled(
    adapters.map((a) => a.detectDevices()),
  );

  const devices: DetectedDevice[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      devices.push(...result.value);
    }
  }
  return devices;
}
