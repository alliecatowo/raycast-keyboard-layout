/**
 * Bluetooth LE transport via koffi → SimpleBLE C library.
 * Used by ZMK Studio keyboards over Bluetooth.
 *
 * SimpleBLE provides a cross-platform C API for BLE:
 * - macOS: CoreBluetooth
 * - Windows: WinRT
 * - Linux: BlueZ
 *
 * ZMK Studio GATT:
 * - Service:        00000000-0196-6107-c967-c5cfb1c2482a
 * - Characteristic: 00000001-0196-6107-c967-c5cfb1c2482a
 */

import { loadNativeLib } from "./koffi-loader";
import { DiscoveredDevice, Transport, TransportConnection } from "./types";

const ZMK_SERVICE_UUID = "00000000-0196-6107-c967-c5cfb1c2482a";
// ZMK_CHAR_UUID and framing constants will be used when BLE connect is implemented
// const ZMK_CHAR_UUID = "00000001-0196-6107-c967-c5cfb1c2482a";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: Record<string, any> = {};
let initialized = false;

function init() {
  if (initialized) return;

  try {
    lib = loadNativeLib("simpleble", "libsimplecble.dylib");
  } catch {
    throw new Error("SimpleBLE not available — BLE transport disabled");
  }

  api.adapter_is_enabled = lib.func(
    "bool simpleble_adapter_is_bluetooth_enabled()",
  );
  api.adapter_get_count = lib.func("size_t simpleble_adapter_get_count()");
  api.adapter_get_handle = lib.func(
    "void* simpleble_adapter_get_handle(size_t)",
  );
  api.adapter_release = lib.func(
    "void simpleble_adapter_release_handle(void*)",
  );
  api.adapter_scan_start = lib.func("int simpleble_adapter_scan_start(void*)");
  api.adapter_scan_stop = lib.func("int simpleble_adapter_scan_stop(void*)");
  api.adapter_scan_is_active = lib.func(
    "bool simpleble_adapter_scan_is_active(void*)",
  );
  api.adapter_get_results_count = lib.func(
    "size_t simpleble_adapter_scan_get_results_count(void*)",
  );
  api.adapter_get_results_handle = lib.func(
    "void* simpleble_adapter_scan_get_results_handle(void*, size_t)",
  );

  api.peripheral_identifier = lib.func(
    "char* simpleble_peripheral_identifier(void*)",
  );
  api.peripheral_address = lib.func(
    "char* simpleble_peripheral_address(void*)",
  );
  api.peripheral_release = lib.func(
    "void simpleble_peripheral_release_handle(void*)",
  );
  api.peripheral_connect = lib.func("int simpleble_peripheral_connect(void*)");
  api.peripheral_disconnect = lib.func(
    "int simpleble_peripheral_disconnect(void*)",
  );
  api.peripheral_services_count = lib.func(
    "size_t simpleble_peripheral_services_count(void*)",
  );
  api.peripheral_write_request = lib.func(
    "int simpleble_peripheral_write_request(void*, const char*, const char*, const unsigned char*, size_t)",
  );
  api.peripheral_indicate = lib.func(
    "int simpleble_peripheral_indicate(void*, const char*, const char*, void*, void*)",
  );
  api.peripheral_unsubscribe = lib.func(
    "int simpleble_peripheral_unsubscribe(void*, const char*, const char*)",
  );

  initialized = true;
}

export class BleTransport implements Transport {
  readonly name = "Bluetooth LE";
  // serviceUuid will be used when BLE connect is implemented

  private svcUuid: string;

  constructor(serviceUuid = ZMK_SERVICE_UUID) {
    this.svcUuid = serviceUuid;
  }

  async discover(): Promise<DiscoveredDevice[]> {
    try {
      init();
    } catch {
      return []; // SimpleBLE not available
    }

    if (!api.adapter_is_enabled()) return [];

    const adapterCount = api.adapter_get_count();
    if (adapterCount === 0) return [];

    const adapter = api.adapter_get_handle(0);
    if (!adapter) return [];

    try {
      // Scan for 3 seconds
      api.adapter_scan_start(adapter);
      await new Promise((r) => setTimeout(r, 3000));
      api.adapter_scan_stop(adapter);

      const count = api.adapter_get_results_count(adapter);
      const devices: DiscoveredDevice[] = [];

      for (let i = 0; i < count; i++) {
        const peripheral = api.adapter_get_results_handle(adapter, i);
        if (!peripheral) continue;

        try {
          const name = api.peripheral_identifier(peripheral);
          const address = api.peripheral_address(peripheral);

          // TODO: Filter by service UUID after connecting
          // SimpleBLE's scan results may not include service UUIDs
          // without connecting first. For now, return all BLE devices.
          devices.push({
            path: String(address || ""),
            name: String(name || "BLE Device"),
            transportType: "ble",
          });
        } finally {
          api.peripheral_release(peripheral);
        }
      }

      return devices;
    } finally {
      api.adapter_release(adapter);
    }
  }

  connect(device: DiscoveredDevice): TransportConnection {
    init();

    // Connect to peripheral — for now using SimpleBLE's synchronous API
    // Full GATT indication support needs async handling
    const adapter = api.adapter_get_handle(0);
    if (!adapter) throw new Error("No Bluetooth adapter available");

    // Re-scan to find the device by address
    api.adapter_scan_start(adapter);
    // Brief scan
    const waitUntil = Date.now() + 2000;
    while (Date.now() < waitUntil) {
      /* scan */
    }
    api.adapter_scan_stop(adapter);

    const count = api.adapter_get_results_count(adapter);
    let peripheral = null;

    for (let i = 0; i < count; i++) {
      const p = api.adapter_get_results_handle(adapter, i);
      if (!p) continue;
      const addr = String(api.peripheral_address(p) || "");
      if (addr === device.path) {
        peripheral = p;
        break;
      }
      api.peripheral_release(p);
    }

    if (!peripheral) {
      api.adapter_release(adapter);
      throw new Error(`BLE device not found: ${device.path}`);
    }

    // Connect
    const connectResult = api.peripheral_connect(peripheral);
    if (connectResult !== 0) {
      api.peripheral_release(peripheral);
      api.adapter_release(adapter);
      throw new Error("BLE connect failed");
    }

    const svcUuid = this.svcUuid;

    return {
      device,
      sendAndReceive(data: number[]): Buffer {
        // Write to the RPC characteristic
        const charUuid = "00000001-0196-6107-c967-c5cfb1c2482a";
        const writeBuf = Buffer.from(data);
        api.peripheral_write_request(
          peripheral,
          svcUuid,
          charUuid,
          writeBuf,
          writeBuf.length,
        );

        // TODO: Read indication response
        // SimpleBLE's indicate callback is async/callback-based
        // For synchronous sendAndReceive, we'd need to block on the callback
        // This is the hard part of BLE — indication responses are async
        throw new Error(
          "BLE indication read not yet implemented — needs async callback bridge",
        );
      },
      close() {
        api.peripheral_disconnect(peripheral);
        api.peripheral_release(peripheral);
        api.adapter_release(adapter);
      },
    };
  }
}

/** Pre-configured BLE transport for ZMK Studio */
export const zmkBleTransport = new BleTransport(ZMK_SERVICE_UUID);
