/**
 * In-process ZMK Studio reader using native serial port + protobufjs.
 * No serialport npm package needed — uses Node.js fs + stty for serial,
 * and protobufjs (pure JS) for protobuf encoding/decoding.
 */

import * as nodeCrypto from "crypto";
import * as protobuf from "protobufjs";
import { BoardProfile, Layer, PhysicalKey } from "../types";
import {
  listSerialPorts,
  openSerialPort,
  closeSerialPort,
  writeSerial,
  readSerial,
  SerialConnection,
} from "./serial-port-native";

// ── Framing ──────────────────────────────────────────────

const FRAMING_SOF = 0xab;
const FRAMING_ESC = 0xac;
const FRAMING_EOF = 0xad;
const ZMK_BAUD_RATE = 12500;

function frameEncode(payload: Buffer): Buffer {
  const out: number[] = [FRAMING_SOF];
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

function frameDecode(data: Buffer): Buffer[] {
  const frames: Buffer[] = [];
  let current: number[] | null = null;
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

// ── Protobuf Schema ──────────────────────────────────────

// Same schema as helper/zmk-reader.js but parsed by protobufjs
const PROTO_SCHEMA = `
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

message CoreRequest {
  oneof request_type {
    bool get_device_info = 1;
    bool get_lock_state = 2;
  }
}

message CoreResponse {
  oneof response_type {
    GetDeviceInfoResponse get_device_info = 1;
    uint32 get_lock_state = 2;
  }
}

message GetDeviceInfoResponse {
  string name = 1;
  bytes serial_number = 2;
}

message KeymapRequest {
  oneof request_type {
    bool get_keymap = 1;
    bool get_physical_layouts = 4;
  }
}

message KeymapResponse {
  oneof response_type {
    Keymap get_keymap = 1;
    PhysicalLayouts get_physical_layouts = 4;
  }
}

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

message BehaviorRequest {
  oneof request_type {
    uint32 list_all_behaviors = 1;
    BehaviorDetailsRequest get_behavior_details = 2;
  }
}

message BehaviorDetailsRequest {
  sint32 behavior_id = 1;
}

message BehaviorResponse {
  oneof response_type {
    BehaviorList list_all_behaviors = 1;
    BehaviorDetailsResponse get_behavior_details = 2;
  }
}

message BehaviorList {
  repeated sint32 behavior_ids = 1;
}

message BehaviorDetailsResponse {
  sint32 behavior_id = 1;
  string display_name = 2;
  string friendly_name = 3;
}
`;

let protoRoot: protobuf.Root | null = null;

function getProtoTypes() {
  if (!protoRoot) {
    protoRoot = protobuf.parse(PROTO_SCHEMA, { keepCase: true }).root;
  }
  return {
    Request: protoRoot.lookupType("Request"),
    Response: protoRoot.lookupType("Response"),
  };
}

// ── Serial Communication ─────────────────────────────────

function sendAndReceiveZmk(
  conn: SerialConnection,
  requestPayload: Uint8Array,
): Buffer[] {
  const framed = frameEncode(Buffer.from(requestPayload));
  writeSerial(conn, framed);
  const rawResponse = readSerial(conn, 4096, 2000);
  return frameDecode(rawResponse);
}

// ── Device Detection ─────────────────────────────────────

export interface ZmkNativeDevice {
  path: string;
  name: string;
  serialNumber: string;
}

export async function detectZmkDevicesNative(): Promise<ZmkNativeDevice[]> {
  const ports = listSerialPorts();
  const devices: ZmkNativeDevice[] = [];
  const { Request, Response } = getProtoTypes();

  for (const portPath of ports) {
    try {
      const conn = openSerialPort(portPath, ZMK_BAUD_RATE);
      try {
        const reqPayload = Request.encode(
          Request.create({ core: { get_device_info: true } }),
        ).finish();
        const frames = sendAndReceiveZmk(conn, reqPayload);

        if (frames.length > 0) {
          const resp = Response.decode(frames[0]) as Record<string, unknown>;
          const core = resp.core as Record<string, unknown> | undefined;
          const info = core?.get_device_info as
            | { name?: string; serial_number?: Uint8Array }
            | undefined;

          if (info) {
            devices.push({
              path: portPath,
              name: String(info.name || "ZMK Keyboard"),
              serialNumber: info.serial_number
                ? Buffer.from(info.serial_number).toString("hex")
                : "",
            });
          }
        }
      } finally {
        closeSerialPort(conn);
      }
    } catch {
      // Not a ZMK board
    }
  }

  return devices;
}

// ── Full Board Read ──────────────────────────────────────

export async function readZmkKeyboardNative(
  portPath: string,
): Promise<BoardProfile> {
  const { Request, Response } = getProtoTypes();
  const conn = openSerialPort(portPath, ZMK_BAUD_RATE);

  try {
    // 1. Get device info
    let reqPayload = Request.encode(
      Request.create({ core: { get_device_info: true } }),
    ).finish();
    let frames = sendAndReceiveZmk(conn, reqPayload);
    if (frames.length === 0) throw new Error("No response to getDeviceInfo");

    const deviceResp = Response.decode(frames[0]) as Record<string, unknown>;
    const deviceInfo = (deviceResp.core as Record<string, unknown>)
      ?.get_device_info as
      | { name?: string; serial_number?: Uint8Array }
      | undefined;
    if (!deviceInfo) throw new Error("Invalid getDeviceInfo response");

    // 2. Get physical layouts
    reqPayload = Request.encode(
      Request.create({ keymap: { get_physical_layouts: true } }),
    ).finish();
    frames = sendAndReceiveZmk(conn, reqPayload);
    if (frames.length === 0)
      throw new Error("No response to getPhysicalLayouts");

    const layoutResp = Response.decode(frames[0]) as Record<string, unknown>;
    const physLayouts = (layoutResp.keymap as Record<string, unknown>)
      ?.get_physical_layouts as
      | {
          active_layout_index?: number;
          layouts?: Array<{
            name?: string;
            keys?: Array<{
              width?: number;
              height?: number;
              x?: number;
              y?: number;
              r?: number;
              rx?: number;
              ry?: number;
            }>;
          }>;
        }
      | undefined;

    const activeLayout =
      physLayouts?.layouts?.[physLayouts.active_layout_index || 0];

    const physicalLayout: PhysicalKey[] = (activeLayout?.keys || []).map(
      (k) => ({
        x: (k.x || 0) / 100,
        y: (k.y || 0) / 100,
        w: (k.width || 100) / 100,
        h: (k.height || 100) / 100,
        r: k.r ? k.r / 10 : undefined,
        rx: k.rx ? k.rx / 100 : undefined,
        ry: k.ry ? k.ry / 100 : undefined,
      }),
    );

    // 3. Get keymap
    reqPayload = Request.encode(
      Request.create({ keymap: { get_keymap: true } }),
    ).finish();
    frames = sendAndReceiveZmk(conn, reqPayload);
    if (frames.length === 0) throw new Error("No response to getKeymap");

    const keymapResp = Response.decode(frames[0]) as Record<string, unknown>;
    const keymap = (keymapResp.keymap as Record<string, unknown>)
      ?.get_keymap as
      | {
          layers?: Array<{
            id?: number;
            name?: string;
            bindings?: Array<{
              behavior_id?: number;
              param1?: number;
              param2?: number;
            }>;
          }>;
        }
      | undefined;

    // 4. Get behavior names
    const behaviorIds = new Set<number>();
    for (const layer of keymap?.layers || []) {
      for (const binding of layer.bindings || []) {
        if (binding.behavior_id !== undefined) {
          behaviorIds.add(binding.behavior_id);
        }
      }
    }

    const behaviorNames: Record<number, string> = {};
    for (const bid of behaviorIds) {
      try {
        reqPayload = Request.encode(
          Request.create({
            behaviors: { get_behavior_details: { behavior_id: bid } },
          }),
        ).finish();
        frames = sendAndReceiveZmk(conn, reqPayload);
        if (frames.length > 0) {
          const bResp = Response.decode(frames[0]) as Record<string, unknown>;
          const details = (bResp.behaviors as Record<string, unknown>)
            ?.get_behavior_details as
            | {
                display_name?: string;
                friendly_name?: string;
              }
            | undefined;
          if (details) {
            behaviorNames[bid] =
              details.display_name || details.friendly_name || `b${bid}`;
          }
        }
      } catch {
        // Skip failed behavior lookups
      }
    }

    // 5. Build layers
    const layers: Layer[] = (keymap?.layers || []).map((layer, index) => ({
      index,
      name: layer.name || `Layer ${index}`,
      keycodes: (layer.bindings || []).map((b) => {
        const behavior =
          behaviorNames[b.behavior_id || 0] || `b${b.behavior_id}`;
        if (behavior === "key_press" || behavior === "&kp") {
          return `KC_${b.param1 || 0}`;
        }
        if (behavior === "transparent" || behavior === "&trans")
          return "KC_TRNS";
        if (behavior === "none" || behavior === "&none") return "KC_NO";
        if (behavior === "momentary_layer" || behavior === "&mo")
          return `MO(${b.param1})`;
        if (behavior === "layer_tap" || behavior === "&lt")
          return `LT(${b.param1}, KC_${b.param2})`;
        if (behavior === "toggle_layer" || behavior === "&tog")
          return `TG(${b.param1})`;
        return (
          behavior +
          (b.param1 ? ` ${b.param1}` : "") +
          (b.param2 ? ` ${b.param2}` : "")
        );
      }),
    }));

    const now = new Date().toISOString();

    return {
      id: nodeCrypto.randomUUID(),
      name: String(deviceInfo.name || "ZMK Keyboard"),
      keyboard: `zmk:${deviceInfo.serial_number ? Buffer.from(deviceInfo.serial_number).toString("hex") : "unknown"}`,
      layoutKey: "zmk_studio",
      firmware: "zmk",
      layers,
      physicalLayout,
      devicePath: portPath,
      createdAt: now,
      updatedAt: now,
    };
  } finally {
    closeSerialPort(conn);
  }
}
