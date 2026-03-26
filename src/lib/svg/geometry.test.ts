import { describe, it, expect } from "vitest";
import {
  toPixels,
  detectSplitPoint,
  computeBoundingBox,
  keyToPixels,
  KEY_UNIT,
  SPLIT_GAP,
} from "./geometry";
import { PhysicalKey } from "../types";

describe("toPixels", () => {
  it("converts key units to pixels", () => {
    expect(toPixels(1)).toBe(KEY_UNIT);
    expect(toPixels(2)).toBe(KEY_UNIT * 2);
    expect(toPixels(0)).toBe(0);
  });
});

describe("detectSplitPoint", () => {
  it("returns null for non-split keyboards", () => {
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
      { x: 2, y: 0, w: 1, h: 1 },
    ];
    expect(detectSplitPoint(keys)).toBeNull();
  });

  it("detects split point when gap > 2u", () => {
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
      // 3u gap
      { x: 5, y: 0, w: 1, h: 1 },
      { x: 6, y: 0, w: 1, h: 1 },
    ];
    expect(detectSplitPoint(keys)).toBe(5);
  });

  it("returns null for small gaps", () => {
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 2, y: 0, w: 1, h: 1 }, // 1u gap
    ];
    expect(detectSplitPoint(keys)).toBeNull();
  });

  it("handles empty array", () => {
    expect(detectSplitPoint([])).toBeNull();
  });
});

describe("computeBoundingBox", () => {
  it("computes bounding box for simple layout", () => {
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
      { x: 0, y: 1, w: 1, h: 1 },
    ];
    const bbox = computeBoundingBox(keys, null);
    expect(bbox.minX).toBe(0);
    expect(bbox.minY).toBe(0);
    expect(bbox.width).toBeGreaterThan(0);
    expect(bbox.height).toBeGreaterThan(0);
  });

  it("adds split gap when split point exists", () => {
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 5, y: 0, w: 1, h: 1 },
    ];
    const withSplit = computeBoundingBox(keys, 5);
    const withoutSplit = computeBoundingBox(keys, null);
    expect(withSplit.width).toBe(withoutSplit.width + SPLIT_GAP);
  });

  it("handles empty keys", () => {
    const bbox = computeBoundingBox([], null);
    expect(bbox.width).toBe(0);
    expect(bbox.height).toBe(0);
  });
});

describe("keyToPixels", () => {
  it("converts key position to pixel coordinates", () => {
    const key: PhysicalKey = { x: 1, y: 2, w: 1, h: 1 };
    const result = keyToPixels(key, 0, 0, null);
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("adds split gap for keys after split point", () => {
    const key: PhysicalKey = { x: 5, y: 0, w: 1, h: 1 };
    const withSplit = keyToPixels(key, 0, 0, 5);
    const withoutSplit = keyToPixels(key, 0, 0, null);
    expect(withSplit.x).toBe(withoutSplit.x + SPLIT_GAP);
  });

  it("handles key rotation", () => {
    const key: PhysicalKey = { x: 0, y: 0, w: 1, h: 1, r: 15, rx: 1, ry: 1 };
    const result = keyToPixels(key, 0, 0, null);
    expect(result.rotation).toBeDefined();
    expect(result.rotation?.angle).toBe(15);
  });

  it("has no rotation for non-rotated keys", () => {
    const key: PhysicalKey = { x: 0, y: 0, w: 1, h: 1 };
    const result = keyToPixels(key, 0, 0, null);
    expect(result.rotation).toBeUndefined();
  });
});
