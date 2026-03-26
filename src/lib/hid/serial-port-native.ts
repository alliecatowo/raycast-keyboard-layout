/**
 * Native serial port communication using Node.js fs + stty.
 * No native modules needed — works in Raycast Store.
 *
 * On macOS, serial ports are just /dev/tty.* files. We:
 * 1. Use stty to configure baud rate
 * 2. Use fs.openSync/readSync/writeSync for I/O
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";

const READ_TIMEOUT_MS = 2000;

export interface SerialConnection {
  fd: number;
  path: string;
}

/** List available serial ports on macOS */
export function listSerialPorts(): string[] {
  if (os.platform() !== "darwin") return [];

  try {
    const result = execSync(
      "ls /dev/tty.usb* /dev/tty.usbmodem* 2>/dev/null || true",
      {
        encoding: "utf-8",
        timeout: 2000,
      },
    );
    return result
      .trim()
      .split("\n")
      .filter((p) => p.length > 0);
  } catch {
    return [];
  }
}

/** Open a serial port at the specified baud rate */
export function openSerialPort(
  portPath: string,
  baudRate = 12500,
): SerialConnection {
  // Configure baud rate with stty
  try {
    execSync(`stty -f ${portPath} ${baudRate} raw -echo -echoe -echok`, {
      timeout: 2000,
    });
  } catch (e) {
    throw new Error(
      `Failed to configure serial port ${portPath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Open the port for read/write
  const fd = fs.openSync(
    portPath,
    fs.constants.O_RDWR | fs.constants.O_NONBLOCK,
  );

  return { fd, path: portPath };
}

/** Close a serial port */
export function closeSerialPort(conn: SerialConnection): void {
  try {
    fs.closeSync(conn.fd);
  } catch {
    // Ignore close errors
  }
}

/** Write data to serial port */
export function writeSerial(conn: SerialConnection, data: Buffer): void {
  fs.writeSync(conn.fd, data);
}

/** Read data from serial port with timeout */
export function readSerial(
  conn: SerialConnection,
  maxBytes: number,
  timeout = READ_TIMEOUT_MS,
): Buffer {
  const buf = Buffer.alloc(maxBytes);
  const startTime = Date.now();
  let totalRead = 0;

  while (Date.now() - startTime < timeout) {
    try {
      const bytesRead = fs.readSync(
        conn.fd,
        buf,
        totalRead,
        maxBytes - totalRead,
        null,
      );
      if (bytesRead > 0) {
        totalRead += bytesRead;
        // Check if we have a complete frame (ends with EOF byte 0xAD)
        if (buf[totalRead - 1] === 0xad) break;
      }
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "EAGAIN" || err.code === "EWOULDBLOCK") {
        // Non-blocking read, no data yet — small busy-wait
        const waitUntil = Date.now() + 10;
        while (Date.now() < waitUntil) {
          // spin
        }
        continue;
      }
      throw e;
    }
  }

  if (totalRead === 0) throw new Error("Serial read timeout");
  return buf.subarray(0, totalRead);
}
