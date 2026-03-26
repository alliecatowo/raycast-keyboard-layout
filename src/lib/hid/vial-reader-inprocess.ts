/**
 * In-process Vial keyboard reader using koffi FFI.
 * Replaces helper/vial-reader.js entirely.
 */

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as nodeCrypto from "crypto";
import { BoardProfile, Layer, PhysicalKey } from "../types";
import { numericKeycodeToString } from "../vial/keycode-map";
import {
  initHid,
  enumerateDevices,
  openDevice,
  closeDevice,
  sendAndReceive,
  HidDeviceInfo,
} from "./koffi-hid";

// ── Constants ────────────────────────────────────────────

const VIAL_SERIAL_MAGIC = "vial:f64c2b3c";
const VIAL_USAGE_PAGE = 0xff60;
const VIAL_USAGE = 0x61;
const PACKET_SIZE = 32;
const BUFFER_FETCH_CHUNK = 28;

const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
const CMD_VIA_GET_LAYER_COUNT = 0x11;
const CMD_VIA_KEYMAP_GET_BUFFER = 0x12;
const CMD_VIA_VIAL_PREFIX = 0xfe;
const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
const CMD_VIAL_GET_SIZE = 0x01;
const CMD_VIAL_GET_DEFINITION = 0x02;

// ── Device Detection ─────────────────────────────────────

export async function detectVialDevicesKoffi(): Promise<HidDeviceInfo[]> {
  await initHid();
  return enumerateDevices().filter(
    (d) =>
      d.serialNumber.includes(VIAL_SERIAL_MAGIC) &&
      d.usagePage === VIAL_USAGE_PAGE &&
      d.usage === VIAL_USAGE,
  );
}

// ── LZMA Decompression ───────────────────────────────────

function lzmaDecompress(compressed: Buffer): string {
  // Use Python's lzma module — handles both LZMA and XZ formats
  const tmpIn = path.join(os.tmpdir(), `vial-lzma-${Date.now()}.bin`);
  const tmpOut = path.join(os.tmpdir(), `vial-lzma-${Date.now()}.json`);

  try {
    fs.writeFileSync(tmpIn, compressed);
    const script = `
import lzma, sys
with open(sys.argv[1], 'rb') as f:
    data = f.read()
try:
    result = lzma.decompress(data, format=lzma.FORMAT_ALONE)
except Exception:
    result = lzma.decompress(data, format=lzma.FORMAT_AUTO)
with open(sys.argv[2], 'wb') as f:
    f.write(result)
`;
    execFileSync("python3", ["-c", script, tmpIn, tmpOut], {
      timeout: 5000,
    });
    return fs.readFileSync(tmpOut, "utf-8");
  } finally {
    try {
      fs.unlinkSync(tmpIn);
    } catch {
      /* */
    }
    try {
      fs.unlinkSync(tmpOut);
    } catch {
      /* */
    }
  }
}

// ── KLE Layout Parser ────────────────────────────────────

interface KleKey {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  rx?: number;
  ry?: number;
  matrix: [number, number];
}

function parseKleLayout(kleData: unknown[]): KleKey[] {
  const keys: KleKey[] = [];
  let currentX = 0;
  let currentY = 0;

  for (const row of kleData) {
    if (!Array.isArray(row)) continue;

    currentX = 0;
    let currentW = 1;
    let currentH = 1;
    let currentR = 0;
    let currentRx = 0;
    let currentRy = 0;

    for (const item of row) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const props = item as Record<string, number>;
        if ("x" in props) currentX += props.x;
        if ("y" in props) currentY += props.y;
        if ("w" in props) currentW = props.w;
        if ("h" in props) currentH = props.h;
        if ("r" in props) {
          currentR = props.r;
          if ("rx" in props) currentRx = props.rx;
          if ("ry" in props) currentRy = props.ry;
          currentX = currentRx;
          currentY = currentRy;
        } else {
          if ("rx" in props) currentRx = props.rx;
          if ("ry" in props) currentRy = props.ry;
        }
      } else if (typeof item === "string") {
        const match = item.match(/^(\d+),(\d+)$/);
        const matrixRow = match ? parseInt(match[1], 10) : -1;
        const matrixCol = match ? parseInt(match[2], 10) : -1;

        if (matrixRow >= 0 && matrixCol >= 0) {
          keys.push({
            x: currentX,
            y: currentY,
            w: currentW,
            h: currentH,
            r: currentR || undefined,
            rx: currentR ? currentRx : undefined,
            ry: currentR ? currentRy : undefined,
            matrix: [matrixRow, matrixCol],
          });
        }

        currentX += currentW;
        currentW = 1;
        currentH = 1;
      }
    }

    currentY += 1;
  }

  return keys;
}

// ── Full Board Read ──────────────────────────────────────

export async function readVialKeyboardKoffi(
  devicePath?: string,
): Promise<BoardProfile> {
  await initHid();

  let device: unknown;
  let path_used: string;

  if (devicePath) {
    device = openDevice(devicePath);
    path_used = devicePath;
  } else {
    const devices = await detectVialDevicesKoffi();
    if (devices.length === 0) {
      throw new Error("No Vial keyboard detected");
    }
    device = openDevice(devices[0].path);
    path_used = devices[0].path;
  }

  try {
    // Get Vial keyboard ID
    sendAndReceive(device, [CMD_VIA_GET_PROTOCOL_VERSION]); // verify connectivity

    const vialResp = sendAndReceive(device, [
      CMD_VIA_VIAL_PREFIX,
      CMD_VIAL_GET_KEYBOARD_ID,
    ]);
    const uid = vialResp.subarray(4, 12).toString("hex");

    // Read keyboard definition (compressed)
    const sizeResp = sendAndReceive(device, [
      CMD_VIA_VIAL_PREFIX,
      CMD_VIAL_GET_SIZE,
    ]);
    const defSize =
      sizeResp[0] |
      (sizeResp[1] << 8) |
      (sizeResp[2] << 16) |
      (sizeResp[3] << 24);

    const blocks = Math.ceil(defSize / PACKET_SIZE);
    const compressed = Buffer.alloc(blocks * PACKET_SIZE);
    for (let i = 0; i < blocks; i++) {
      const block = sendAndReceive(device, [
        CMD_VIA_VIAL_PREFIX,
        CMD_VIAL_GET_DEFINITION,
        i & 0xff,
        (i >> 8) & 0xff,
      ]);
      block.copy(compressed, i * PACKET_SIZE);
    }

    const jsonStr = lzmaDecompress(compressed.subarray(0, defSize));
    const definition = JSON.parse(jsonStr);

    const rows = definition.matrix?.rows || 0;
    const cols = definition.matrix?.cols || 0;
    if (!rows || !cols) throw new Error("Invalid matrix dimensions");

    // Read layer count and keymap
    const layerResp = sendAndReceive(device, [CMD_VIA_GET_LAYER_COUNT]);
    const layerCount = layerResp[1];

    const totalBytes = layerCount * rows * cols * 2;
    const keymapBuffer = Buffer.alloc(totalBytes);
    for (let offset = 0; offset < totalBytes; offset += BUFFER_FETCH_CHUNK) {
      const chunkSize = Math.min(BUFFER_FETCH_CHUNK, totalBytes - offset);
      const resp = sendAndReceive(device, [
        CMD_VIA_KEYMAP_GET_BUFFER,
        (offset >> 8) & 0xff,
        offset & 0xff,
        chunkSize,
      ]);
      resp.copy(keymapBuffer, offset, 4, 4 + chunkSize);
    }

    // Parse raw keymap into layers of numeric keycodes
    const rawLayers: number[][] = [];
    for (let layer = 0; layer < layerCount; layer++) {
      const layerKeycodes: number[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = (layer * rows * cols + row * cols + col) * 2;
          const keycode = (keymapBuffer[idx] << 8) | keymapBuffer[idx + 1];
          layerKeycodes.push(keycode);
        }
      }
      rawLayers.push(layerKeycodes);
    }

    // Parse physical layout from KLE
    const kleLayout = definition.layouts?.keymap || [];
    const physicalKeys = parseKleLayout(kleLayout);

    // Reorder keycodes to match physical key order
    const layers: Layer[] = [];
    for (let layer = 0; layer < layerCount; layer++) {
      const orderedKeycodes: string[] = [];
      for (const pk of physicalKeys) {
        const [mr, mc] = pk.matrix;
        const matrixIndex = mr * cols + mc;
        orderedKeycodes.push(
          numericKeycodeToString(rawLayers[layer][matrixIndex]),
        );
      }
      layers.push({
        index: layer,
        name: layer === 0 ? "Base" : `Layer ${layer}`,
        keycodes: orderedKeycodes,
      });
    }

    const physicalLayout: PhysicalKey[] = physicalKeys.map((k) => ({
      x: k.x,
      y: k.y,
      w: k.w,
      h: k.h,
      r: k.r,
      rx: k.rx,
      ry: k.ry,
    }));

    const now = new Date().toISOString();

    return {
      id: nodeCrypto.randomUUID(),
      name: definition.name || "Vial Keyboard",
      keyboard: `vial:${uid}`,
      layoutKey: "vial_usb",
      firmware: "qmk",
      layers,
      physicalLayout,
      devicePath: path_used,
      createdAt: now,
      updatedAt: now,
    };
  } finally {
    closeDevice(device);
  }
}
