#!/usr/bin/env node

/**
 * Vial USB HID RAW Reader
 *
 * Standalone helper process that communicates with Vial-enabled keyboards
 * over USB HID RAW protocol. Outputs JSON to stdout, logs to stderr.
 *
 * Usage:
 *   node vial-reader.js detect     — List connected Vial devices
 *   node vial-reader.js read       — Read full keymap from first detected device
 *   node vial-reader.js read <path> — Read keymap from specific HID device path
 */

const HID = require("node-hid");
const { lzmaDecompress } = require("./lzma-decompress");

// ── Logging ──────────────────────────────────────────────

const VERBOSE = process.env.VIAL_DEBUG === "1";

function log(...args) {
  process.stderr.write("[vial] " + args.join(" ") + "\n");
}

function debug(...args) {
  if (VERBOSE) log("[debug]", ...args);
}

// ── Constants ────────────────────────────────────────────

const VIAL_SERIAL_MAGIC = "vial:f64c2b3c";
const VIAL_USAGE_PAGE = 0xff60;
const VIAL_USAGE = 0x61;
const PACKET_SIZE = 32;
const BUFFER_FETCH_CHUNK = 28;
const READ_TIMEOUT_MS = 1000;

// VIA commands
const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
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
  debug(`TX: [${bytes.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(", ")}]`);

  device.write(Array.from(packet));

  const response = device.readTimeout(READ_TIMEOUT_MS);
  if (!response || response.length === 0) {
    throw new Error("No response from keyboard (timeout)");
  }
  const buf = Buffer.from(response);
  debug(`RX: ${buf.length} bytes [${buf.subarray(0, 8).toString("hex")}...]`);
  return buf;
}

// ── Device Detection ─────────────────────────────────────

function findVialDevices() {
  const allDevices = HID.devices();
  debug(`Found ${allDevices.length} total HID devices`);

  const vialDevices = allDevices.filter(
    (d) =>
      d.serialNumber &&
      d.serialNumber.includes(VIAL_SERIAL_MAGIC) &&
      d.usagePage === VIAL_USAGE_PAGE &&
      d.usage === VIAL_USAGE
  );

  log(`Found ${vialDevices.length} Vial device(s)`);
  for (const d of vialDevices) {
    log(`  ${d.product} (${d.manufacturer}) @ ${d.path}`);
  }

  return vialDevices;
}

// ── Protocol Commands ────────────────────────────────────

function getViaProtocolVersion(device) {
  const resp = sendAndReceive(device, CMD_VIA_GET_PROTOCOL_VERSION);
  const version = (resp[1] << 8) | resp[2];
  log(`VIA protocol version: ${version}`);
  return version;
}

function getVialKeyboardId(device) {
  const resp = sendAndReceive(device, CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_KEYBOARD_ID);
  const vialProtocol = resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24);
  const uid = resp.subarray(4, 12);
  log(`Vial protocol: ${vialProtocol}, UID: ${uid.toString("hex")}`);
  return { vialProtocol, uid: uid.toString("hex") };
}

function getDefinitionSize(device) {
  const resp = sendAndReceive(device, CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_SIZE);
  const size = resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24);
  log(`Definition size: ${size} bytes (${Math.ceil(size / PACKET_SIZE)} blocks)`);
  return size;
}

function getDefinitionBlock(device, blockIndex) {
  return sendAndReceive(
    device,
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_DEFINITION,
    blockIndex & 0xff,
    (blockIndex >> 8) & 0xff
  );
}

function getLayerCount(device) {
  const resp = sendAndReceive(device, CMD_VIA_GET_LAYER_COUNT);
  const count = resp[1];
  log(`Layer count: ${count}`);
  return count;
}

function getKeymapBuffer(device, offset, size) {
  const resp = sendAndReceive(
    device,
    CMD_VIA_KEYMAP_GET_BUFFER,
    (offset >> 8) & 0xff,
    offset & 0xff,
    size
  );
  return resp.subarray(4, 4 + size);
}

// ── High-Level Operations ────────────────────────────────

function readDefinition(device) {
  const size = getDefinitionSize(device);

  if (size <= 0 || size > 1000000) {
    throw new Error(`Invalid definition size: ${size}`);
  }

  const blocks = Math.ceil(size / PACKET_SIZE);
  const compressed = Buffer.alloc(blocks * PACKET_SIZE);

  log(`Fetching ${blocks} blocks...`);
  for (let i = 0; i < blocks; i++) {
    const block = getDefinitionBlock(device, i);
    block.copy(compressed, i * PACKET_SIZE);
  }

  const trimmed = compressed.subarray(0, size);

  // Log first bytes for debugging
  log(`Compressed data: ${trimmed.length} bytes, header: [${trimmed.subarray(0, 16).toString("hex")}]`);

  // Decompress - Vial uses LZMA compression
  let jsonStr;
  try {
    jsonStr = lzmaDecompress(trimmed);
  } catch (e) {
    log(`LZMA decompression failed: ${e.message}`);
    log(`First 32 bytes hex: ${trimmed.subarray(0, 32).toString("hex")}`);
    throw new Error(`Failed to decompress keyboard definition: ${e.message}`);
  }

  log(`Decompressed: ${jsonStr.length} chars`);
  debug(`Definition JSON preview: ${jsonStr.substring(0, 200)}...`);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    log(`JSON parse failed: ${e.message}`);
    log(`Raw string preview: ${jsonStr.substring(0, 500)}`);
    throw new Error(`Failed to parse keyboard definition JSON: ${e.message}`);
  }
}

function readKeymap(device, layers, rows, cols) {
  const totalBytes = layers * rows * cols * 2;
  log(`Reading keymap: ${layers} layers × ${rows} rows × ${cols} cols = ${totalBytes} bytes`);
  const keymapBuffer = Buffer.alloc(totalBytes);

  for (let offset = 0; offset < totalBytes; offset += BUFFER_FETCH_CHUNK) {
    const chunkSize = Math.min(BUFFER_FETCH_CHUNK, totalBytes - offset);
    const chunk = getKeymapBuffer(device, offset, chunkSize);
    chunk.copy(keymapBuffer, offset);
  }

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

  log(`Read ${result.length} layers, ${result[0]?.length || 0} keycodes per layer`);
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
    if (!Array.isArray(row)) continue;

    currentX = 0;
    let currentW = 1;
    let currentH = 1;
    let currentR = 0;
    let currentRx = 0;
    let currentRy = 0;

    for (const item of row) {
      if (typeof item === "object" && item !== null) {
        if ("x" in item) currentX += item.x;
        if ("y" in item) currentY += item.y;
        if ("w" in item) currentW = item.w;
        if ("h" in item) currentH = item.h;
        if ("r" in item) {
          currentR = item.r;
          if ("rx" in item) currentRx = item.rx;
          if ("ry" in item) currentRy = item.ry;
          currentX = currentRx;
          currentY = currentRy;
        } else {
          if ("rx" in item) currentRx = item.rx;
          if ("ry" in item) currentRy = item.ry;
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

  log(`Parsed ${keys.length} physical keys from KLE layout`);
  return keys;
}

// ── Main ─────────────────────────────────────────────────

function output(data) {
  process.stdout.write(JSON.stringify(data) + "\n");
}

function errorAndExit(message) {
  log(`ERROR: ${message}`);
  output({ error: message });
  process.exit(1);
}

const command = process.argv[2] || "detect";
const devicePath = process.argv[3];

log(`Command: ${command}${devicePath ? ` (device: ${devicePath})` : ""}`);

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
    let device;
    if (devicePath) {
      log(`Opening device at path: ${devicePath}`);
      device = new HID.HID(devicePath);
    } else {
      const devices = findVialDevices();
      if (devices.length === 0) {
        errorAndExit("No Vial keyboard detected. Make sure your keyboard is plugged in and has Vial firmware.");
      }
      log(`Opening first device: ${devices[0].product}`);
      device = new HID.HID(devices[0].path);
    }

    try {
      const viaVersion = getViaProtocolVersion(device);
      const { vialProtocol, uid } = getVialKeyboardId(device);

      const definition = readDefinition(device);
      const rows = definition.matrix?.rows || 0;
      const cols = definition.matrix?.cols || 0;
      log(`Matrix: ${rows} × ${cols}`);

      if (!rows || !cols) {
        errorAndExit(`Invalid keyboard definition: matrix is ${rows}×${cols}`);
      }

      const layerCount = getLayerCount(device);
      const keymapRaw = readKeymap(device, layerCount, rows, cols);

      const kleLayout = definition.layouts?.keymap || [];
      const physicalKeys = parseKleLayout(kleLayout);

      if (physicalKeys.length === 0) {
        errorAndExit("No physical keys found in keyboard definition layout");
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

      log(`Success! ${physicalKeys.length} keys, ${layerCount} layers`);

      output({
        viaProtocol: viaVersion,
        vialProtocol,
        uid,
        name: definition.name || "Unknown Keyboard",
        vendorId: definition.vendorId,
        productId: definition.productId,
        matrix: { rows, cols },
        layerCount,
        layers,
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
    errorAndExit(`Unknown command: ${command}. Use "detect" or "read".`);
  }
} catch (err) {
  errorAndExit(err.message || String(err));
}
