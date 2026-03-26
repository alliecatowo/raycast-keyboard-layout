/**
 * USB Serial transport via POSIX (stty + fs).
 * Used by ZMK Studio keyboards over USB CDC-ACM.
 * No native modules — pure Node.js.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import { DiscoveredDevice, Transport, TransportConnection } from "./types";

// ZMK Studio framing bytes
const FRAMING_SOF = 0xab;
const FRAMING_ESC = 0xac;
const FRAMING_EOF = 0xad;

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
      current.push(escaped ? byte : byte);
      escaped = false;
    }
  }

  return frames;
}

export class SerialTransport implements Transport {
  readonly name = "USB Serial";
  private baudRate: number;

  constructor(baudRate = 12500) {
    this.baudRate = baudRate;
  }

  async discover(): Promise<DiscoveredDevice[]> {
    if (os.platform() !== "darwin") return [];

    try {
      const result = execSync(
        "ls /dev/tty.usb* /dev/tty.usbmodem* 2>/dev/null || true",
        { encoding: "utf-8", timeout: 2000 },
      );
      return result
        .trim()
        .split("\n")
        .filter((p) => p.length > 0)
        .map((portPath) => ({
          path: portPath,
          name: portPath.split("/").pop() || "Serial Device",
          transportType: "serial" as const,
        }));
    } catch {
      return [];
    }
  }

  connect(device: DiscoveredDevice): TransportConnection {
    // Configure baud rate
    execSync(
      `stty -f ${device.path} ${this.baudRate} raw -echo -echoe -echok`,
      {
        timeout: 2000,
      },
    );

    const fd = fs.openSync(
      device.path,
      fs.constants.O_RDWR | fs.constants.O_NONBLOCK,
    );

    return {
      device,
      sendAndReceive(data: number[], timeout = 2000): Buffer {
        const payload = Buffer.from(data);
        const framed = frameEncode(payload);
        fs.writeSync(fd, framed);

        // Read with timeout
        const buf = Buffer.alloc(4096);
        const startTime = Date.now();
        let totalRead = 0;

        while (Date.now() - startTime < timeout) {
          try {
            const bytesRead = fs.readSync(
              fd,
              buf,
              totalRead,
              buf.length - totalRead,
              null,
            );
            if (bytesRead > 0) {
              totalRead += bytesRead;
              if (buf[totalRead - 1] === FRAMING_EOF) break;
            }
          } catch (e: unknown) {
            const err = e as NodeJS.ErrnoException;
            if (err.code === "EAGAIN" || err.code === "EWOULDBLOCK") {
              const waitUntil = Date.now() + 5;
              while (Date.now() < waitUntil) {
                /* spin */
              }
              continue;
            }
            throw e;
          }
        }

        if (totalRead === 0) throw new Error("Serial read timeout");

        // Return first decoded frame
        const frames = frameDecode(buf.subarray(0, totalRead));
        if (frames.length === 0) throw new Error("No valid frame received");
        return frames[0];
      },
      close() {
        try {
          fs.closeSync(fd);
        } catch {
          /* */
        }
      },
    };
  }
}

/** Pre-configured serial transport for ZMK Studio (12500 baud) */
export const zmkSerialTransport = new SerialTransport(12500);
