import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PhysicalKey, RenderOptions, SvgResult } from "../types";
import { parseKeycode } from "../keymap/keycodes";
import { resolveEffectiveKey } from "../keymap/layer-resolver";
import { getPalette, ThemeId } from "./colors";
import {
  computeBoundingBox,
  detectSplitPoint,
  keyToPixels,
  SVG_PADDING,
} from "./geometry";
import { renderKey } from "./key-renderer";

const TMP_DIR = path.join("/tmp", "keyviz");

/** In-memory cache: hash → SvgResult */
const svgCache = new Map<string, SvgResult>();

/** Compute a hash of the render inputs to detect changes */
function computeRenderHash(
  physicalLayout: PhysicalKey[],
  options: RenderOptions,
): string {
  const data = JSON.stringify({
    layout: physicalLayout,
    layerIndex: options.layerIndex,
    keycodes: options.layers[options.layerIndex]?.keycodes,
    appearance: options.appearance,
    theme: options.theme,
    splitView: options.splitView,
    rgbColors: options.rgbColors,
    highlightKeys: options.highlightKeys,
    showGhostKeys: options.showGhostKeys,
    ghostLayers: options.showGhostKeys
      ? options.layers.slice(0, options.layerIndex).map((l) => l.keycodes)
      : undefined,
  });
  return crypto.createHash("md5").update(data).digest("hex").slice(0, 12);
}

/**
 * Generate an SVG visualization of a keyboard layer.
 * Returns cached result if inputs haven't changed.
 */
export function generateSvg(
  physicalLayout: PhysicalKey[],
  options: RenderOptions,
): SvgResult {
  const hash = computeRenderHash(physicalLayout, options);

  // Check in-memory cache
  const cached = svgCache.get(hash);
  if (cached && fs.existsSync(cached.filePath)) {
    return cached;
  }

  const themeId = (options.theme ?? "auto") as ThemeId;
  const palette = getPalette(options.appearance, themeId);
  const layer = options.layers[options.layerIndex];
  if (!layer) {
    throw new Error(`Layer ${options.layerIndex} not found`);
  }

  // Filter keys for split view (left half, right half, or both)
  const splitView = options.splitView ?? "both";
  const rawSplitX = detectSplitPoint(physicalLayout);

  let renderLayout = physicalLayout;
  let renderKeycodes = layer.keycodes;
  let renderSplitX = rawSplitX;

  if (rawSplitX !== null && splitView !== "both") {
    const indices: number[] = [];
    for (let i = 0; i < physicalLayout.length; i++) {
      const isRight = physicalLayout[i].x >= rawSplitX;
      if (
        (splitView === "left" && !isRight) ||
        (splitView === "right" && isRight)
      ) {
        indices.push(i);
      }
    }
    renderLayout = indices.map((i) => physicalLayout[i]);
    renderKeycodes = indices.map((i) => layer.keycodes[i] ?? "KC_NO");
    renderSplitX = null; // No split gap when showing one half
  }

  const bbox = computeBoundingBox(renderLayout, renderSplitX);

  const totalWidth = bbox.width + SVG_PADDING * 2;
  const totalHeight = bbox.height + SVG_PADDING * 2;

  const highlightSet = new Set(options.highlightKeys ?? []);
  const showGhost = options.showGhostKeys ?? true;

  const lines: string[] = [];

  // SVG header
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`,
  );

  // No background, no header — SVG is transparent, layer name in Raycast's nav
  const keysOffsetY = 0;

  for (let i = 0; i < renderLayout.length; i++) {
    const physKey = renderLayout[i];
    const rawKeycode = renderKeycodes[i] ?? "KC_NO";

    const isTransparent =
      rawKeycode === "KC_TRNS" ||
      rawKeycode === "_______" ||
      rawKeycode === "KC_TRANSPARENT";

    let parsed = parseKeycode(rawKeycode);
    let isGhost = false;

    // Ghost key resolution: if transparent, show the inherited key
    if (isTransparent && showGhost && options.layerIndex > 0) {
      const resolved = resolveEffectiveKey(
        options.layers,
        options.layerIndex - 1,
        i,
      );
      if (resolved.parsed.category !== "none") {
        parsed = resolved.parsed;
        isGhost = true;
      }
    }

    const pos = keyToPixels(physKey, bbox.minX, bbox.minY, renderSplitX);

    lines.push(
      renderKey({
        x: SVG_PADDING + pos.x,
        y: SVG_PADDING + keysOffsetY + pos.y,
        width: pos.width,
        height: pos.height,
        parsed,
        palette,
        isHighlighted: highlightSet.has(i),
        isGhost,
        rgbColor: options.rgbColors?.[i],
        rotation: pos.rotation
          ? {
              angle: pos.rotation.angle,
              cx: SVG_PADDING + pos.rotation.cx,
              cy: SVG_PADDING + keysOffsetY + pos.rotation.cy,
            }
          : undefined,
      }),
    );
  }

  lines.push("</svg>");

  const svg = lines.join("\n");

  // Write SVG to a temp path (no spaces — breaks markdown image syntax)
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  // Use hash in filename so different renders don't collide
  const fileName = `layout-${hash}.svg`;
  const filePath = path.join(TMP_DIR, fileName);
  fs.writeFileSync(filePath, svg, "utf-8");

  const result: SvgResult = {
    svg,
    filePath,
    width: totalWidth,
    height: totalHeight,
  };
  svgCache.set(hash, result);

  return result;
}

/** Clear the SVG cache and delete stale files */
export function clearSvgCache(): void {
  svgCache.clear();
  cleanupStaleSvgs();
}

/** Remove SVG files older than 1 hour from the temp directory */
function cleanupStaleSvgs(): void {
  try {
    if (!fs.existsSync(TMP_DIR)) return;
    const files = fs.readdirSync(TMP_DIR);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const file of files) {
      if (!file.endsWith(".svg")) continue;
      const filePath = path.join(TMP_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      } catch {
        /* ignore individual file errors */
      }
    }
  } catch {
    /* ignore cleanup errors */
  }
}

// Run cleanup on module load (once per session)
cleanupStaleSvgs();
