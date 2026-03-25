# Keyboard Layout Visualizer

A Raycast extension for QMK/ZMK keyboard enthusiasts. Visualize your custom keymaps, search for keys across layers, and manage multiple board profiles — all from your launcher.

## Commands

- **View Keymap** — Display your active board's layout with layer switching (`Cmd+[`/`Cmd+]`, `Cmd+1`–`Cmd+9`)
- **Find a Key** — Reverse search: type any key name, see where it lives across all boards/layers
- **My Boards** — Visual grid gallery of your keyboard profiles
- **Import Keymap** — Import a QMK `keymap.json` file with auto-detection
- **Quick Layer Peek** — Bind to a hotkey for instant layer reference

## Features

- Beautiful SVG rendering with keycap 3D effect and category color coding
- Split keyboard auto-detection
- Dark/light mode support
- Ghost keys: transparent keys show the inherited key from the layer below at 50% opacity
- Search highlight with gold glow effect
- Smart mod-tap/layer-tap label parsing (e.g., `LT(2, KC_SPC)` shows "Spc" + "L2")
- Physical layout fetched from QMK API and cached locally

## Roadmap

### Near-term
- [ ] **Read directly from Vial-enabled boards over USB** (USB HID RAW protocol via `node-hid`) — no file import needed, just plug in your board
- [ ] **Live layer detection** — query the board for which layer is currently active
- [ ] **Proper layer names from firmware** — read what Vial/firmware stores, not just heuristics
- [ ] **Keypress visualizer** — show recent keypresses overlaid on the layout
- [ ] **User-customizable color themes** for the keyboard visualization
- [ ] **Manual layer name editing** after import

### Medium-term
- [ ] **ZMK `.keymap` file parsing** for ZMK users
- [ ] **USB auto-detect** — detect which board is plugged in and switch profile automatically
- [ ] **Menu bar companion** — `MenuBarExtra` command showing current layer in the menu bar
- [ ] **Combo and tap-dance visualization**
- [ ] **Export/share board profiles** as portable JSON
- [ ] **Re-import from source file** when you reflash

### Long-term vision
- [ ] **Transparent floating overlay** — pinned, configurable-transparency layout display (companion Swift app)
- [ ] **Edit keymaps through Raycast** — quick keycode tweaks sent back to the board via Vial protocol
- [ ] **ZMK Studio integration** once their export protocol stabilizes
- [ ] **Community layout sharing**

## Getting Started

1. Export your keymap from [QMK Configurator](https://config.qmk.fm) as `keymap.json`
2. Open Raycast and run **Import Keymap**
3. Select your file, name your board, and you're set
4. Use **View Keymap** to browse layers, **Find a Key** to search

## Development

```bash
npm install
npm run dev    # Start Raycast dev mode
npm run build  # Build for production
npm run lint   # Lint with Raycast ESLint config
```
