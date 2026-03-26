/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `show-layout` command */
  export type ShowLayout = ExtensionPreferences & {}
  /** Preferences accessible in the `search-keys` command */
  export type SearchKeys = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-boards` command */
  export type ManageBoards = ExtensionPreferences & {}
  /** Preferences accessible in the `import-keymap` command */
  export type ImportKeymap = ExtensionPreferences & {}
  /** Preferences accessible in the `add-board` command */
  export type AddBoard = ExtensionPreferences & {}
  /** Preferences accessible in the `detect-board` command */
  export type DetectBoard = ExtensionPreferences & {}
  /** Preferences accessible in the `quick-layer` command */
  export type QuickLayer = ExtensionPreferences & {}
  /** Preferences accessible in the `import-github` command */
  export type ImportGithub = ExtensionPreferences & {}
  /** Preferences accessible in the `keypress-tester` command */
  export type KeypressTester = ExtensionPreferences & {}
  /** Preferences accessible in the `layer-indicator` command */
  export type LayerIndicator = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `show-layout` command */
  export type ShowLayout = {}
  /** Arguments passed to the `search-keys` command */
  export type SearchKeys = {}
  /** Arguments passed to the `manage-boards` command */
  export type ManageBoards = {}
  /** Arguments passed to the `import-keymap` command */
  export type ImportKeymap = {}
  /** Arguments passed to the `add-board` command */
  export type AddBoard = {}
  /** Arguments passed to the `detect-board` command */
  export type DetectBoard = {}
  /** Arguments passed to the `quick-layer` command */
  export type QuickLayer = {
  /** Layer number (0-9) */
  "layer": string
}
  /** Arguments passed to the `import-github` command */
  export type ImportGithub = {}
  /** Arguments passed to the `keypress-tester` command */
  export type KeypressTester = {}
  /** Arguments passed to the `layer-indicator` command */
  export type LayerIndicator = {}
}

