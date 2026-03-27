#!/usr/bin/env node

/**
 * ZMK Studio Debug Probe
 *
 * Standalone test script that connects to a ZMK Studio keyboard over serial,
 * reads the full keymap (layers, bindings, behavior names), and investigates
 * the physical layouts response.
 *
 * Outputs structured JSON to stdout. Debug logs go to stderr.
 *
 * Usage:
 *   node zmk-debug-probe.js [port] [baud]
 *   Defaults: /dev/tty.usbmodem113201 9600
 */

const { SerialPort } = require("serialport");
const protobuf = require("protobufjs");

// ── Config ──────────────────────────────────────────────────

const PORT_PATH = process.argv[2] || "/dev/tty.usbmodem113201";
const BAUD_RATE = parseInt(process.argv[3], 10) || 9600;
const TIMEOUT_MS = 3000;

// ── Logging (stderr only) ───────────────────────────────────

function log(...args) {
  process.stderr.write("[probe] " + args.join(" ") + "\n");
}

// ── Framing ─────────────────────────────────────────────────

const SOF = 0xab;
const ESC = 0xac;
const EOF = 0xad;

function frameEncode(payload) {
  const out = [SOF];
  for (const byte of payload) {
    if (byte === SOF || byte === ESC || byte === EOF) {
      out.push(ESC, byte);
    } else {
      out.push(byte);
    }
  }
  out.push(EOF);
  return Buffer.from(out);
}

function frameDecode(data) {
  const frames = [];
  let current = null;
  let escaped = false;

  for (const byte of data) {
    if (escaped && current !== null) {
      current.push(byte);
      escaped = false;
    } else if (byte === SOF) {
      current = [];
      escaped = false;
    } else if (byte === EOF && current !== null) {
      frames.push(Buffer.from(current));
      current = null;
    } else if (byte === ESC && current !== null) {
      escaped = true;
    } else if (current !== null) {
      current.push(byte);
    }
  }
  return frames;
}

// ── Protobuf Schema ─────────────────────────────────────────
// Field numbers match zmk-studio-messages exactly.
// Request: core=3, behaviors=4, keymap=5  (NOT 1!)

const PROTO = `
syntax = "proto3";

message Request {
  uint32 request_id = 1;
  oneof subsystem {
    CoreRequest core = 3;
    BehaviorRequest behaviors = 4;
    KeymapRequest keymap = 5;
  }
}

message Response {
  oneof type {
    RequestResponse request_response = 1;
    Notification notification = 2;
  }
}

message RequestResponse {
  uint32 request_id = 1;
  oneof subsystem {
    MetaResponse meta = 2;
    CoreResponse core = 3;
    BehaviorResponse behaviors = 4;
    KeymapResponse keymap = 5;
  }
}

message Notification {
  oneof subsystem {
    CoreNotification core = 1;
  }
}

message CoreNotification {
  oneof notification_type {
    uint32 lock_state_changed = 1;
  }
}

message MetaResponse {
  oneof type {
    uint32 simple_error = 2;
  }
}

// ── Core ──
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

// ── Keymap ──
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

// ── Behaviors ──
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

// ── Communication Layer ─────────────────────────────────────

class ZmkConnection {
  constructor(port, root) {
    this.port = port;
    this.root = root;
    this.Request = root.lookupType("Request");
    this.Response = root.lookupType("Response");
    this.requestId = 0;
    this.buffer = Buffer.alloc(0);
    this.frameQueue = [];
    this.waiters = [];
    this.notifications = [];

    // Continuously accumulate data and extract frames
    this.port.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this._extractFrames();
    });
  }

  _extractFrames() {
    // Scan buffer for complete SOF...EOF frames
    let i = 0;
    while (i < this.buffer.length) {
      if (this.buffer[i] === SOF) {
        // Find the matching EOF
        let escaped = false;
        for (let j = i + 1; j < this.buffer.length; j++) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (this.buffer[j] === ESC) {
            escaped = true;
            continue;
          }
          if (this.buffer[j] === EOF) {
            // Complete frame from i to j (inclusive)
            const frameRaw = this.buffer.slice(i, j + 1);
            const decoded = frameDecode(frameRaw);
            if (decoded.length > 0) {
              this._handleFrame(decoded[0]);
            }
            // Advance past this frame
            this.buffer = this.buffer.slice(j + 1);
            i = 0; // restart scan
            break; // break inner loop, continue outer
          }
        }
        // If we didn't find EOF, stop -- incomplete frame
        break;
      } else {
        i++;
      }
    }
  }

  _handleFrame(frameBuf) {
    try {
      const resp = this.Response.decode(frameBuf);
      const obj = resp.toJSON();

      if (obj.notification) {
        log(`  [notification] ${JSON.stringify(obj.notification)}`);
        this.notifications.push(obj.notification);
        return;
      }

      if (obj.request_response) {
        // Check for meta errors
        if (obj.request_response.meta?.simple_error != null) {
          const code = obj.request_response.meta.simple_error;
          const names = { 0: "GENERIC", 1: "UNLOCK_REQUIRED", 2: "RPC_NOT_FOUND", 3: "MSG_DECODE_FAILED" };
          log(`  [error] RPC error: ${names[code] || code}`);
        }

        // Resolve any waiter matching this request_id
        const rid = parseInt(obj.request_response.request_id, 10) || 0;
        const waiterIdx = this.waiters.findIndex((w) => w.requestId === rid);
        if (waiterIdx !== -1) {
          const waiter = this.waiters.splice(waiterIdx, 1)[0];
          waiter.resolve(obj.request_response);
        } else {
          log(`  [warn] Unexpected response for request_id=${rid}`);
        }
      }
    } catch (err) {
      log(`  [decode error] ${err.message}, raw hex: ${frameBuf.toString("hex")}`);
    }
  }

  /**
   * Send an RPC request, skip notifications, return the RequestResponse.
   * Also returns the raw protobuf decode (before toJSON) for hex inspection.
   */
  async rpc(subsystemObj, { rawDecode = false } = {}) {
    this.requestId++;
    const rid = this.requestId;
    const req = this.Request.create({ request_id: rid, ...subsystemObj });
    const encoded = this.Request.encode(req).finish();
    const framed = frameEncode(encoded);

    log(`  [send] id=${rid} ${JSON.stringify(subsystemObj)} (${encoded.length} bytes proto, ${framed.length} bytes framed)`);

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.requestId === rid);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`Timeout waiting for response to request_id=${rid}`));
      }, TIMEOUT_MS);

      this.waiters.push({
        requestId: rid,
        resolve: (val) => { clearTimeout(timer); resolve(val); },
      });
    });

    this.port.write(framed);

    const result = await promise;

    if (rawDecode) {
      // Also decode without toJSON so we can inspect raw field values
      return { json: result };
    }
    return result;
  }

  /**
   * Send a raw request buffer and return all raw response bytes for inspection.
   * Used for debugging physical_layouts.
   */
  async rawSendReceive(payload) {
    const framed = frameEncode(payload);
    const chunks = [];
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.port.removeAllListeners("rawdata");
        resolve(Buffer.concat(chunks));
      }, TIMEOUT_MS);

      const handler = (chunk) => {
        chunks.push(chunk);
        const combined = Buffer.concat(chunks);
        // Count EOF bytes to see if we got a complete response
        let eofCount = 0;
        for (const b of combined) if (b === EOF) eofCount++;
        if (eofCount >= 1) {
          // Wait a bit for any trailing frames
          setTimeout(() => {
            clearTimeout(timer);
            this.port.removeListener("data", handler);
            resolve(Buffer.concat(chunks));
          }, 200);
        }
      };
      // Temporarily add a raw listener
      // We'll just use the buffer that accumulates
      this.port.write(framed, (err) => {
        if (err) { clearTimeout(timer); reject(err); }
      });
    });
  }

  close() {
    return new Promise((resolve) => this.port.close(resolve));
  }
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  log(`Connecting to ${PORT_PATH} at ${BAUD_RATE} baud...`);

  const root = protobuf.parse(PROTO, { keepCase: true }).root;

  const port = await new Promise((resolve, reject) => {
    const p = new SerialPort({ path: PORT_PATH, baudRate: BAUD_RATE, autoOpen: false });
    p.open((err) => err ? reject(err) : resolve(p));
  });

  log("Port opened.");
  const conn = new ZmkConnection(port, root);

  // Small delay to let any pending notifications flush
  await new Promise((r) => setTimeout(r, 300));

  const result = {};

  // ── 1. Device Info ──────────────────────────────────────
  log("=== Step 1: get_device_info ===");
  const deviceResp = await conn.rpc({ core: { get_device_info: true } });
  const deviceInfo = deviceResp.core?.get_device_info;
  log(`Device: ${JSON.stringify(deviceInfo)}`);
  result.deviceInfo = deviceInfo;

  // ── 2. Lock State ───────────────────────────────────────
  log("=== Step 2: get_lock_state ===");
  const lockResp = await conn.rpc({ core: { get_lock_state: true } });
  const lockState = lockResp.core?.get_lock_state;
  log(`Lock state: ${JSON.stringify(lockState)}`);
  result.lockState = lockState;

  // ── 3. Physical Layouts (the one we're investigating) ──
  log("=== Step 3: get_physical_layouts ===");
  const layoutResp = await conn.rpc({ keymap: { get_physical_layouts: true } });
  log(`Physical layouts raw response: ${JSON.stringify(layoutResp, null, 2)}`);

  const physLayouts = layoutResp.keymap?.get_physical_layouts;
  result.physicalLayouts = {
    raw: physLayouts,
    activeLayoutIndex: physLayouts?.active_layout_index,
    layoutCount: physLayouts?.layouts?.length || 0,
    layouts: physLayouts?.layouts || [],
  };

  // Investigation: if layouts array is empty but active_layout_index is set,
  // this likely means the ZMK firmware's physical layout definitions weren't
  // compiled in, OR the keyboard is a dongle (no physical keys on this half).
  if (!physLayouts?.layouts || physLayouts.layouts.length === 0) {
    log("INVESTIGATION: layouts array is empty.");
    log("  active_layout_index = " + (physLayouts?.active_layout_index ?? "undefined"));
    log("  Possible causes:");
    log("  1. ZMK dongle: the dongle itself has no physical keys.");
    log("     Physical layout lives on the peripheral halves, not the dongle.");
    log("  2. Firmware built without CONFIG_ZMK_STUDIO_PHYSICAL_LAYOUTS.");
    log("  3. The physical layout definitions exist but were optimized out");
    log("     because the dongle doesn't need them for key processing.");
    log("  This is expected behavior for a dongle like 'AllieCat'.");
    result.physicalLayouts.investigation =
      "Empty layouts array is expected for a ZMK dongle. " +
      "The dongle forwards keymaps but has no physical key positions of its own. " +
      "Physical layout geometry must come from the peripheral's devicetree, " +
      "or from a matching layout JSON file.";
  }

  // ── 4. Full Keymap ──────────────────────────────────────
  log("=== Step 4: get_keymap ===");
  const keymapResp = await conn.rpc({ keymap: { get_keymap: true } });
  const keymap = keymapResp.keymap?.get_keymap;
  log(`Keymap: ${keymap?.layers?.length || 0} layers, available_layers=${keymap?.available_layers}, max_layer_name_length=${keymap?.max_layer_name_length}`);
  result.keymap = keymap;

  // ── 5. List all behaviors ───────────────────────────────
  log("=== Step 5: list_all_behaviors ===");
  const behaviorListResp = await conn.rpc({ behaviors: { list_all_behaviors: 0 } });
  const behaviorList = behaviorListResp.behaviors?.list_all_behaviors;
  log(`Behavior IDs: ${JSON.stringify(behaviorList?.behavior_ids)}`);
  result.behaviorIds = behaviorList?.behavior_ids || [];

  // ── 6. Get details for each behavior ────────────────────
  log("=== Step 6: get_behavior_details for each ===");
  const behaviorDetails = {};

  // Collect all behavior IDs from both the list and the keymap bindings
  const allBehaviorIds = new Set(result.behaviorIds.map(Number));
  if (keymap?.layers) {
    for (const layer of keymap.layers) {
      for (const binding of layer.bindings || []) {
        if (binding.behavior_id != null) {
          allBehaviorIds.add(Number(binding.behavior_id));
        }
      }
    }
  }
  log(`All unique behavior IDs to query: ${[...allBehaviorIds].sort((a, b) => a - b).join(", ")}`);

  for (const bid of [...allBehaviorIds].sort((a, b) => a - b)) {
    try {
      const bResp = await conn.rpc({ behaviors: { get_behavior_details: { behavior_id: bid } } });
      const details = bResp.behaviors?.get_behavior_details;
      if (details) {
        behaviorDetails[bid] = {
          behaviorId: details.behavior_id,
          displayName: details.display_name || null,
          friendlyName: details.friendly_name || null,
        };
        log(`  ${bid}: display="${details.display_name}" friendly="${details.friendly_name}"`);
      }
    } catch (err) {
      log(`  ${bid}: FAILED - ${err.message}`);
      behaviorDetails[bid] = { behaviorId: bid, error: err.message };
    }
  }
  result.behaviorDetails = behaviorDetails;

  // ── 7. Build enriched layer output ──────────────────────
  log("=== Step 7: Building enriched output ===");
  result.enrichedLayers = (keymap?.layers || []).map((layer, idx) => ({
    id: layer.id,
    index: idx,
    name: layer.name || `Layer ${idx}`,
    bindingCount: (layer.bindings || []).length,
    bindings: (layer.bindings || []).map((b) => {
      const bid = Number(b.behavior_id);
      const details = behaviorDetails[bid];
      return {
        behavior: details?.displayName || details?.friendlyName || `b${bid}`,
        behaviorId: bid,
        param1: b.param1 || 0,
        param2: b.param2 || 0,
      };
    }),
  }));

  // ── 8. Summary ──────────────────────────────────────────
  result.notifications = conn.notifications;
  result.summary = {
    device: deviceInfo?.name || "unknown",
    firmware: "zmk",
    lockState: lockState === "ZMK_STUDIO_CORE_LOCK_STATE_LOCKED" || lockState === 0 ? "locked" : "unlocked",
    layerCount: keymap?.layers?.length || 0,
    availableLayers: keymap?.available_layers || 0,
    maxLayerNameLength: keymap?.max_layer_name_length || 0,
    behaviorCount: Object.keys(behaviorDetails).length,
    physicalLayoutCount: physLayouts?.layouts?.length || 0,
    activeLayoutIndex: physLayouts?.active_layout_index ?? 0,
    notificationCount: conn.notifications.length,
  };

  log("=== Done ===");
  log(`Summary: ${JSON.stringify(result.summary)}`);

  await conn.close();

  // Output final JSON to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err) => {
  log("FATAL: " + err.message);
  log(err.stack);
  process.stdout.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
});
