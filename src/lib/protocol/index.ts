/**
 * Protocol convenience functions — open a transport, run a protocol operation, close.
 * These are the functions commands should import.
 */

import { vialHidTransport } from "../transport";
import {
  readVialBoard,
  getVialLockStatus,
  getVialMatrixState,
  getVialKeymapHash,
  queryVialQsids,
  getVialQmkSetting,
  setVialQmkSetting,
  getVialRgb,
  setVialRgb,
} from "./vial";
import { BoardProfile } from "../types";

// QSID metadata (same as was in helper)
const QSID_NAMES: Record<
  number,
  {
    name: string;
    tab: string;
    unit?: string;
    type?: string;
    min?: number;
    max?: number;
  }
> = {
  2: { name: "Combo Term", tab: "Combo", unit: "ms", min: 0, max: 10000 },
  3: { name: "Auto Shift Flags", tab: "Auto Shift" },
  4: {
    name: "Auto Shift Timeout",
    tab: "Auto Shift",
    unit: "ms",
    min: 0,
    max: 1000,
  },
  5: { name: "One Shot Tap Count", tab: "One Shot", min: 0, max: 50 },
  6: {
    name: "One Shot Timeout",
    tab: "One Shot",
    unit: "ms",
    min: 0,
    max: 60000,
  },
  7: { name: "Tapping Term", tab: "Tap-Hold", unit: "ms", min: 0, max: 10000 },
  8: { name: "Tap-Hold Flags (legacy)", tab: "Tap-Hold" },
  18: {
    name: "Tap Code Delay",
    tab: "Tap-Hold",
    unit: "ms",
    min: 0,
    max: 1000,
  },
  19: {
    name: "Tap Hold Caps Delay",
    tab: "Tap-Hold",
    unit: "ms",
    min: 0,
    max: 1000,
  },
  20: { name: "Tapping Toggle Count", tab: "Tap-Hold", min: 0, max: 100 },
  21: { name: "Magic Flags", tab: "Magic" },
  22: { name: "Permissive Hold", tab: "Tap-Hold", type: "bool" },
  23: { name: "Hold On Other Key Press", tab: "Tap-Hold", type: "bool" },
  24: { name: "Retro Tapping", tab: "Tap-Hold", type: "bool" },
  25: {
    name: "Quick Tap Term",
    tab: "Tap-Hold",
    unit: "ms",
    min: 0,
    max: 10000,
  },
  26: { name: "Chordal Hold", tab: "Tap-Hold", type: "bool" },
  27: {
    name: "Flow Tap Term",
    tab: "Tap-Hold",
    unit: "ms",
    min: 0,
    max: 10000,
  },
};

/** Helper: run an operation with an auto-opened/closed Vial connection */
function withVialConnection<T>(
  devicePath: string | undefined,
  fn: (conn: ReturnType<typeof vialHidTransport.connect>) => T,
): T {
  const devices = devicePath
    ? [{ path: devicePath, name: "", transportType: "hid" as const }]
    : [];

  // If no specific path, detect first device
  const device = devices[0];
  if (!device) {
    // Synchronous detection isn't great but matches old API
    throw new Error("No device path provided — use board.devicePath");
  }

  const conn = vialHidTransport.connect(device);
  try {
    return fn(conn);
  } finally {
    conn.close();
  }
}

// ── Exported convenience functions (same signatures as old client.ts) ──

export function readVialKeyboard(devicePath?: string): Promise<BoardProfile> {
  return Promise.resolve(withVialConnection(devicePath, readVialBoard));
}

export function readLockStatus(devicePath?: string) {
  return Promise.resolve(
    withVialConnection(devicePath, (conn) => ({
      ...getVialLockStatus(conn),
      unlockInProgress: false,
    })),
  );
}

export function readMatrixState(devicePath?: string) {
  return Promise.resolve(
    withVialConnection(devicePath, (conn) => {
      // We need rows/cols — read definition first
      // For now, use a reasonable default
      const pressed = getVialMatrixState(conn, 10, 6);
      return { rows: 10, cols: 6, pressed };
    }),
  );
}

export function readKeymapHash(devicePath?: string) {
  return Promise.resolve(
    withVialConnection(devicePath, (conn) => ({
      hash: getVialKeymapHash(conn),
      layerCount: 0,
    })),
  );
}

export function readBoardSettings(devicePath?: string) {
  return Promise.resolve(
    withVialConnection(devicePath, (conn) => {
      // Query supported QSIDs
      const qsids = queryVialQsids(conn);
      const settings: Record<
        number,
        {
          name: string;
          tab: string;
          qsid: number;
          value: number;
          unit?: string;
          type?: string;
          min?: number;
          max?: number;
        }
      > = {};

      for (const qsid of qsids) {
        const value = getVialQmkSetting(conn, qsid);
        const meta = QSID_NAMES[qsid] || {
          name: `Setting ${qsid}`,
          tab: "Other",
        };
        settings[qsid] = { ...meta, qsid, value };
      }

      const rgb = getVialRgb(conn);

      return {
        vialProtocol: 6,
        lightingType: rgb ? "qmk_rgblight" : "none",
        settings,
        rgb,
      };
    }),
  );
}

export function writeBoardSetting(
  qsid: number,
  value: number,
  devicePath?: string,
) {
  return Promise.resolve(
    withVialConnection(devicePath, (conn) => {
      setVialQmkSetting(conn, qsid, value);
    }),
  );
}

export function writeRgb(
  brightness: number,
  effect: number,
  speed: number,
  hue: number,
  saturation: number,
  devicePath?: string,
) {
  return Promise.resolve(
    withVialConnection(devicePath, (conn) => {
      setVialRgb(conn, brightness, effect, speed, hue, saturation);
    }),
  );
}

// ── ZMK convenience functions ──

import { zmkSerialTransport } from "../transport";
import {
  readZmkBoard as readZmkBoardRaw,
  getLockState as getZmkLockStateRaw,
  setLayerName as setZmkLayerNameRaw,
} from "./zmk-studio";

export function readZmkKeyboard(portPath: string): Promise<BoardProfile> {
  const conn = zmkSerialTransport.connect({
    path: portPath,
    name: "",
    transportType: "serial",
  });
  try {
    return Promise.resolve(readZmkBoardRaw(conn));
  } finally {
    conn.close();
  }
}

export function readZmkLockStatus(portPath: string) {
  const conn = zmkSerialTransport.connect({
    path: portPath,
    name: "",
    transportType: "serial",
  });
  try {
    const isLocked = getZmkLockStateRaw(conn);
    return Promise.resolve({
      isLocked,
      unlockInProgress: false,
      unlockKeys: [] as Array<{ row: number; col: number }>,
    });
  } finally {
    conn.close();
  }
}

export function writeZmkLayerName(
  portPath: string,
  layerId: number,
  name: string,
) {
  const conn = zmkSerialTransport.connect({
    path: portPath,
    name: "",
    transportType: "serial",
  });
  try {
    setZmkLayerNameRaw(conn, layerId, name);
    return Promise.resolve();
  } finally {
    conn.close();
  }
}
