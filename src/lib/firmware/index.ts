import {
  registerAdapter,
  detectAllDevicesViaAdapters,
  getAdapters,
} from "./adapter";
import { KoffiVialAdapter } from "./koffi-vial-adapter";
import { NativeZmkAdapter } from "./native-zmk-adapter";

export type { DetectedDevice, FirmwareAdapter } from "./adapter";
export { KoffiVialAdapter } from "./koffi-vial-adapter";
export { NativeZmkAdapter } from "./native-zmk-adapter";

// Register all adapters — in-process, no child_process needed
registerAdapter(new KoffiVialAdapter());
registerAdapter(new NativeZmkAdapter());

/** Detect all connected keyboards across all firmware types */
export const detectAll = detectAllDevicesViaAdapters;

/** Get all registered adapters */
export { getAdapters };

/** Find the adapter for a given device */
export function getAdapterForDevice(device: { firmware: string }) {
  return getAdapters().find((a) => a.firmware === device.firmware);
}
