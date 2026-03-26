/**
 * Transport layer — unified USB HID, Serial, and BLE via koffi FFI.
 *
 * All transports use the same pattern:
 *   transport.discover() → DiscoveredDevice[]
 *   transport.connect(device) → TransportConnection
 *   connection.sendAndReceive(data) → Buffer
 *   connection.close()
 */

export type { DiscoveredDevice, Transport, TransportConnection } from "./types";

export { HidTransport, vialHidTransport } from "./hid-transport";
export { SerialTransport, zmkSerialTransport } from "./serial-transport";
export { BleTransport, zmkBleTransport } from "./ble-transport";
