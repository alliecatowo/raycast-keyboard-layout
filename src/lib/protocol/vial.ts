/**
 * Vial protocol implementation — runs on any TransportConnection.
 * Full board read: detect → definition (LZMA) → keymap → layout.
 */

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as nodeCrypto from "crypto";
import { BoardProfile, Layer, PhysicalKey } from "../types";
import { TransportConnection } from "../transport/types";
import { numericKeycodeToString } from "../vial/keycode-map";

// ── Protocol Constants ───────────────────────────────────

const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
const CMD_VIA_GET_LAYER_COUNT = 0x11;
const CMD_VIA_KEYMAP_GET_BUFFER = 0x12;
const CMD_VIA_VIAL_PREFIX = 0xfe;
const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
const CMD_VIAL_GET_SIZE = 0x01;
const CMD_VIAL_GET_DEFINITION = 0x02;
const PACKET_SIZE = 32;
const BUFFER_FETCH_CHUNK = 28;

// ── LZMA Decompression (Python fallback for XZ format) ───

function lzmaDecompress(compressed: Buffer): string {
  const tmpIn = path.join(os.tmpdir(), `vial-lzma-${Date.now()}.bin`);
  const tmpOut = path.join(os.tmpdir(), `vial-lzma-${Date.now()}.json`);
  try {
    fs.writeFileSync(tmpIn, compressed);
    execFileSync(
      "python3",
      [
        "-c",
        `import lzma,sys\nwith open(sys.argv[1],'rb') as f: data=f.read()\ntry: r=lzma.decompress(data,format=lzma.FORMAT_ALONE)\nexcept: r=lzma.decompress(data,format=lzma.FORMAT_AUTO)\nwith open(sys.argv[2],'wb') as f: f.write(r)`,
        tmpIn,
        tmpOut,
      ],
      { timeout: 5000 },
    );
    return fs.readFileSync(tmpOut, "utf-8");
  } finally {
    try {
      fs.unlinkSync(tmpIn);
    } catch {
      /* */
    }
    try {
      fs.unlinkSync(tmpOut);
    } catch {
      /* */
    }
  }
}

// ── KLE Layout Parser ────────────────────────────────────

interface KleKey {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  rx?: number;
  ry?: number;
  matrix: [number, number];
}

function parseKleLayout(kleData: unknown[]): KleKey[] {
  const keys: KleKey[] = [];
  let cx = 0,
    cy = 0;

  for (const row of kleData) {
    if (!Array.isArray(row)) continue;
    cx = 0;
    let cw = 1,
      ch = 1,
      cr = 0,
      crx = 0,
      cry = 0;

    for (const item of row) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const p = item as Record<string, number>;
        if ("x" in p) cx += p.x;
        if ("y" in p) cy += p.y;
        if ("w" in p) cw = p.w;
        if ("h" in p) ch = p.h;
        if ("r" in p) {
          cr = p.r;
          if ("rx" in p) crx = p.rx;
          if ("ry" in p) cry = p.ry;
          cx = crx;
          cy = cry;
        } else {
          if ("rx" in p) crx = p.rx;
          if ("ry" in p) cry = p.ry;
        }
      } else if (typeof item === "string") {
        const m = item.match(/^(\d+),(\d+)$/);
        if (m) {
          keys.push({
            x: cx,
            y: cy,
            w: cw,
            h: ch,
            r: cr || undefined,
            rx: cr ? crx : undefined,
            ry: cr ? cry : undefined,
            matrix: [parseInt(m[1], 10), parseInt(m[2], 10)],
          });
        }
        cx += cw;
        cw = 1;
        ch = 1;
      }
    }
    cy += 1;
  }
  return keys;
}

// ── Full Board Read ──────────────────────────────────────

export function readVialBoard(conn: TransportConnection): BoardProfile {
  // 1. Get Vial keyboard ID
  conn.sendAndReceive([CMD_VIA_GET_PROTOCOL_VERSION]);
  const vialResp = conn.sendAndReceive([
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_KEYBOARD_ID,
  ]);
  const uid = vialResp.subarray(4, 12).toString("hex");

  // 2. Read compressed keyboard definition
  const sizeResp = conn.sendAndReceive([
    CMD_VIA_VIAL_PREFIX,
    CMD_VIAL_GET_SIZE,
  ]);
  const defSize =
    sizeResp[0] |
    (sizeResp[1] << 8) |
    (sizeResp[2] << 16) |
    (sizeResp[3] << 24);

  const blocks = Math.ceil(defSize / PACKET_SIZE);
  const compressed = Buffer.alloc(blocks * PACKET_SIZE);
  for (let i = 0; i < blocks; i++) {
    const block = conn.sendAndReceive([
      CMD_VIA_VIAL_PREFIX,
      CMD_VIAL_GET_DEFINITION,
      i & 0xff,
      (i >> 8) & 0xff,
    ]);
    block.copy(compressed, i * PACKET_SIZE);
  }

  const definition = JSON.parse(
    lzmaDecompress(compressed.subarray(0, defSize)),
  );
  const rows = definition.matrix?.rows || 0;
  const cols = definition.matrix?.cols || 0;
  if (!rows || !cols) throw new Error("Invalid matrix dimensions");

  // 3. Read layer count + keymap buffer
  const layerResp = conn.sendAndReceive([CMD_VIA_GET_LAYER_COUNT]);
  const layerCount = layerResp[1];

  const totalBytes = layerCount * rows * cols * 2;
  const keymapBuffer = Buffer.alloc(totalBytes);
  for (let offset = 0; offset < totalBytes; offset += BUFFER_FETCH_CHUNK) {
    const chunkSize = Math.min(BUFFER_FETCH_CHUNK, totalBytes - offset);
    const resp = conn.sendAndReceive([
      CMD_VIA_KEYMAP_GET_BUFFER,
      (offset >> 8) & 0xff,
      offset & 0xff,
      chunkSize,
    ]);
    resp.copy(keymapBuffer, offset, 4, 4 + chunkSize);
  }

  // 4. Parse keymap + physical layout
  const rawLayers: number[][] = [];
  for (let layer = 0; layer < layerCount; layer++) {
    const keycodes: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (layer * rows * cols + r * cols + c) * 2;
        keycodes.push((keymapBuffer[idx] << 8) | keymapBuffer[idx + 1]);
      }
    }
    rawLayers.push(keycodes);
  }

  const physicalKeys = parseKleLayout(definition.layouts?.keymap || []);

  // 5. Reorder keycodes by physical position
  const layers: Layer[] = [];
  for (let layer = 0; layer < layerCount; layer++) {
    const ordered: string[] = [];
    for (const pk of physicalKeys) {
      const [mr, mc] = pk.matrix;
      ordered.push(numericKeycodeToString(rawLayers[layer][mr * cols + mc]));
    }
    layers.push({
      index: layer,
      name: layer === 0 ? "Base" : `Layer ${layer}`,
      keycodes: ordered,
    });
  }

  const physicalLayout: PhysicalKey[] = physicalKeys.map((k) => ({
    x: k.x,
    y: k.y,
    w: k.w,
    h: k.h,
    r: k.r,
    rx: k.rx,
    ry: k.ry,
  }));

  return {
    id: nodeCrypto.randomUUID(),
    name: definition.name || "Vial Keyboard",
    keyboard: `vial:${uid}`,
    layoutKey: "vial_usb",
    firmware: "qmk",
    layers,
    physicalLayout,
    devicePath: conn.device.path,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
