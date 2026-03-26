/**
 * LZMA decompression for Vial keyboard definitions.
 *
 * Vial firmware compresses the keyboard JSON definition with LZMA1
 * (the "alone" format with a 13-byte header). We try multiple approaches
 * to handle different LZMA variants.
 */

const LZMA = require("lzma");

/**
 * Decompress LZMA-compressed data to a UTF-8 string.
 * @param {Buffer} compressed - The compressed data
 * @returns {string} The decompressed string
 */
function lzmaDecompress(compressed) {
  // The LZMA "alone" format has a 13-byte header:
  // - 1 byte: LZMA properties (lc, lp, pb)
  // - 4 bytes: dictionary size (little-endian)
  // - 8 bytes: uncompressed size (little-endian, 0xFFFFFFFFFFFFFFFF = unknown)

  // Validate header
  if (compressed.length < 13) {
    throw new Error(`Data too short for LZMA (${compressed.length} bytes)`);
  }

  const props = compressed[0];
  const dictSize =
    compressed[1] |
    (compressed[2] << 8) |
    (compressed[3] << 16) |
    (compressed[4] << 24);

  process.stderr.write(
    `[vial] LZMA header: props=0x${props.toString(16)}, dictSize=${dictSize}, dataLen=${compressed.length}\n`
  );

  // Try the lzma package's decompress function
  // It expects an array of bytes (not a Buffer)
  const byteArray = Array.from(compressed);

  try {
    const result = LZMA.decompress(byteArray);
    if (typeof result === "string") {
      return result;
    }
    if (Array.isArray(result) || result instanceof Uint8Array) {
      return Buffer.from(result).toString("utf-8");
    }
    return String(result);
  } catch (e1) {
    process.stderr.write(`[vial] LZMA.decompress attempt 1 failed: ${e1.message}\n`);

    // Try with the LZMA.LZMA().decompress if available
    try {
      if (LZMA.LZMA) {
        const lzma = LZMA.LZMA();
        const result = lzma.decompress(byteArray);
        if (typeof result === "string") return result;
        return Buffer.from(result).toString("utf-8");
      }
    } catch (e2) {
      process.stderr.write(`[vial] LZMA attempt 2 failed: ${e2.message}\n`);
    }

    // Try using Node's child_process to call Python for decompression
    // This is the most reliable fallback since Vial's own code uses Python's lzma
    try {
      const result = decompressWithPython(compressed);
      return result;
    } catch (e3) {
      process.stderr.write(`[vial] Python fallback failed: ${e3.message}\n`);
    }

    throw new Error(
      `All LZMA decompression methods failed. Original error: ${e1.message}. ` +
        `Data starts with: [${compressed.subarray(0, 20).toString("hex")}]`
    );
  }
}

/**
 * Fallback: use Python's built-in lzma module for decompression
 */
function decompressWithPython(compressed) {
  const { execFileSync } = require("child_process");

  // Write compressed data to a temp file, decompress with Python
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  const tmpIn = path.join(os.tmpdir(), `vial-lzma-${Date.now()}.bin`);
  const tmpOut = path.join(os.tmpdir(), `vial-lzma-${Date.now()}.json`);

  try {
    fs.writeFileSync(tmpIn, compressed);

    const pythonScript = `
import lzma
import sys

with open(sys.argv[1], 'rb') as f:
    data = f.read()

try:
    result = lzma.decompress(data, format=lzma.FORMAT_ALONE)
except Exception:
    result = lzma.decompress(data, format=lzma.FORMAT_AUTO)

with open(sys.argv[2], 'wb') as f:
    f.write(result)
`;

    execFileSync("python3", ["-c", pythonScript, tmpIn, tmpOut], {
      timeout: 5000,
    });

    return fs.readFileSync(tmpOut, "utf-8");
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

module.exports = { lzmaDecompress };
