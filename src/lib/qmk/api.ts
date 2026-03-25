import { PhysicalKey, QmkInfoLayout } from "../types";

const QMK_API_BASE = "https://keyboards.qmk.fm/v1";

/** Fetch physical layout geometry from QMK's public keyboard API */
export async function fetchPhysicalLayout(
  keyboard: string,
  layoutKey: string,
): Promise<PhysicalKey[]> {
  // QMK API URL structure: /v1/keyboards/{keyboard}/info.json
  const url = `${QMK_API_BASE}/keyboards/${keyboard}/info.json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch layout for "${keyboard}" (HTTP ${response.status}). ` +
        `Make sure the keyboard name is correct.`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  // Navigate to layouts -> layoutKey -> layout
  const layouts = data.layouts as Record<string, QmkInfoLayout> | undefined;
  if (!layouts) {
    throw new Error(`No layouts found for keyboard "${keyboard}"`);
  }

  const layout = layouts[layoutKey];
  if (!layout) {
    const available = Object.keys(layouts).join(", ");
    throw new Error(
      `Layout "${layoutKey}" not found for "${keyboard}". Available: ${available}`,
    );
  }

  return layout.layout.map((key) => ({
    x: key.x,
    y: key.y,
    w: key.w ?? 1,
    h: key.h ?? 1,
    r: key.r,
    rx: key.rx,
    ry: key.ry,
  }));
}
