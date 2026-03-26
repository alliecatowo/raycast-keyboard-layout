import {
  registerAdapter,
  detectAllDevicesViaAdapters,
  getAdapters,
} from "./adapter";
import { VialAdapter } from "./vial-adapter";
import { ZmkAdapter } from "./zmk-adapter";

export type { DetectedDevice, FirmwareAdapter } from "./adapter";
export { VialAdapter } from "./vial-adapter";
export { ZmkAdapter } from "./zmk-adapter";

// Register adapters — both use the koffi-based transport layer
registerAdapter(new VialAdapter());
registerAdapter(new ZmkAdapter());

/** Detect all connected keyboards across all firmware types */
export const detectAll = detectAllDevicesViaAdapters;

/** Get all registered adapters */
export { getAdapters };

/** Find the adapter for a given device */
export function getAdapterForDevice(device: { firmware: string }) {
  return getAdapters().find((a) => a.firmware === device.firmware);
}
