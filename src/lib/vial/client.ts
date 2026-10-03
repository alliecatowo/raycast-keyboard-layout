import { execFile, execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as nodeCrypto from "crypto";
import { environment } from "@raycast/api";
import { BoardProfile, Layer, PhysicalKey } from "../types";
import { numericKeycodeToString } from "./keycode-map";
import {
  ensureHelperDir,
  findNodeBinary,
  helperEnv,
  parseHelperResult,
  zmkBindingToKeycode,
} from "./helper-env";

let helperDirCache: string | undefined;
function getHelperDir(): string {
  if (helperDirCache) return helperDirCache;
  helperDirCache = ensureHelperDir({
    bundledDir: path.join(environment.assetsPath, "helper"),
    supportDir: environment.supportPath,
    install: (cwd) => {
      const node = findNodeBinary();
      const npm = path.join(
        path.dirname(node),
        process.platform === "win32" ? "npm.cmd" : "npm",
      );
      execFileSync(
        fs.existsSync(npm) ? npm : "npm",
        ["install", "--omit=dev", "--no-audit", "--no-fund"],
        {
          cwd,
          timeout: 180000,
          env: {
            ...process.env,
            PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH ?? ""}`,
          },
        },
      );
    },
  });
  return helperDirCache;
}

function getHelperPath(): string {
  return path.join(getHelperDir(), "vial-reader.js");
}

interface VialDevice {
  path: string;
  manufacturer: string;
  product: string;
  serialNumber: string;
  vendorId: number;
  productId: number;
}

interface ZmkReadResult {
  firmware: "zmk";
  name: string;
  serialNumber: string;
  physicalLayout: PhysicalKey[];
  layers: Array<{
    index: number;
    name: string;
    bindings: Array<{
      behavior: string;
      behaviorId: number;
      param1: number;
      param2: number;
    }>;
  }>;
  behaviorNames: Record<number, string>;
}

interface VialReadResult {
  viaProtocol: number;
  vialProtocol: number;
  uid: string;
  name: string;
  vendorId?: string;
  productId?: string;
  matrix: { rows: number; cols: number };
  layerCount: number;
  layers: number[][]; // numeric keycodes per layer, ordered by physical position
  physicalLayout: PhysicalKey[];
  layoutOptions: string[];
}

/** Run the helper process and parse JSON output */
function runHelper(args: string[]): Promise<unknown> {
  let helperPath: string;
  try {
    helperPath = getHelperPath();
  } catch (e) {
    return Promise.reject(e);
  }
  const nodePath = findNodeBinary();

  return new Promise((resolve, reject) => {
    execFile(
      nodePath,
      [helperPath, ...args],
      { timeout: 30000, env: helperEnv(helperPath) },
      (error, stdout, stderr) => {
        if (stderr && process.env.VIAL_DEBUG === "1") {
          console.log("[vial-helper]", stderr.trim());
        }
        const result = parseHelperResult(error, stdout, stderr);
        if (result.ok) resolve(result.value);
        else reject(result.error);
      },
    );
  });
}

/** Detect connected Vial keyboards (HID) */
export async function detectVialDevices(): Promise<VialDevice[]> {
  try {
    const result = (await runHelper(["detect"])) as { devices: VialDevice[] };
    return result.devices;
  } catch {
    return [];
  }
}

/** Detect connected ZMK Studio keyboards (serial) */
export async function detectZmkDevices(): Promise<VialDevice[]> {
  try {
    const zmkHelperPath = getHelperPath().replace(
      "vial-reader.js",
      "zmk-reader.js",
    );
    const nodePath = findNodeBinary();

    return new Promise((resolve) => {
      execFile(
        nodePath,
        [zmkHelperPath, "detect"],
        {
          timeout: 15000,
          env: helperEnv(zmkHelperPath),
        },
        (error, stdout, stderr) => {
          if (stderr) console.log("[zmk-helper]", stderr.trim());
          if (error) {
            resolve([]);
            return;
          }
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed.devices || []);
          } catch {
            resolve([]);
          }
        },
      );
    });
  } catch {
    return [];
  }
}

/** Detect ALL connected keyboards (Vial + ZMK) */
export async function detectAllDevices(): Promise<VialDevice[]> {
  const [vial, zmk] = await Promise.all([
    detectVialDevices(),
    detectZmkDevices(),
  ]);
  return [...vial, ...zmk];
}

/** Read a ZMK Studio keyboard over serial */
export async function readZmkKeyboard(portPath: string): Promise<BoardProfile> {
  const zmkHelperPath = getHelperPath().replace(
    "vial-reader.js",
    "zmk-reader.js",
  );
  const nodePath = findNodeBinary();

  const result = await new Promise<ZmkReadResult>((resolve, reject) => {
    execFile(
      nodePath,
      [zmkHelperPath, "read", portPath],
      {
        timeout: 30000,
        env: helperEnv(zmkHelperPath),
      },
      (error, stdout, stderr) => {
        if (stderr) console.log("[zmk-helper]", stderr.trim());
        if (error) {
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.error) {
              reject(new Error(parsed.error));
              return;
            }
          } catch {
            /* ignore */
          }
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) {
            reject(new Error(parsed.error));
            return;
          }
          resolve(parsed as ZmkReadResult);
        } catch {
          reject(new Error("Failed to parse ZMK helper output"));
        }
      },
    );
  });

  // Convert ZMK bindings to display-friendly keycodes
  const layers: Layer[] = result.layers.map((layer, index) => ({
    index,
    name: layer.name || `Layer ${index}`,
    keycodes: layer.bindings.map((b) =>
      zmkBindingToKeycode(b, numericKeycodeToString),
    ),
  }));

  const now = new Date().toISOString();

  return {
    id: nodeCrypto.randomUUID(),
    name: result.name || "ZMK Keyboard",
    keyboard: `zmk:${result.serialNumber || "unknown"}`,
    layoutKey: "zmk_studio",
    firmware: "zmk",
    layers,
    physicalLayout: result.physicalLayout,
    devicePath: portPath,
    createdAt: now,
    updatedAt: now,
  };
}

/** Read all QMK settings + RGB from the board */
export async function readBoardSettings(): Promise<{
  vialProtocol: number;
  lightingType: string;
  settings: Record<
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
  >;
  rgb: {
    brightness: number;
    effect: number;
    speed: number;
    hue: number;
    saturation: number;
  } | null;
}> {
  return (await runHelper(["settings"])) as never;
}

/** Write a single QMK setting */
export async function writeBoardSetting(
  qsid: number,
  value: number,
): Promise<void> {
  await runHelper(["set-setting", String(qsid), String(value)]);
}

/** Write RGB values */
export async function writeRgb(
  brightness: number,
  effect: number,
  speed: number,
  hue: number,
  saturation: number,
): Promise<void> {
  await runHelper([
    "set-rgb",
    String(brightness),
    String(effect),
    String(speed),
    String(hue),
    String(saturation),
  ]);
}

/** Get a quick hash of the current keymap to detect changes */
export async function readKeymapHash(): Promise<{
  hash: string;
  layerCount: number;
}> {
  const result = (await runHelper(["keymap-hash"])) as {
    hash: string;
    layerCount: number;
    rows: number;
    cols: number;
  };
  return result;
}

/** Check if the keyboard is locked and get unlock key positions */
export async function readLockStatus(): Promise<{
  isLocked: boolean;
  unlockInProgress: boolean;
  unlockKeys: Array<{ row: number; col: number }>;
}> {
  const result = (await runHelper(["lock-status"])) as {
    isLocked: boolean;
    unlockInProgress: boolean;
    unlockKeys: Array<{ row: number; col: number }>;
  };
  return result;
}

/** Read the switch matrix state (which keys are physically pressed) */
export async function readMatrixState(): Promise<{
  rows: number;
  cols: number;
  pressed: Array<{ row: number; col: number }>;
}> {
  const result = (await runHelper(["matrix"])) as {
    rows: number;
    cols: number;
    pressed: Array<{ row: number; col: number }>;
  };
  return result;
}

/** Read lock status from a ZMK board */
export async function readZmkLockStatus(portPath: string): Promise<{
  isLocked: boolean;
  unlockInProgress: boolean;
  unlockKeys: Array<{ row: number; col: number }>;
}> {
  const zmkHelperPath = getHelperPath().replace(
    "vial-reader.js",
    "zmk-reader.js",
  );
  const nodePath = findNodeBinary();

  return new Promise((resolve, reject) => {
    execFile(
      nodePath,
      [zmkHelperPath, "lock-status", portPath],
      {
        timeout: 10000,
        env: helperEnv(zmkHelperPath),
      },
      (error, stdout, stderr) => {
        if (stderr) console.log("[zmk-helper]", stderr.trim());
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("Parse error"));
        }
      },
    );
  });
}

/** Write a layer name to a ZMK board (persists to firmware) */
export async function writeZmkLayerName(
  portPath: string,
  layerId: number,
  name: string,
): Promise<void> {
  const zmkHelperPath = getHelperPath().replace(
    "vial-reader.js",
    "zmk-reader.js",
  );
  const nodePath = findNodeBinary();

  return new Promise((resolve, reject) => {
    execFile(
      nodePath,
      [zmkHelperPath, "set-layer-name", portPath, String(layerId), name],
      {
        timeout: 10000,
        env: helperEnv(zmkHelperPath),
      },
      (error, stdout, stderr) => {
        if (stderr) console.log("[zmk-helper]", stderr.trim());
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          const result = JSON.parse(stdout);
          if (result.error) reject(new Error(result.error));
          else resolve();
        } catch {
          reject(new Error("Parse error"));
        }
      },
    );
  });
}

/** Read the full keymap and layout from a Vial keyboard */
export async function readVialKeyboard(
  devicePath?: string,
): Promise<BoardProfile> {
  const args = ["read"];
  if (devicePath) args.push(devicePath);

  const result = (await runHelper(args)) as VialReadResult;

  // Convert numeric keycodes to QMK string names
  const layers: Layer[] = result.layers.map((numericLayer, index) => ({
    index,
    name: `Layer ${index}`,
    keycodes: numericLayer.map(numericKeycodeToString),
  }));

  // Auto-name layers using the same heuristics as the parser
  if (layers.length > 0) {
    layers[0].name = "Base";
  }

  const now = new Date().toISOString();

  return {
    id: nodeCrypto.randomUUID(),
    name: result.name || "Vial Keyboard",
    keyboard: `vial:${result.uid}`,
    layoutKey: "vial_usb",
    firmware: "qmk",
    layers,
    physicalLayout: result.physicalLayout,
    devicePath,
    createdAt: now,
    updatedAt: now,
  };
}
