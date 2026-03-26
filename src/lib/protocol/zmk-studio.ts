/**
 * ZMK Studio protocol implementation — runs on any TransportConnection.
 * Uses protobufjs (pure JS) for encoding/decoding.
 */

import * as nodeCrypto from "crypto";
import * as protobuf from "protobufjs";
import { BoardProfile, Layer, PhysicalKey } from "../types";
import { TransportConnection } from "../transport/types";

// ── Protobuf Schema ──────────────────────────────────────

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

function getProto() {
  if (!protoRoot) {
    protoRoot = protobuf.parse(PROTO_SCHEMA, { keepCase: true }).root;
  }
  return {
    Request: protoRoot.lookupType("Request"),
    Response: protoRoot.lookupType("Response"),
  };
}

// ── Helper: send protobuf request, get decoded response ──

function rpc(
  conn: TransportConnection,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  const { Request, Response } = getProto();
  const payload = Request.encode(Request.create(request)).finish();
  const responseBytes = conn.sendAndReceive(Array.from(payload));
  return Response.decode(responseBytes).toJSON();
}

// ── Protocol Operations ──────────────────────────────────

export function getDeviceInfo(conn: TransportConnection): {
  name: string;
  serialNumber: string;
} {
  const resp = rpc(conn, { core: { get_device_info: true } });
  const info = resp.core?.get_device_info;
  return {
    name: String(info?.name || "ZMK Keyboard"),
    serialNumber: info?.serial_number
      ? Buffer.from(info.serial_number, "base64").toString("hex")
      : "",
  };
}

export function getLockState(conn: TransportConnection): boolean {
  const resp = rpc(conn, { core: { get_lock_state: true } });
  return resp.core?.get_lock_state === 0; // 0 = LOCKED
}

export function getPhysicalLayouts(conn: TransportConnection): PhysicalKey[] {
  const resp = rpc(conn, { keymap: { get_physical_layouts: true } });
  const layouts = resp.keymap?.get_physical_layouts;
  const active = layouts?.layouts?.[layouts.active_layout_index || 0];

  return (active?.keys || []).map((k: Record<string, number>) => ({
    x: (k.x || 0) / 100,
    y: (k.y || 0) / 100,
    w: (k.width || 100) / 100,
    h: (k.height || 100) / 100,
    r: k.r ? k.r / 10 : undefined,
    rx: k.rx ? k.rx / 100 : undefined,
    ry: k.ry ? k.ry / 100 : undefined,
  }));
}

export function getKeymap(conn: TransportConnection): {
  layers: Array<{
    id: number;
    name: string;
    bindings: Array<{ behavior_id: number; param1: number; param2: number }>;
  }>;
} {
  const resp = rpc(conn, { keymap: { get_keymap: true } });
  const keymap = resp.keymap?.get_keymap;
  return {
    layers: (keymap?.layers || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any) => ({
        id: l.id || 0,
        name: l.name || "",
        bindings: (l.bindings || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b: any) => ({
            behavior_id: b.behavior_id || 0,
            param1: b.param1 || 0,
            param2: b.param2 || 0,
          }),
        ),
      }),
    ),
  };
}

export function getBehaviorName(
  conn: TransportConnection,
  behaviorId: number,
): string {
  try {
    const resp = rpc(conn, {
      behaviors: { get_behavior_details: { behavior_id: behaviorId } },
    });
    const details = resp.behaviors?.get_behavior_details;
    return details?.display_name || details?.friendly_name || `b${behaviorId}`;
  } catch {
    return `b${behaviorId}`;
  }
}

export function setLayerName(
  conn: TransportConnection,
  layerId: number,
  name: string,
): void {
  rpc(conn, { keymap: { set_layer_props: { layer_id: layerId, name } } });
  rpc(conn, { keymap: { save_changes: true } });
}

// ── Full Board Read ──────────────────────────────────────

export function readZmkBoard(conn: TransportConnection): BoardProfile {
  // 1. Device info
  const info = getDeviceInfo(conn);

  // 2. Physical layout
  const physicalLayout = getPhysicalLayouts(conn);

  // 3. Keymap + behavior names
  const keymap = getKeymap(conn);

  const behaviorIds = new Set<number>();
  for (const layer of keymap.layers) {
    for (const binding of layer.bindings) {
      behaviorIds.add(binding.behavior_id);
    }
  }

  const behaviorNames: Record<number, string> = {};
  for (const bid of behaviorIds) {
    behaviorNames[bid] = getBehaviorName(conn, bid);
  }

  // 4. Build layers
  const layers: Layer[] = keymap.layers.map((layer, index) => ({
    index,
    name: layer.name || `Layer ${index}`,
    keycodes: layer.bindings.map((b) => {
      const behavior = behaviorNames[b.behavior_id] || `b${b.behavior_id}`;
      if (behavior === "key_press" || behavior === "&kp")
        return `KC_${b.param1}`;
      if (behavior === "transparent" || behavior === "&trans") return "KC_TRNS";
      if (behavior === "none" || behavior === "&none") return "KC_NO";
      if (behavior === "momentary_layer" || behavior === "&mo")
        return `MO(${b.param1})`;
      if (behavior === "layer_tap" || behavior === "&lt")
        return `LT(${b.param1}, KC_${b.param2})`;
      if (behavior === "mod_tap" || behavior === "&mt")
        return `MT(KC_${b.param1}, KC_${b.param2})`;
      if (behavior === "toggle_layer" || behavior === "&tog")
        return `TG(${b.param1})`;
      if (behavior === "to_layer" || behavior === "&to")
        return `TO(${b.param1})`;
      return (
        behavior +
        (b.param1 ? ` ${b.param1}` : "") +
        (b.param2 ? ` ${b.param2}` : "")
      );
    }),
  }));

  return {
    id: nodeCrypto.randomUUID(),
    name: info.name,
    keyboard: `zmk:${info.serialNumber || "unknown"}`,
    layoutKey: "zmk_studio",
    firmware: "zmk",
    layers,
    physicalLayout,
    devicePath: conn.device.path,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
