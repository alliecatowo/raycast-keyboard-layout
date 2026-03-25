import { LocalStorage } from "@raycast/api";
import { PhysicalKey } from "../types";
import { fetchPhysicalLayout } from "./api";

const CACHE_PREFIX = "layoutCache:";

/** Get physical layout, using cache if available, otherwise fetch from QMK API */
export async function getPhysicalLayout(
  keyboard: string,
  layoutKey: string,
): Promise<PhysicalKey[]> {
  const cacheKey = `${CACHE_PREFIX}${keyboard}:${layoutKey}`;

  // Check cache
  const cached = await LocalStorage.getItem<string>(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as PhysicalKey[];
    } catch {
      // Corrupted cache, fetch fresh
    }
  }

  // Fetch from API
  const layout = await fetchPhysicalLayout(keyboard, layoutKey);

  // Cache for future use (physical layouts never change)
  await LocalStorage.setItem(cacheKey, JSON.stringify(layout));

  return layout;
}

/** Clear all cached layouts */
export async function clearLayoutCache(): Promise<void> {
  const all = await LocalStorage.allItems();
  for (const key of Object.keys(all)) {
    if (key.startsWith(CACHE_PREFIX)) {
      await LocalStorage.removeItem(key);
    }
  }
}
