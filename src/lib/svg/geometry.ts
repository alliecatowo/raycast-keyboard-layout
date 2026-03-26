import { PhysicalKey } from "../types";

/** Pixels per key unit (1u = one standard key) */
export const KEY_UNIT = 64;

/** Gap between keys in pixels */
export const KEY_GAP = 4;

/** Corner radius for key rectangles */
export const KEY_RADIUS = 7;

/** Inset of the keycap from the key housing (3D effect) */
export const KEYCAP_INSET = 3;

/** Padding around the entire SVG */
export const SVG_PADDING = 10;

/** Extra gap to insert between split keyboard halves */
export const SPLIT_GAP = 4;

/** Header height for layer name (0 = no header in SVG) */
export const HEADER_HEIGHT = 0;

/** Convert key units to pixels */
export function toPixels(units: number): number {
  return units * KEY_UNIT;
}

/** Detect if a keyboard is split by finding a gap > 2u in x-coordinates */
export function detectSplitPoint(keys: PhysicalKey[]): number | null {
  if (keys.length < 2) return null;

  // Find max x+w per key, sorted by x
  const sorted = [...keys].sort((a, b) => a.x - b.x);

  let maxGap = 0;
  let splitX = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prevRight = sorted[i - 1].x + sorted[i - 1].w;
    const gap = sorted[i].x - prevRight;
    if (gap > maxGap) {
      maxGap = gap;
      splitX = sorted[i].x;
    }
  }

  // Only treat as split if gap is larger than 2u
  return maxGap > 2 ? splitX : null;
}

/** Compute the bounding box of all keys, accounting for split gap */
export function computeBoundingBox(keys: PhysicalKey[], splitX: number | null): {
  width: number;
  height: number;
  minX: number;
  minY: number;
} {
  if (keys.length === 0) {
    return { width: 0, height: 0, minX: 0, minY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const key of keys) {
    // For rotated keys, use a simple approximation
    const kx = key.x;
    const ky = key.y;
    const kw = key.w;
    const kh = key.h;

    minX = Math.min(minX, kx);
    minY = Math.min(minY, ky);
    maxX = Math.max(maxX, kx + kw);
    maxY = Math.max(maxY, ky + kh);
  }

  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;

  // Add split gap if applicable
  const extraWidth = splitX !== null ? SPLIT_GAP : 0;

  return {
    width: toPixels(rawWidth) + KEY_GAP * 2 + extraWidth,
    height: toPixels(rawHeight) + KEY_GAP * 2,
    minX,
    minY,
  };
}

/** Convert a physical key position to pixel coordinates, accounting for split gap */
export function keyToPixels(
  key: PhysicalKey,
  minX: number,
  minY: number,
  splitX: number | null,
): { x: number; y: number; width: number; height: number; rotation?: { angle: number; cx: number; cy: number } } {
  const extraX = splitX !== null && key.x >= splitX ? SPLIT_GAP : 0;

  const x = toPixels(key.x - minX) + KEY_GAP + extraX;
  const y = toPixels(key.y - minY) + KEY_GAP;
  const width = toPixels(key.w) - KEY_GAP;
  const height = toPixels(key.h) - KEY_GAP;

  const result: ReturnType<typeof keyToPixels> = { x, y, width, height };

  if (key.r) {
    // Rotation around the key's center (or rx/ry if specified)
    const cx = key.rx !== undefined ? toPixels(key.rx - minX) + extraX : x + width / 2;
    const cy = key.ry !== undefined ? toPixels(key.ry - minY) : y + height / 2;
    result.rotation = { angle: key.r, cx, cy };
  }

  return result;
}
