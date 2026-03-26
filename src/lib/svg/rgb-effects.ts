/**
 * RGB lighting effect simulation.
 *
 * Computes per-key colors based on the active RGB effect mode,
 * HSV base values, and key physical position. Used to overlay
 * lighting effects on the keyboard SVG.
 */

export interface RgbState {
  mode: number;
  hue: number; // 0–255
  saturation: number; // 0–255
  brightness: number; // 0–255
  speed: number; // 0–255
}

/** Convert HSV (0–255 range) to RGB hex string */
function hsvToHex(h: number, s: number, v: number): string {
  // Normalize to 0–1
  const hf = (h / 255) * 360;
  const sf = s / 255;
  const vf = v / 255;

  const c = vf * sf;
  const x = c * (1 - Math.abs(((hf / 60) % 2) - 1));
  const m = vf - c;

  let r = 0,
    g = 0,
    b = 0;
  if (hf < 60) {
    r = c;
    g = x;
  } else if (hf < 120) {
    r = x;
    g = c;
  } else if (hf < 180) {
    g = c;
    b = x;
  } else if (hf < 240) {
    g = x;
    b = c;
  } else if (hf < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);

  return `#${ri.toString(16).padStart(2, "0")}${gi.toString(16).padStart(2, "0")}${bi.toString(16).padStart(2, "0")}`;
}

/**
 * Compute the RGB color for each key based on the active effect.
 *
 * @param rgb Current RGB state from the board
 * @param keyCount Number of keys
 * @param keyPositions Array of { x, y } positions (key units)
 * @returns Array of hex color strings, one per key
 */
export function computeKeyColors(
  rgb: RgbState,
  keyPositions: Array<{ x: number; y: number }>,
): string[] {
  const { mode, hue, saturation, brightness } = rgb;

  if (brightness === 0) {
    // Lights off
    return keyPositions.map(() => "none");
  }

  switch (mode) {
    case 0: // Off
      return keyPositions.map(() => "none");

    case 1: // Solid Color
      return keyPositions.map(() => hsvToHex(hue, saturation, brightness));

    case 2: {
      // Breathing
      // Simulate mid-breath (brightness cycles, use 70% as snapshot)
      const breathBrightness = Math.round(brightness * 0.7);
      return keyPositions.map(() =>
        hsvToHex(hue, saturation, breathBrightness),
      );
    }

    case 3: {
      // Rainbow Mood — all keys same hue, hue rotates
      // Snapshot at current hue
      return keyPositions.map(() => hsvToHex(hue, saturation, brightness));
    }

    case 4: {
      // Rainbow Swirl — hue varies by position
      // Compute bounding box for normalization
      const minX = Math.min(...keyPositions.map((p) => p.x));
      const maxX = Math.max(...keyPositions.map((p) => p.x));
      const range = maxX - minX || 1;

      return keyPositions.map((pos) => {
        const offset = ((pos.x - minX) / range) * 255;
        const keyHue = (hue + offset) % 256;
        return hsvToHex(keyHue, saturation, brightness);
      });
    }

    case 5: {
      // Snake — lit segment moves across keys
      // Snapshot: light up a segment based on hue offset
      const segmentSize = Math.max(3, Math.floor(keyPositions.length * 0.15));
      const segmentStart = Math.floor(keyPositions.length * 0.3); // snapshot position

      return keyPositions.map((_, i) => {
        if (i >= segmentStart && i < segmentStart + segmentSize) {
          return hsvToHex(hue, saturation, brightness);
        }
        return "none";
      });
    }

    case 6: {
      // Knight — back and forth scanner
      const width = Math.max(2, Math.floor(keyPositions.length * 0.1));
      const center = Math.floor(keyPositions.length * 0.4);

      return keyPositions.map((_, i) => {
        const dist = Math.abs(i - center);
        if (dist <= width) {
          const fade = 1 - dist / width;
          return hsvToHex(hue, saturation, Math.round(brightness * fade));
        }
        return "none";
      });
    }

    case 8: {
      // Static Gradient — hue varies by x position
      const minX = Math.min(...keyPositions.map((p) => p.x));
      const maxX = Math.max(...keyPositions.map((p) => p.x));
      const range = maxX - minX || 1;

      return keyPositions.map((pos) => {
        const t = (pos.x - minX) / range;
        const keyHue = (hue + t * 128) % 256; // half rotation across board
        return hsvToHex(keyHue, saturation, brightness);
      });
    }

    case 14: {
      // Hue Wave — hue varies by position + time
      const minX = Math.min(...keyPositions.map((p) => p.x));
      const maxX = Math.max(...keyPositions.map((p) => p.x));
      const range = maxX - minX || 1;

      return keyPositions.map((pos) => {
        const t = (pos.x - minX) / range;
        const wave = Math.sin(t * Math.PI * 2) * 64;
        const keyHue = (hue + wave + 256) % 256;
        return hsvToHex(keyHue, saturation, brightness);
      });
    }

    case 15: {
      // Pixel Rain — random keys lit
      return keyPositions.map((_, i) => {
        // Deterministic "random" based on position
        const isLit = (i * 7 + 3) % 5 === 0;
        if (isLit) {
          const keyHue = (hue + i * 17) % 256;
          return hsvToHex(keyHue, saturation, brightness);
        }
        return "none";
      });
    }

    default: {
      // Unknown effect — just show solid color
      return keyPositions.map(() => hsvToHex(hue, saturation, brightness));
    }
  }
}
