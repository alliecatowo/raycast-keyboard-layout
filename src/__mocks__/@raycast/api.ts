/**
 * Mock for @raycast/api — stubs all imports used by our lib/ code.
 */

import { vi } from "vitest";

// LocalStorage mock (in-memory Map)
const storage = new Map<string, string>();

export const LocalStorage = {
  getItem: vi.fn(async (key: string) => storage.get(key) ?? undefined),
  setItem: vi.fn(async (key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    storage.delete(key);
  }),
  allItems: vi.fn(async () => Object.fromEntries(storage)),
  clear: vi.fn(async () => storage.clear()),
};

// Environment mock
export const environment = {
  assetsPath: "/tmp/test-assets",
  supportPath: "/tmp/test-support",
  appearance: "dark" as const,
  extensionName: "keyboard-layout-visualizer",
};

// UI components (not rendered in tests, just need to exist)
export const Detail = vi.fn();
export const List = vi.fn();
export const Grid = vi.fn();
export const Form = vi.fn();
export const Action = vi.fn();
export const ActionPanel = vi.fn();
export const Icon = {
  Keyboard: "keyboard",
  Plus: "plus",
  Checkmark: "checkmark",
  Trash: "trash",
  ArrowClockwise: "arrow-clockwise",
  Gear: "gear",
  Lock: "lock",
  LockUnlocked: "lock-unlocked",
  Sun: "sun",
  Wand: "wand",
  EyeDropper: "eye-dropper",
  Text: "text",
  Layers: "layers",
  Key: "key",
};
export const Color = {
  Green: "green",
  Blue: "blue",
  Red: "red",
  Yellow: "yellow",
  Orange: "orange",
  SecondaryText: "secondary",
};

export const Toast = {
  Style: { Success: "success", Failure: "failure", Animated: "animated" },
};

export const showToast = vi.fn();
export const getPreferenceValues = vi.fn(() => ({}));
export const MenuBarExtra = vi.fn();
export const open = vi.fn();
export const confirmAlert = vi.fn(async () => true);
export const Alert = { ActionStyle: { Destructive: "destructive" } };

// Helper to reset storage between tests
export function __resetMockStorage() {
  storage.clear();
  vi.clearAllMocks();
}
