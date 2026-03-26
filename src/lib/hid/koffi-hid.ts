/**
 * HIDAPI bindings via koffi FFI.
 *
 * Replaces node-hid by calling libhidapi directly through koffi.
 * This works inside Raycast's extension environment (no child_process needed)
 * and is Store-compatible.
 *
 * HIDAPI C API: https://github.com/libusb/hidapi
 */

import * as path from "path";
import * as os from "os";
import { environment } from "@raycast/api";

// Lazy-loaded koffi instance
let koffiLib: typeof import("koffi") | null = null;
let hidapiLib: ReturnType<typeof import("koffi").load> | null = null;

// HIDAPI function signatures
let hid_init: (() => number) | null = null;
let hid_exit: (() => number) | null = null;
let hid_enumerate: ((vendorId: number, productId: number) => unknown) | null =
  null;
let hid_free_enumeration: ((devs: unknown) => void) | null = null;
let hid_open_path: ((path: string) => unknown) | null = null;
let hid_close: ((device: unknown) => void) | null = null;
let hid_write:
  | ((device: unknown, data: Buffer, length: number) => number)
  | null = null;
let hid_read_timeout:
  | ((
      device: unknown,
      data: Buffer,
      length: number,
      milliseconds: number,
    ) => number)
  | null = null;

/**
 * Initialize koffi and load HIDAPI.
 * Call once before any HID operations.
 */
export async function initHid(): Promise<void> {
  if (hid_init) return; // Already initialized

  // Load koffi from our bundled native binary
  const arch = os.arch(); // arm64 or x64
  const platform = os.platform(); // darwin or win32

  // Load koffi dynamically — esbuild must NOT try to bundle this
  // Using indirect require to prevent static analysis

  const dynamicRequire = eval("require") as NodeRequire;

  try {
    koffiLib = dynamicRequire("koffi");
  } catch {
    throw new Error(`Failed to load koffi for ${platform}_${arch}`);
  }

  if (!koffiLib) throw new Error("Failed to load koffi");

  // Load HIDAPI dylib
  const hidapiPath =
    platform === "darwin"
      ? path.join(environment.assetsPath, "native", "hidapi", "libhidapi.dylib")
      : path.join(environment.assetsPath, "native", "hidapi", "hidapi.dll");

  hidapiLib = koffiLib.load(hidapiPath);

  // Define the hid_device_info struct
  const hid_device_info = koffiLib.struct("hid_device_info", {
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
    next: "void *", // self-referential pointer to next device
  });

  // Bind HIDAPI functions
  hid_init = hidapiLib.func("int hid_init()");
  hid_exit = hidapiLib.func("int hid_exit()");
  hid_enumerate = hidapiLib.func(
    `${koffiLib.pointer(hid_device_info)} hid_enumerate(unsigned short vendor_id, unsigned short product_id)`,
  );
  hid_free_enumeration = hidapiLib.func(
    `void hid_free_enumeration(${koffiLib.pointer(hid_device_info)} devs)`,
  );
  hid_open_path = hidapiLib.func("void* hid_open_path(const char *path)");
  hid_close = hidapiLib.func("void hid_close(void *dev)");
  hid_write = hidapiLib.func(
    "int hid_write(void *dev, const unsigned char *data, int length)",
  );
  hid_read_timeout = hidapiLib.func(
    "int hid_read_timeout(void *dev, unsigned char *data, int length, int milliseconds)",
  );

  // Initialize HIDAPI
  const result = hid_init();
  if (result !== 0) throw new Error("hid_init failed");
}

/** Clean up HIDAPI resources */
export function cleanupHid(): void {
  if (hid_exit) hid_exit();
}

export interface HidDeviceInfo {
  path: string;
  vendorId: number;
  productId: number;
  serialNumber: string;
  manufacturer: string;
  product: string;
  usagePage: number;
  usage: number;
}

/** Enumerate all HID devices, optionally filtered by VID/PID */
export function enumerateDevices(vendorId = 0, productId = 0): HidDeviceInfo[] {
  if (!hid_enumerate || !hid_free_enumeration) {
    throw new Error("HID not initialized");
  }

  const devs = hid_enumerate(vendorId, productId);
  if (!devs) return [];

  const devices: HidDeviceInfo[] = [];
  let current = devs as Record<string, unknown>;

  while (current) {
    devices.push({
      path: String(current.path || ""),
      vendorId: Number(current.vendor_id || 0),
      productId: Number(current.product_id || 0),
      serialNumber: String(current.serial_number || ""),
      manufacturer: String(current.manufacturer_string || ""),
      product: String(current.product_string || ""),
      usagePage: Number(current.usage_page || 0),
      usage: Number(current.usage || 0),
    });
    current = current.next as Record<string, unknown>;
  }

  hid_free_enumeration(devs);
  return devices;
}

/** Open a HID device by path */
export function openDevice(devicePath: string): unknown {
  if (!hid_open_path) throw new Error("HID not initialized");
  const device = hid_open_path(devicePath);
  if (!device) throw new Error(`Failed to open HID device: ${devicePath}`);
  return device;
}

/** Close a HID device */
export function closeDevice(device: unknown): void {
  if (hid_close) hid_close(device);
}

/** Send data to a HID device and read the response */
export function sendAndReceive(
  device: unknown,
  data: number[],
  timeout = 1000,
): Buffer {
  if (!hid_write || !hid_read_timeout) {
    throw new Error("HID not initialized");
  }

  // Prepare write buffer (33 bytes: report ID 0x00 + 32 bytes data)
  const writeBuf = Buffer.alloc(33, 0);
  writeBuf[0] = 0x00; // Report ID
  for (let i = 0; i < data.length && i < 32; i++) {
    writeBuf[i + 1] = data[i];
  }

  const written = hid_write(device, writeBuf, 33);
  if (written < 0) throw new Error("HID write failed");

  // Read response (32 bytes)
  const readBuf = Buffer.alloc(32);
  const bytesRead = hid_read_timeout(device, readBuf, 32, timeout);
  if (bytesRead < 0) throw new Error("HID read failed");
  if (bytesRead === 0) throw new Error("HID read timeout");

  return readBuf;
}
