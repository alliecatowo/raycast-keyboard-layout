#!/usr/bin/env node

/**
 * ZMK Studio USB Reader
 *
 * Communicates with ZMK Studio-enabled keyboards over CDC-ACM serial port.
 * Uses protobuf messages with simple escape framing.
 *
 * Usage:
 *   node zmk-reader.js detect     — Probe serial ports for ZMK boards
 *   node zmk-reader.js read <port> — Read keymap from specific serial port
 */

const { SerialPort } = require("serialport");
const protobuf = require("protobufjs");

// ── Logging ──────────────────────────────────────────────

function log(...args) {
  process.stderr.write("[zmk] " + args.join(" ") + "\n");
}

// ── Constants ────────────────────────────────────────────

const BAUD_RATE = 12500;
const FRAMING_SOF = 0xab;
const FRAMING_ESC = 0xac;
const FRAMING_EOF = 0xad;
const READ_TIMEOUT_MS = 2000;

// ── Protobuf Schema (inline — matches zmk-studio-messages) ──

const protoSchema = `
syntax = "proto3";

message Request {
  oneof subsystem {
    CoreRequest core = 1;
    KeymapRequest keymap = 5;
    BehaviorRequest behaviors = 6;
  }
}

message Response {
  oneof subsystem {
    CoreResponse core = 1;
    KeymapResponse keymap = 5;
    BehaviorResponse behaviors = 6;
  }
}

// Core
message CoreRequest {
  oneof request_type {
    bool get_device_info = 1;
    bool get_lock_state = 2;
  }
}

message CoreResponse {
  oneof response_type {
    GetDeviceInfoResponse get_device_info = 1;
    LockState get_lock_state = 2;
  }
}

message GetDeviceInfoResponse {
  string name = 1;
  bytes serial_number = 2;
}

enum LockState {
  ZMK_STUDIO_CORE_LOCK_STATE_LOCKED = 0;
  ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED = 1;
}

// Keymap
message KeymapRequest {
  oneof request_type {
    bool get_keymap = 1;
    SetLayerPropsRequest set_layer_props = 3;
    bool get_physical_layouts = 4;
    bool check_unsaved_changes = 7;
    bool save_changes = 8;
  }
}

message SetLayerPropsRequest {
  uint32 layer_id = 1;
  string name = 2;
}

message KeymapResponse {
  oneof response_type {
    Keymap get_keymap = 1;
    SetLayerPropsResponse set_layer_props = 3;
    PhysicalLayouts get_physical_layouts = 4;
    bool check_unsaved_changes = 7;
    bool save_changes = 8;
  }
}

message SetLayerPropsResponse {}

message Keymap {
  repeated Layer layers = 1;
  uint32 available_layers = 2;
  uint32 max_layer_name_length = 3;
}

message Layer {
  uint32 id = 1;
  string name = 2;
  repeated BehaviorBinding bindings = 3;
}

message BehaviorBinding {
  sint32 behavior_id = 1;
  uint32 param1 = 2;
  uint32 param2 = 3;
}

message PhysicalLayouts {
  uint32 active_layout_index = 1;
  repeated PhysicalLayout layouts = 2;
}

message PhysicalLayout {
  string name = 1;
  repeated KeyPhysicalAttrs keys = 2;
}

message KeyPhysicalAttrs {
  sint32 width = 1;
  sint32 height = 2;
  sint32 x = 3;
  sint32 y = 4;
  sint32 r = 5;
  sint32 rx = 6;
  sint32 ry = 7;
}

// Behaviors
message BehaviorRequest {
  oneof request_type {
    uint32 list_all_behaviors = 1;
    BehaviorBindingParametersRequest get_behavior_details = 2;
  }
}

message BehaviorBindingParametersRequest {
  sint32 behavior_id = 1;
}

message BehaviorResponse {
  oneof response_type {
    BehaviorList list_all_behaviors = 1;
    BehaviorBindingParametersResponse get_behavior_details = 2;
  }
}

message BehaviorList {
  repeated sint32 behavior_ids = 1;
}

message BehaviorBindingParametersResponse {
  sint32 behavior_id = 1;
  string display_name = 2;
  string friendly_name = 3;
}
`;

// ── Framing ──────────────────────────────────────────────

function frameEncode(payload) {
  const out = [FRAMING_SOF];
  for (const byte of payload) {
    if (byte === FRAMING_SOF || byte === FRAMING_ESC || byte === FRAMING_EOF) {
      out.push(FRAMING_ESC, byte);
    } else {
      out.push(byte);
    }
  }
  out.push(FRAMING_EOF);
  return Buffer.from(out);
}

function frameDecode(data) {
  const frames = [];
  let current = null;
  let escaped = false;

  for (const byte of data) {
    if (byte === FRAMING_SOF) {
      current = [];
      escaped = false;
    } else if (byte === FRAMING_EOF && current !== null) {
      frames.push(Buffer.from(current));
      current = null;
    } else if (byte === FRAMING_ESC && current !== null) {
      escaped = true;
    } else if (current !== null) {
      if (escaped) {
        current.push(byte);
        escaped = false;
      } else {
        current.push(byte);
      }
    }
  }

  return frames;
}

// ── Serial Communication ─────────────────────────────────

function openPort(portPath) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: portPath, baudRate: BAUD_RATE, autoOpen: false });
    port.open((err) => {
      if (err) reject(new Error(`Cannot open ${portPath}: ${err.message}`));
      else resolve(port);
    });
  });
}

function sendAndReceive(port, requestBuf) {
  return new Promise((resolve, reject) => {
    const framed = frameEncode(requestBuf);
    const chunks = [];

    const timer = setTimeout(() => {
      port.removeAllListeners("data");
      if (chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error("Timeout waiting for response"));
      }
    }, READ_TIMEOUT_MS);

    port.on("data", (chunk) => {
      chunks.push(chunk);
      // Check if we have a complete frame (ends with EOF)
      const combined = Buffer.concat(chunks);
      if (combined.includes(FRAMING_EOF)) {
        clearTimeout(timer);
        port.removeAllListeners("data");
        resolve(combined);
      }
    });

    port.write(framed, (err) => {
      if (err) {
        clearTimeout(timer);
        port.removeAllListeners("data");
        reject(new Error(`Write failed: ${err.message}`));
      }
    });
  });
}

// ── Main ─────────────────────────────────────────────────

function output(data) {
  process.stdout.write(JSON.stringify(data) + "\n");
}

function errorAndExit(message) {
  log("ERROR:", message);
  output({ error: message });
  process.exit(1);
}

async function main() {
  const command = process.argv[2] || "detect";
  const portPath = process.argv[3];

  // Parse protobuf schema
  const root = protobuf.parse(protoSchema, { keepCase: true }).root;
  const Request = root.lookupType("Request");
  const Response = root.lookupType("Response");

  if (command === "detect") {
    log("Scanning serial ports for ZMK boards...");
    const ports = await SerialPort.list();
    const serialPorts = ports.filter(
      (p) => p.manufacturer || p.vendorId || p.productId
    );

    log(`Found ${serialPorts.length} candidate serial port(s)`);

    const zmkDevices = [];

    for (const portInfo of serialPorts) {
      const path = portInfo.path;
      log(`Probing ${path} (${portInfo.manufacturer || "unknown"})...`);

      try {
        const port = await openPort(path);

        try {
          // Send getDeviceInfo request
          const reqPayload = Request.encode(
            Request.create({ core: { get_device_info: true } })
          ).finish();

          const rawResponse = await sendAndReceive(port, reqPayload);
          const frames = frameDecode(rawResponse);

          if (frames.length > 0) {
            const resp = Response.decode(frames[0]);
            if (resp.core && resp.core.get_device_info) {
              const info = resp.core.get_device_info;
              log(`  ZMK device found: ${info.name}`);
              zmkDevices.push({
                path,
                name: info.name || "ZMK Keyboard",
                serialNumber: info.serial_number
                  ? Buffer.from(info.serial_number).toString("hex")
                  : "",
                manufacturer: portInfo.manufacturer || "",
                vendorId: portInfo.vendorId || "",
                productId: portInfo.productId || "",
                firmware: "zmk",
              });
            }
          }
        } finally {
          port.close();
        }
      } catch (e) {
        log(`  Not a ZMK board: ${e.message}`);
      }
    }

    output({ devices: zmkDevices });
  } else if (command === "read") {
    if (!portPath) errorAndExit("Usage: zmk-reader.js read <serial-port-path>");

    log(`Opening ${portPath}...`);
    const port = await openPort(portPath);

    try {
      // 1. Get device info
      let reqPayload = Request.encode(
        Request.create({ core: { get_device_info: true } })
      ).finish();
      let rawResp = await sendAndReceive(port, reqPayload);
      let frames = frameDecode(rawResp);
      if (frames.length === 0) errorAndExit("No response to getDeviceInfo");

      const deviceResp = Response.decode(frames[0]);
      const deviceInfo = deviceResp.core?.get_device_info;
      if (!deviceInfo) errorAndExit("Invalid getDeviceInfo response");
      log(`Device: ${deviceInfo.name}`);

      // 2. Get physical layouts
      reqPayload = Request.encode(
        Request.create({ keymap: { get_physical_layouts: true } })
      ).finish();
      rawResp = await sendAndReceive(port, reqPayload);
      frames = frameDecode(rawResp);
      if (frames.length === 0) errorAndExit("No response to getPhysicalLayouts");

      const layoutResp = Response.decode(frames[0]);
      const physLayouts = layoutResp.keymap?.get_physical_layouts;
      if (!physLayouts) errorAndExit("Invalid getPhysicalLayouts response");

      const activeLayout = physLayouts.layouts[physLayouts.active_layout_index || 0];
      log(`Physical layout: ${activeLayout?.name || "default"}, ${activeLayout?.keys?.length || 0} keys`);

      // Convert physical layout (units are 100ths of key units)
      const physicalLayout = (activeLayout?.keys || []).map((k) => ({
        x: (k.x || 0) / 100,
        y: (k.y || 0) / 100,
        w: (k.width || 100) / 100,
        h: (k.height || 100) / 100,
        r: k.r ? k.r / 10 : undefined,
        rx: k.rx ? k.rx / 100 : undefined,
        ry: k.ry ? k.ry / 100 : undefined,
      }));

      // 3. Get keymap
      reqPayload = Request.encode(
        Request.create({ keymap: { get_keymap: true } })
      ).finish();
      rawResp = await sendAndReceive(port, reqPayload);
      frames = frameDecode(rawResp);
      if (frames.length === 0) errorAndExit("No response to getKeymap");

      const keymapResp = Response.decode(frames[0]);
      const keymap = keymapResp.keymap?.get_keymap;
      if (!keymap) errorAndExit("Invalid getKeymap response");

      log(`Keymap: ${keymap.layers.length} layers`);

      // 4. Get behavior details for all behavior IDs
      const behaviorIds = new Set();
      for (const layer of keymap.layers) {
        for (const binding of layer.bindings || []) {
          behaviorIds.add(binding.behavior_id);
        }
      }

      const behaviorNames = {};
      for (const bid of behaviorIds) {
        try {
          reqPayload = Request.encode(
            Request.create({ behaviors: { get_behavior_details: { behavior_id: bid } } })
          ).finish();
          rawResp = await sendAndReceive(port, reqPayload);
          frames = frameDecode(rawResp);
          if (frames.length > 0) {
            const bResp = Response.decode(frames[0]);
            const details = bResp.behaviors?.get_behavior_details;
            if (details) {
              behaviorNames[bid] = details.display_name || details.friendly_name || `behavior_${bid}`;
              log(`  Behavior ${bid}: ${behaviorNames[bid]}`);
            }
          }
        } catch {
          log(`  Failed to get behavior ${bid} details`);
        }
      }

      // 5. Build output
      const layers = keymap.layers.map((layer, index) => ({
        index,
        name: layer.name || `Layer ${index}`,
        // Output bindings as { behavior, param1, param2 } for the Raycast client to decode
        bindings: (layer.bindings || []).map((b) => ({
          behavior: behaviorNames[b.behavior_id] || `b${b.behavior_id}`,
          behaviorId: b.behavior_id,
          param1: b.param1 || 0,
          param2: b.param2 || 0,
        })),
      }));

      output({
        firmware: "zmk",
        name: deviceInfo.name || "ZMK Keyboard",
        serialNumber: deviceInfo.serial_number
          ? Buffer.from(deviceInfo.serial_number).toString("hex")
          : "",
        physicalLayout,
        layers,
        behaviorNames,
      });

      log("Success!");
    } finally {
      port.close();
    }
  } else if (command === "lock-status") {
    if (!portPath) errorAndExit("Usage: zmk-reader.js lock-status <serial-port-path>");

    const port = await openPort(portPath);
    try {
      const reqPayload = Request.encode(
        Request.create({ core: { get_lock_state: true } }),
      ).finish();
      const rawResp = await sendAndReceive(port, reqPayload);
      const frames = frameDecode(rawResp);

      if (frames.length > 0) {
        const resp = Response.decode(frames[0]);
        const lockState = resp.core?.get_lock_state;
        const isLocked = lockState === 0; // ZMK_STUDIO_CORE_LOCK_STATE_LOCKED = 0
        log(`Lock state: ${isLocked ? "LOCKED" : "UNLOCKED"}`);
        output({ isLocked, unlockInProgress: false, unlockKeys: [] });
      } else {
        output({ isLocked: false, unlockInProgress: false, unlockKeys: [] });
      }
    } finally {
      port.close();
    }
  } else if (command === "check-changes") {
    // Check if there are unsaved keymap changes (for live sync detection)
    if (!portPath) errorAndExit("Usage: zmk-reader.js check-changes <serial-port-path>");

    const port = await openPort(portPath);
    try {
      const reqPayload = Request.encode(
        Request.create({ keymap: { check_unsaved_changes: true } }),
      ).finish();
      const rawResp = await sendAndReceive(port, reqPayload);
      const frames = frameDecode(rawResp);

      let hasChanges = false;
      if (frames.length > 0) {
        const resp = Response.decode(frames[0]);
        hasChanges = resp.keymap?.check_unsaved_changes === true;
      }
      log(`Unsaved changes: ${hasChanges}`);
      output({ hasChanges });
    } finally {
      port.close();
    }
  } else if (command === "set-layer-name") {
    // Usage: zmk-reader.js set-layer-name <port> <layer_id> <name>
    const layerId = parseInt(process.argv[4], 10);
    const newName = process.argv[5];
    if (!portPath || isNaN(layerId) || !newName) {
      errorAndExit("Usage: zmk-reader.js set-layer-name <port> <layer_id> <name>");
    }

    const port = await openPort(portPath);
    try {
      // Set layer name
      let reqPayload = Request.encode(
        Request.create({
          keymap: { set_layer_props: { layer_id: layerId, name: newName } },
        }),
      ).finish();
      let rawResp = await sendAndReceive(port, reqPayload);
      let frames = frameDecode(rawResp);
      log(`Set layer ${layerId} name to "${newName}"`);

      // Save changes to persist
      reqPayload = Request.encode(
        Request.create({ keymap: { save_changes: true } }),
      ).finish();
      rawResp = await sendAndReceive(port, reqPayload);
      frames = frameDecode(rawResp);
      log("Changes saved");

      output({ ok: true, layerId, name: newName });
    } finally {
      port.close();
    }
  } else {
    errorAndExit(`Unknown command: ${command}. Use "detect", "read", "lock-status", or "set-layer-name".`);
  }
}

main().catch((err) => errorAndExit(err.message || String(err)));
