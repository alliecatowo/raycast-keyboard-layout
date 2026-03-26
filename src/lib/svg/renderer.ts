import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PhysicalKey, RenderOptions, SvgResult } from "../types";
import { parseKeycode } from "../keymap/keycodes";
import { resolveEffectiveKey } from "../keymap/layer-resolver";
import { getPalette } from "./colors";
import {
  computeBoundingBox,
  detectSplitPoint,
  HEADER_HEIGHT,
  keyToPixels,
  SVG_PADDING,
} from "./geometry";
import { renderKey } from "./key-renderer";

const TMP_DIR = path.join("/tmp", "keyviz");

/** In-memory cache: hash → SvgResult */
const svgCache = new Map<string, SvgResult>();

/** Compute a hash of the render inputs to detect changes */
function computeRenderHash(physicalLayout: PhysicalKey[], options: RenderOptions): string {
  const data = JSON.stringify({
    layout: physicalLayout,
    layerIndex: options.layerIndex,
    keycodes: options.layers[options.layerIndex]?.keycodes,
    appearance: options.appearance,
    highlightKeys: options.highlightKeys,
    showGhostKeys: options.showGhostKeys,
    // Include ghost-source layers (all layers below current for ghost resolution)
    ghostLayers: options.showGhostKeys
      ? options.layers.slice(0, options.layerIndex).map((l) => l.keycodes)
      : undefined,
  });
  return crypto.createHash("md5").update(data).digest("hex").slice(0, 12);
}

/** Escape XML special characters */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  const palette = getPalette(options.appearance);
  const layer = options.layers[options.layerIndex];
  if (!layer) {
    throw new Error(`Layer ${options.layerIndex} not found`);
  }

  const splitX = detectSplitPoint(physicalLayout);
  const bbox = computeBoundingBox(physicalLayout, splitX);

  const totalWidth = bbox.width + SVG_PADDING * 2;
  const totalHeight = bbox.height + SVG_PADDING * 2 + HEADER_HEIGHT;

  const highlightSet = new Set(options.highlightKeys ?? []);
  const showGhost = options.showGhostKeys ?? true;

  const lines: string[] = [];

  // SVG header
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`,
  );

  // Background
  lines.push(`  <rect width="100%" height="100%" fill="${palette.background}" rx="12"/>`);

  // Layer name header
  const headerY = SVG_PADDING;
  const layerName = layer.name || `Layer ${layer.index}`;
  lines.push(
    `  <rect x="${SVG_PADDING}" y="${headerY}" width="${totalWidth - SVG_PADDING * 2}" height="${HEADER_HEIGHT - 8}" rx="6" fill="${palette.headerBg}"/>`,
  );
  lines.push(
    `  <text x="${totalWidth / 2}" y="${headerY + (HEADER_HEIGHT - 8) / 2}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600" ` +
      `fill="${palette.headerText}">${esc(layerName)}</text>`,
  );

  // Keys
  const keysOffsetY = HEADER_HEIGHT;

  for (let i = 0; i < physicalLayout.length; i++) {
    const physKey = physicalLayout[i];
    const rawKeycode = layer.keycodes[i] ?? "KC_NO";

    const isTransparent =
      rawKeycode === "KC_TRNS" || rawKeycode === "_______" || rawKeycode === "KC_TRANSPARENT";

    let parsed = parseKeycode(rawKeycode);
    let isGhost = false;

    // Ghost key resolution: if transparent, show the inherited key
    if (isTransparent && showGhost && options.layerIndex > 0) {
      const resolved = resolveEffectiveKey(options.layers, options.layerIndex - 1, i);
      if (resolved.parsed.category !== "none") {
        parsed = resolved.parsed;
        isGhost = true;
      }
    }

    const pos = keyToPixels(physKey, bbox.minX, bbox.minY, splitX);

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

  const result: SvgResult = { svg, filePath, width: totalWidth, height: totalHeight };
  svgCache.set(hash, result);

  return result;
}

/** Clear the SVG cache (call when board data changes) */
export function clearSvgCache(): void {
  svgCache.clear();
}
