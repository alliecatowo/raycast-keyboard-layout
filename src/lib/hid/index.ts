/**
 * Unified HID client — exports all USB communication functions.
 * Uses koffi FFI when available, falls back to helper process.
 */

export {
  detectVialDevicesKoffi as detectVialDevices,
  readVialKeyboardKoffi as readVialKeyboard,
} from "./vial-reader-inprocess";

export { initHid, cleanupHid, enumerateDevices } from "./koffi-hid";

export {
  findVialDevices,
  getViaProtocolVersion,
  getVialKeyboardId,
  getLayerCount,
  readKeymapBuffer,
  readMatrixStateRaw,
  getLockStatus,
  querySupportedQsids,
  getQmkSetting,
  setQmkSetting,
} from "./vial-protocol";
