/**
 * Vial protocol implementation using koffi-hid FFI.
 *
 * This is the in-process replacement for helper/vial-reader.js.
 * Same protocol, but runs inside the Raycast extension without
 * spawning a child process.
 */

import {
  initHid,
  enumerateDevices,
  sendAndReceive,
  HidDeviceInfo,
} from "./koffi-hid";

// ── Constants ────────────────────────────────────────────

const VIAL_SERIAL_MAGIC = "vial:f64c2b3c";
const VIAL_USAGE_PAGE = 0xff60;
const VIAL_USAGE = 0x61;
const BUFFER_FETCH_CHUNK = 28;

// VIA commands
const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
const CMD_VIA_GET_KEYBOARD_VALUE = 0x02;
const CMD_VIA_GET_LAYER_COUNT = 0x11;
const CMD_VIA_KEYMAP_GET_BUFFER = 0x12;

// VIA keyboard value sub-commands
const VIA_SWITCH_MATRIX_STATE = 0x03;

// Vial commands (prefixed with 0xFE)
const CMD_VIA_VIAL_PREFIX = 0xfe;
const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
// CMD_VIAL_GET_SIZE = 0x01 and CMD_VIAL_GET_DEFINITION = 0x02
// are used in vial-reader-inprocess.ts directly
const CMD_VIAL_GET_UNLOCK_STATUS = 0x05;
const CMD_VIAL_QMK_SETTINGS_QUERY = 0x09;
const CMD_VIAL_QMK_SETTINGS_GET = 0x0a;
const CMD_VIAL_QMK_SETTINGS_SET = 0x0b;

// ── Device Detection ─────────────────────────────────────

/** Find all connected Vial keyboards */
export async function findVialDevices(): Promise<HidDeviceInfo[]> {
  await initHid();
  const allDevices = enumerateDevices();
  return allDevices.filter(
    (d) =>
      d.serialNumber.includes(VIAL_SERIAL_MAGIC) &&
      d.usagePage === VIAL_USAGE_PAGE &&
      d.usage === VIAL_USAGE,
  );
}

// ── Protocol Commands ────────────────────────────────────

/** Get VIA protocol version */
export function getViaProtocolVersion(device: unknown): number {
  const resp = sendAndReceive(device, [CMD_VIA_GET_PROTOCOL_VERSION]);
  return (resp[1] << 8) | resp[2];
}

/** Get Vial keyboard ID and protocol version */
export function getVialKeyboardId(device: unknown): {
  vialProtocol: number;
  uid: string;
} {
  const resp = sendAndReceive(device, [
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_KEYBOARD_ID,
  ]);
  const vialProtocol =
    resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24);
  const uid = resp.subarray(4, 12).toString("hex");
  return { vialProtocol, uid };
}

/** Get layer count */
export function getLayerCount(device: unknown): number {
  const resp = sendAndReceive(device, [CMD_VIA_GET_LAYER_COUNT]);
  return resp[1];
}

/** Read the keymap buffer in chunks */
export function readKeymapBuffer(device: unknown, totalBytes: number): Buffer {
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

  return keymapBuffer;
}

/** Read the switch matrix state (which keys are currently pressed) */
export function readMatrixStateRaw(device: unknown): Buffer {
  return sendAndReceive(device, [
    CMD_VIA_GET_KEYBOARD_VALUE,
    VIA_SWITCH_MATRIX_STATE,
  ]);
}

/** Get lock status */
export function getLockStatus(device: unknown): {
  isLocked: boolean;
  unlockKeys: Array<{ row: number; col: number }>;
} {
  const resp = sendAndReceive(device, [
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_UNLOCK_STATUS,
  ]);
  const isLocked = resp[0] === 0;
  const unlockKeys: Array<{ row: number; col: number }> = [];

  if (isLocked) {
    for (let i = 2; i < resp.length - 1; i += 2) {
      const row = resp[i];
      const col = resp[i + 1];
      if (row === 0 && col === 0 && i > 2) break;
      if (row !== 0xff && col !== 0xff) {
        unlockKeys.push({ row, col });
      }
    }
  }

  return { isLocked, unlockKeys };
}

/** Query supported QMK Settings IDs */
export function querySupportedQsids(device: unknown): number[] {
  const supportedQsids: number[] = [];
  let page = 0;

  while (true) {
    const resp = sendAndReceive(device, [
      CMD_VIA_VIAL_PREFIX,
      CMD_VIAL_QMK_SETTINGS_QUERY,
      page,
    ]);
    let done = false;
    for (let i = 0; i < resp.length - 1; i += 2) {
      const qsid = resp[i] | (resp[i + 1] << 8);
      if (qsid === 0xffff) {
        done = true;
        break;
      }
      if (qsid !== 0) supportedQsids.push(qsid);
    }
    if (done) break;
    page++;
    if (page > 10) break;
  }

  return supportedQsids;
}

/** Read a QMK setting value */
export function getQmkSetting(device: unknown, qsid: number): number {
  const resp = sendAndReceive(device, [
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_QMK_SETTINGS_GET,
    qsid & 0xff,
    (qsid >> 8) & 0xff,
  ]);
  return resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24);
}

/** Write a QMK setting value */
export function setQmkSetting(
  device: unknown,
  qsid: number,
  value: number,
): void {
  sendAndReceive(device, [
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_QMK_SETTINGS_SET,
    qsid & 0xff,
    (qsid >> 8) & 0xff,
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ]);
}
