import { execFile } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as nodeCrypto from "crypto";
import { environment } from "@raycast/api";
import { BoardProfile, Layer, PhysicalKey } from "../types";
import { numericKeycodeToString } from "./keycode-map";

/** Path to the helper script.
 * In dev mode, the extension source is at environment.extensionPath (if available)
 * or we resolve from the assetsPath. The helper lives in the source repo, not the
 * Raycast install directory, since native modules can't be bundled.
 */
function getHelperPath(): string {
  // The helper lives in the source repo alongside package.json
  // environment.assetsPath points to the installed extension's assets/ dir
  // We need to find the SOURCE directory where helper/ lives
  const candidates = [
    // Dev mode: resolve from extension source path
    path.join(environment.assetsPath, "..", "helper", "vial-reader.js"),
    // Source directory (hardcoded for dev — will be configurable later)
    path.join(process.env.HOME || "~", "Develop", "raycast-keyboard-layout", "helper", "vial-reader.js"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback
  return candidates[candidates.length - 1];
}

/** Find a working node binary that can load native modules */
function findNodeBinary(): string {
  const candidates = [
    process.env.HOME + "/.local/share/mise/installs/node/24.9.0/bin/node",
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node",
    "/usr/bin/node",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "node"; // fall back to PATH
}

interface VialDevice {
  path: string;
  manufacturer: string;
  product: string;
  serialNumber: string;
  vendorId: number;
  productId: number;
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
  const helperPath = getHelperPath();
  const nodePath = findNodeBinary();

  return new Promise((resolve, reject) => {
    execFile(
      nodePath,
      [helperPath, ...args],
      {
        timeout: 30000,
        env: {
          ...process.env,
          NODE_PATH: path.join(helperPath, "..", "node_modules"),
          VIAL_DEBUG: "1", // Enable verbose logging
        },
      },
      (error, stdout, stderr) => {
        // Always log stderr for debugging
        if (stderr) {
          console.log("[vial-helper]", stderr.trim());
        }

        if (error) {
          // Try to parse error from stdout (helper outputs JSON errors)
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.error) {
              reject(new Error(parsed.error));
              return;
            }
          } catch {
            // ignore parse error
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
          resolve(parsed);
        } catch {
          reject(new Error(`Failed to parse helper output: ${stdout.slice(0, 200)}`));
        }
      },
    );
  });
}

/** Detect connected Vial keyboards */
export async function detectVialDevices(): Promise<VialDevice[]> {
  const result = (await runHelper(["detect"])) as { devices: VialDevice[] };
  return result.devices;
}

/** Read the full keymap and layout from a Vial keyboard */
export async function readVialKeyboard(devicePath?: string): Promise<BoardProfile> {
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
    createdAt: now,
    updatedAt: now,
  };
}
