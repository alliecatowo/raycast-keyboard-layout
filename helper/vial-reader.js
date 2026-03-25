#!/usr/bin/env node

/**
 * Vial USB HID RAW Reader
 *
 * Standalone helper process that communicates with Vial-enabled keyboards
 * over USB HID RAW protocol. Outputs JSON to stdout.
 *
 * Usage:
 *   node vial-reader.js detect     — List connected Vial devices
 *   node vial-reader.js read       — Read full keymap from first detected device
 *   node vial-reader.js read <path> — Read keymap from specific HID device path
 */

const HID = require("node-hid");
const LZMA = require("lzma");

// ── Constants ────────────────────────────────────────────

const VIAL_SERIAL_MAGIC = "vial:f64c2b3c";
const VIAL_USAGE_PAGE = 0xff60;
const VIAL_USAGE = 0x61;
const PACKET_SIZE = 32;
const BUFFER_FETCH_CHUNK = 28;
const READ_TIMEOUT_MS = 1000;

// VIA commands
const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
const CMD_VIA_GET_KEYCODE = 0x04;
const CMD_VIA_GET_LAYER_COUNT = 0x11;
const CMD_VIA_KEYMAP_GET_BUFFER = 0x12;

// Vial commands (prefixed with 0xFE)
const CMD_VIA_VIAL_PREFIX = 0xfe;
const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
const CMD_VIAL_GET_SIZE = 0x01;
const CMD_VIAL_GET_DEFINITION = 0x02;

// ── HID Communication ────────────────────────────────────

function createPacket(...bytes) {
  const packet = Buffer.alloc(PACKET_SIZE + 1, 0); // +1 for report ID
  packet[0] = 0x00; // Report ID
  for (let i = 0; i < bytes.length && i < PACKET_SIZE; i++) {
    packet[i + 1] = bytes[i];
  }
  return packet;
}

function sendAndReceive(device, ...bytes) {
  const packet = createPacket(...bytes);
  device.write(Array.from(packet));

  // Synchronous read with timeout
  const response = device.readTimeout(READ_TIMEOUT_MS);
  if (!response || response.length === 0) {
    throw new Error("No response from keyboard (timeout)");
  }
  return Buffer.from(response);
}

// ── Device Detection ─────────────────────────────────────

function findVialDevices() {
  const allDevices = HID.devices();
  return allDevices.filter(
    (d) =>
      d.serialNumber &&
      d.serialNumber.includes(VIAL_SERIAL_MAGIC) &&
      d.usagePage === VIAL_USAGE_PAGE &&
      d.usage === VIAL_USAGE
  );
}

// ── Protocol Commands ────────────────────────────────────

function getViaProtocolVersion(device) {
  const resp = sendAndReceive(device, CMD_VIA_GET_PROTOCOL_VERSION);
  return (resp[1] << 8) | resp[2];
}

function getVialKeyboardId(device) {
  const resp = sendAndReceive(
    device,
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_KEYBOARD_ID
  );
  const vialProtocol =
    resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24);
  const uid = resp.slice(4, 12);
  return { vialProtocol, uid: uid.toString("hex") };
}

function getDefinitionSize(device) {
  const resp = sendAndReceive(
    device,
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_SIZE
  );
  return resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24);
}

function getDefinitionBlock(device, blockIndex) {
  const resp = sendAndReceive(
    device,
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_DEFINITION,
    blockIndex & 0xff,
    (blockIndex >> 8) & 0xff
  );
  return resp;
}

function getLayerCount(device) {
  const resp = sendAndReceive(device, CMD_VIA_GET_LAYER_COUNT);
  return resp[1];
}

function getKeymapBuffer(device, offset, size) {
  const resp = sendAndReceive(
    device,
    CMD_VIA_KEYMAP_GET_BUFFER,
    (offset >> 8) & 0xff, // offset high byte
    offset & 0xff, // offset low byte
    size
  );
  // Keycode data starts at byte 4
  return resp.slice(4, 4 + size);
}

// ── High-Level Operations ────────────────────────────────

function readDefinition(device) {
  const size = getDefinitionSize(device);
  const blocks = Math.ceil(size / PACKET_SIZE);
  const compressed = Buffer.alloc(blocks * PACKET_SIZE);

  for (let i = 0; i < blocks; i++) {
    const block = getDefinitionBlock(device, i);
    block.copy(compressed, i * PACKET_SIZE);
  }

  // Trim to actual size
  const trimmed = compressed.slice(0, size);

  // Decompress LZMA
  const decompressed = LZMA.decompress(Array.from(trimmed));
  const jsonStr =
    typeof decompressed === "string"
      ? decompressed
      : Buffer.from(decompressed).toString("utf-8");

  return JSON.parse(jsonStr);
}

function readKeymap(device, layers, rows, cols) {
  const totalBytes = layers * rows * cols * 2;
  const keymapBuffer = Buffer.alloc(totalBytes);

  for (let offset = 0; offset < totalBytes; offset += BUFFER_FETCH_CHUNK) {
    const chunkSize = Math.min(BUFFER_FETCH_CHUNK, totalBytes - offset);
    const chunk = getKeymapBuffer(device, offset, chunkSize);
    chunk.copy(keymapBuffer, offset);
  }

  // Parse into layers of keycodes
  const result = [];
  for (let layer = 0; layer < layers; layer++) {
    const layerKeycodes = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = (layer * rows * cols + row * cols + col) * 2;
        const keycode = (keymapBuffer[idx] << 8) | keymapBuffer[idx + 1];
        layerKeycodes.push(keycode);
      }
    }
    result.push(layerKeycodes);
  }

  return result;
}

/**
 * Parse the KLE-format layout from the Vial definition to extract
 * physical key positions and their matrix addresses (row, col).
 */
function parseKleLayout(kleData) {
  const keys = [];
  let currentX = 0;
  let currentY = 0;

  for (const row of kleData) {
    if (!Array.isArray(row)) continue; // skip metadata objects

    currentX = 0;
    let currentW = 1;
    let currentH = 1;
    let currentR = 0;
    let currentRx = 0;
    let currentRy = 0;

    for (const item of row) {
      if (typeof item === "object" && item !== null) {
        // Property object — modifies subsequent keys
        if ("x" in item) currentX += item.x;
        if ("y" in item) currentY += item.y;
        if ("w" in item) currentW = item.w;
        if ("h" in item) currentH = item.h;
        if ("r" in item) {
          currentR = item.r;
          // When r changes, position resets to rx,ry
          if ("rx" in item) currentRx = item.rx;
          if ("ry" in item) currentRy = item.ry;
          currentX = currentRx;
          currentY = currentRy;
        } else {
          if ("rx" in item) currentRx = item.rx;
          if ("ry" in item) currentRy = item.ry;
        }
      } else if (typeof item === "string") {
        // Key legend — in Vial, this is "row,col" matrix address
        const match = item.match(/^(\d+),(\d+)$/);
        const matrixRow = match ? parseInt(match[1], 10) : -1;
        const matrixCol = match ? parseInt(match[2], 10) : -1;

        // Skip decal keys (marked with d:true in previous props)
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

// ── QMK Keycode → String Conversion ─────────────────────
// Simplified — the Raycast extension has the full database.
// Here we just output the numeric keycode; the extension decodes it.

function keycodeToQmk(keycode) {
  // We output raw numeric keycodes. The Raycast extension
  // converts them to QMK string names using its keycode database.
  return keycode;
}

// ── Main ─────────────────────────────────────────────────

function output(data) {
  process.stdout.write(JSON.stringify(data) + "\n");
}

function error(message) {
  output({ error: message });
  process.exit(1);
}

const command = process.argv[2] || "detect";
const devicePath = process.argv[3];

try {
  if (command === "detect") {
    const devices = findVialDevices();
    output({
      devices: devices.map((d) => ({
        path: d.path,
        manufacturer: d.manufacturer || "Unknown",
        product: d.product || "Unknown",
        serialNumber: d.serialNumber,
        vendorId: d.vendorId,
        productId: d.productId,
      })),
    });
  } else if (command === "read") {
    // Find or open device
    let device;
    if (devicePath) {
      device = new HID.HID(devicePath);
    } else {
      const devices = findVialDevices();
      if (devices.length === 0) {
        error("No Vial keyboard detected. Make sure your keyboard is plugged in and has Vial firmware.");
      }
      device = new HID.HID(devices[0].path);
    }

    try {
      // Get protocol versions
      const viaVersion = getViaProtocolVersion(device);
      const { vialProtocol, uid } = getVialKeyboardId(device);

      // Read keyboard definition (physical layout, matrix info)
      const definition = readDefinition(device);
      const rows = definition.matrix?.rows || 0;
      const cols = definition.matrix?.cols || 0;

      if (!rows || !cols) {
        error("Invalid keyboard definition: missing matrix dimensions");
      }

      // Read layer count and keymap
      const layerCount = getLayerCount(device);
      const keymapRaw = readKeymap(device, layerCount, rows, cols);

      // Parse physical layout from KLE data
      const kleLayout = definition.layouts?.keymap || [];
      const physicalKeys = parseKleLayout(kleLayout);

      // Build matrix position → physical key index mapping
      // The keymap is ordered by [row][col], but physical keys reference matrix positions
      const matrixToPhysical = new Map();
      for (let i = 0; i < physicalKeys.length; i++) {
        const [mr, mc] = physicalKeys[i].matrix;
        matrixToPhysical.set(`${mr},${mc}`, i);
      }

      // Reorder keymap to match physical key order
      const layers = [];
      for (let layer = 0; layer < layerCount; layer++) {
        const orderedKeycodes = [];
        for (const pk of physicalKeys) {
          const [mr, mc] = pk.matrix;
          const matrixIndex = mr * cols + mc;
          orderedKeycodes.push(keymapRaw[layer][matrixIndex]);
        }
        layers.push(orderedKeycodes);
      }

      output({
        viaProtocol: viaVersion,
        vialProtocol,
        uid,
        name: definition.name || "Unknown Keyboard",
        vendorId: definition.vendorId,
        productId: definition.productId,
        matrix: { rows, cols },
        layerCount,
        layers, // Array of arrays of numeric keycodes, ordered by physical position
        physicalLayout: physicalKeys.map((k) => ({
          x: k.x,
          y: k.y,
          w: k.w,
          h: k.h,
          r: k.r,
          rx: k.rx,
          ry: k.ry,
        })),
        layoutOptions: definition.layouts?.labels || [],
      });
    } finally {
      device.close();
    }
  } else {
    error(`Unknown command: ${command}. Use "detect" or "read".`);
  }
} catch (err) {
  error(err.message || String(err));
}
