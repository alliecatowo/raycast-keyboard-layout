/**
 * USB HID transport via koffi → HIDAPI.
 * Used by Vial/VIA keyboards.
 */

import { getKoffi, loadNativeLib } from "./koffi-loader";
import { DiscoveredDevice, Transport, TransportConnection } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: Record<string, any> = {};
let initialized = false;

function init() {
  if (initialized) return;
  const k = getKoffi();
  lib = loadNativeLib("hidapi", "libhidapi.dylib");

  k.struct("hid_device_info", {
    path: "char *",
    vendor_id: "unsigned short",
    product_id: "unsigned short",
    serial_number: "char16_t *",
    release_number: "unsigned short",
    manufacturer_string: "char16_t *",
    product_string: "char16_t *",
    usage_page: "unsigned short",
    usage: "unsigned short",
    interface_number: "int",
    next: "void *",
  });

  api.hid_init = lib.func("int hid_init()");
  api.hid_exit = lib.func("int hid_exit()");
  api.hid_enumerate = lib.func(
    "void* hid_enumerate(unsigned short, unsigned short)",
  );
  api.hid_free_enumeration = lib.func("void hid_free_enumeration(void*)");
  api.hid_open_path = lib.func("void* hid_open_path(const char*)");
  api.hid_close = lib.func("void hid_close(void*)");
  api.hid_write = lib.func("int hid_write(void*, const unsigned char*, int)");
  api.hid_read_timeout = lib.func(
    "int hid_read_timeout(void*, unsigned char*, int, int)",
  );

  api.hid_init();
  initialized = true;
}

export class HidTransport implements Transport {
  readonly name = "USB HID";

  private filterUsagePage?: number;
  private filterUsage?: number;
  private filterSerial?: string;

  constructor(options?: {
    usagePage?: number;
    usage?: number;
    serialFilter?: string;
  }) {
    this.filterUsagePage = options?.usagePage;
    this.filterUsage = options?.usage;
    this.filterSerial = options?.serialFilter;
  }

  async discover(): Promise<DiscoveredDevice[]> {
    init();
    const k = getKoffi();
    const devs = api.hid_enumerate(0, 0);
    if (!devs) return [];

    const devices: DiscoveredDevice[] = [];
    let current = devs;

    while (current) {
      const info = k.decode(current, "hid_device_info");

      const usagePage = info.usage_page;
      const usage = info.usage;
      const serial = String(info.serial_number || "");

      const matches =
        (!this.filterUsagePage || usagePage === this.filterUsagePage) &&
        (!this.filterUsage || usage === this.filterUsage) &&
        (!this.filterSerial || serial.includes(this.filterSerial));

      if (matches) {
        devices.push({
          path: String(info.path || ""),
          name: String(info.product_string || "HID Device"),
          transportType: "hid",
          vendorId: String(info.vendor_id),
          productId: String(info.product_id),
          serialNumber: serial,
          manufacturer: String(info.manufacturer_string || ""),
        });
      }

      current = info.next;
    }

    api.hid_free_enumeration(devs);
    return devices;
  }

  connect(device: DiscoveredDevice): TransportConnection {
    init();
    const handle = api.hid_open_path(device.path);
    if (!handle) throw new Error(`Failed to open HID device: ${device.path}`);

    return {
      device,
      sendAndReceive(data: number[], timeout = 1000): Buffer {
        const writeBuf = Buffer.alloc(33, 0);
        writeBuf[0] = 0x00; // Report ID
        for (let i = 0; i < data.length && i < 32; i++) {
          writeBuf[i + 1] = data[i];
        }
        const written = api.hid_write(handle, writeBuf, 33);
        if (written < 0) throw new Error("HID write failed");

        const readBuf = Buffer.alloc(32);
        const bytesRead = api.hid_read_timeout(handle, readBuf, 32, timeout);
        if (bytesRead < 0) throw new Error("HID read failed");
        if (bytesRead === 0) throw new Error("HID read timeout");
        return readBuf;
      },
      close() {
        api.hid_close(handle);
      },
    };
  }
}

/** Pre-configured HID transport for Vial keyboards */
export const vialHidTransport = new HidTransport({
  usagePage: 0xff60,
  usage: 0x61,
  serialFilter: "vial:f64c2b3c",
});
