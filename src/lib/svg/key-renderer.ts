import { ColorPalette, getCategoryColor } from "./colors";
import { KEY_RADIUS, KEYCAP_INSET } from "./geometry";
import { ParsedKeycode } from "../keymap/keycodes";

/** Escape XML special characters */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface KeyRenderParams {
  x: number;
  y: number;
  width: number;
  height: number;
  parsed: ParsedKeycode;
  palette: ColorPalette;
  isHighlighted: boolean;
  isGhost: boolean; // Inherited from lower layer (50% opacity)
  rotation?: { angle: number; cx: number; cy: number };
}

/** Render a single key as SVG elements */
export function renderKey(params: KeyRenderParams): string {
  const { x, y, width, height, parsed, palette, isHighlighted, isGhost, rotation } = params;
  const lines: string[] = [];

  // Determine colors
  const categoryFill = getCategoryColor(parsed.category, palette);
  const isTransparent = parsed.category === "transparent";
  const isNone = parsed.category === "none";

  let capFill = categoryFill;
  let strokeColor = palette.keyStroke;
  let textColor = palette.keyText;
  let strokeDash = "";

  if (isHighlighted) {
    capFill = palette.highlightFill;
    strokeColor = palette.highlightStroke;
  } else if (isGhost) {
    textColor = palette.ghostText;
    strokeColor = palette.ghostStroke;
    capFill = "none";
    strokeDash = ` stroke-dasharray="4 3"`;
  } else if (isTransparent) {
    capFill = palette.transparent;
    strokeDash = ` stroke-dasharray="4 3"`;
    textColor = palette.secondaryText;
  } else if (isNone) {
    capFill = palette.none;
    textColor = palette.secondaryText;
  }

  // Open group (with rotation if needed)
  const transform = rotation
    ? ` transform="rotate(${rotation.angle}, ${rotation.cx}, ${rotation.cy})"`
    : "";
  lines.push(`  <g${transform}>`);

  // Key housing (outer rect)
  lines.push(
    `    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${KEY_RADIUS}" ` +
      `fill="${palette.keyFill}" stroke="${strokeColor}"${strokeDash} stroke-width="1"/>`,
  );

  // Keycap (inner rect — 3D effect)
  if (!isGhost) {
    const capX = x + KEYCAP_INSET;
    const capY = y + KEYCAP_INSET;
    const capW = width - KEYCAP_INSET * 2;
    const capH = height - KEYCAP_INSET * 2 - 1; // -1 for bottom shadow
    lines.push(
      `    <rect x="${capX}" y="${capY}" width="${capW}" height="${capH}" rx="${KEY_RADIUS - 1}" ` +
        `fill="${capFill}" stroke="none"/>`,
    );
  }

  // Text labels
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Determine font size based on label length
  const label = parsed.label;
  let fontSize = 14;
  if (label.length === 1) fontSize = 17;
  else if (label.length <= 3) fontSize = 14;
  else if (label.length <= 5) fontSize = 12;
  else if (label.length <= 8) fontSize = 10;
  else fontSize = 9;

  const opacity = isGhost ? ' opacity="0.5"' : "";

  // Primary label (centered)
  const textY = parsed.holdLabel ? centerY - 3 : centerY + 1;
  lines.push(
    `    <text x="${centerX}" y="${textY}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace" ` +
      `font-size="${fontSize}" fill="${textColor}"${opacity}>${esc(label)}</text>`,
  );

  // Hold label (bottom-right, smaller)
  if (parsed.holdLabel && !isGhost) {
    const holdX = x + width - KEYCAP_INSET - 5;
    const holdY = y + height - KEYCAP_INSET - 7;
    lines.push(
      `    <text x="${holdX}" y="${holdY}" text-anchor="end" dominant-baseline="auto" ` +
        `font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace" ` +
        `font-size="10" fill="${palette.secondaryText}">${esc(parsed.holdLabel)}</text>`,
    );
  }

  // Highlight glow effect
  if (isHighlighted) {
    lines.push(
      `    <rect x="${x - 2}" y="${y - 2}" width="${width + 4}" height="${height + 4}" rx="${KEY_RADIUS + 1}" ` +
        `fill="none" stroke="${palette.highlightGlow}" stroke-width="2" opacity="0.6"/>`,
    );
  }

  lines.push("  </g>");
  return lines.join("\n");
}
