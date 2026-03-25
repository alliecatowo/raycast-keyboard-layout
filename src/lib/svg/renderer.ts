import * as fs from "fs";
import * as path from "path";
import { environment } from "@raycast/api";
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

/** Escape XML special characters */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Generate an SVG visualization of a keyboard layer */
export function generateSvg(
  physicalLayout: PhysicalKey[],
  options: RenderOptions,
): SvgResult {
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

  // Write to file in supportPath
  const fileName = `layout-layer-${options.layerIndex}.svg`;
  const filePath = path.join(environment.supportPath, fileName);

  // Ensure support directory exists
  if (!fs.existsSync(environment.supportPath)) {
    fs.mkdirSync(environment.supportPath, { recursive: true });
  }

  fs.writeFileSync(filePath, svg, "utf-8");

  return { svg, filePath, width: totalWidth, height: totalHeight };
}
