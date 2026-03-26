/**
 * Transport abstraction — unified interface for USB HID, Serial, and BLE.
 *
 * All three use koffi FFI to call C libraries:
 *   - HIDAPI (libhidapi) for USB HID
 *   - libc/POSIX (libSystem) for USB Serial
 *   - SimpleBLE (libsimplecble) for Bluetooth LE
 */

/** A discovered device that can be opened */
export interface DiscoveredDevice {
  path: string;
  name: string;
  transportType: "hid" | "serial" | "ble";
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  manufacturer?: string;
}

/** An open connection to a device */
export interface TransportConnection {
  /** Send data and receive response (synchronous request/response) */
  sendAndReceive(data: number[], timeout?: number): Buffer;

  /** Close the connection */
  close(): void;

  /** The device this connection is for */
  device: DiscoveredDevice;
}

/** A transport implementation (HID, Serial, or BLE) */
export interface Transport {
  /** Human-readable name */
  readonly name: string;

  /** Discover devices available on this transport */
  discover(): Promise<DiscoveredDevice[]>;

  /** Open a connection to a device */
  connect(device: DiscoveredDevice): TransportConnection;
}
