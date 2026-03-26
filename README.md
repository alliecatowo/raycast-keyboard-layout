# Keyboard Layout Visualizer

A Raycast extension for QMK/ZMK keyboard enthusiasts. Visualize your custom keymaps, search for keys across layers, and manage multiple board profiles — all from your launcher.

## Commands

- **View Keymap** — Display your active board's layout with layer switching (`Cmd+[`/`Cmd+]`, `Cmd+1`–`Cmd+9`)
- **Find a Key** — Reverse search: type any key name, see where it lives across all boards/layers
- **My Boards** — Visual grid gallery of your keyboard profiles
- **Detect Keyboard** — Auto-detect Vial (USB HID) and ZMK Studio (serial) boards, read keymap directly
- **Import Keymap** — Import QMK `keymap.json` or ZMK `.keymap` files (auto-detects format)
- **Quick Layer Peek** — Bind to a hotkey for instant layer reference

## Features

- **USB board detection**: Plug in your Vial or ZMK Studio board, read the keymap directly — no file export needed
- Beautiful SVG rendering with keycap 3D effect and category color coding
- Split keyboard auto-detection
- Dark/light mode support
- Ghost keys: transparent keys show the inherited key from the layer below at 50% opacity
- Search highlight with gold glow effect
- Smart mod-tap/layer-tap label parsing (e.g., `LT(2, KC_SPC)` → "Spc" + "L2")
- SVG caching with hash-based invalidation (only re-renders when data changes)
- Full QMK keycode coverage from `quantum/keycodes.h` v0.0.8

## Getting Started

### USB Detection (recommended)
1. Plug in your Vial or ZMK Studio keyboard
2. Open Raycast and run **Detect Keyboard**
3. Select your board and press Enter — done!

### File Import
1. Export your keymap from QMK Configurator (`keymap.json`) or your ZMK config repo (`.keymap`)
2. Open Raycast and run **Import Keymap**
3. Select your file, name your board, and you're set

## Roadmap

### In Progress
- [x] Vial USB board detection and keymap reading (HID RAW)
- [x] ZMK Studio board detection and keymap reading (serial + protobuf)
- [x] QMK keymap.json import
- [x] ZMK .keymap file import with auto-detect
- [x] SVG caching with hash-based invalidation
- [ ] Fix remaining keycode edge cases (custom keycodes, firmware-specific ranges)
- [ ] Generic VIA/Remap protocol support (VIA is a subset of Vial)
- [ ] Polymorphic firmware adapter pattern (clean architecture)

### Near-term
- [ ] **Menu bar command** (`MenuBarExtra`) showing current active layer
- [ ] **Active layer detection** — poll board for pressed keys, infer active layer from MO/TG holds
- [ ] **Keypress tester** — show which physical key is being pressed (matrix testing mode)
- [ ] **GitHub repo import** — point at a public GitHub repo, browse to keymap file, import without cloning
- [ ] **User-customizable color themes** for the keyboard visualization
- [ ] **Manual layer name editing** after import
- [ ] **Exhaustive keycode DB** — pull from Vial's `keycodes_v6.py` (canonical ~2000 entries)

### Medium-term
- [ ] **USB auto-detect** — detect which board is plugged in and switch active profile automatically
- [ ] **Combo and tap-dance visualization**
- [ ] **Export/share board profiles** as portable JSON
- [ ] **Re-import / refresh from source** — detect when firmware changes, offer to re-read
- [ ] **Keypress visualizer overlay** — show recent keypresses on the layout in real-time

### Long-term vision
- [ ] **Transparent floating overlay** — pinned, configurable-transparency layout display (companion Swift app)
- [ ] **Edit keymaps through Raycast** — quick keycode tweaks sent back to the board via Vial/ZMK Studio protocol
- [ ] **Community layout sharing**
- [ ] **VIA web protocol** support for even broader board compatibility

## Architecture

```
Raycast Extension (TypeScript/React)
  ├── Commands (show-layout, detect-board, search-keys, etc.)
  ├── SVG Renderer (keycap 3D, split detection, ghost keys, highlights)
  ├── Keycode Parser (QMK numeric → display label pipeline)
  ├── Storage (LocalStorage for board profiles + layout cache)
  └── child_process
        ├── helper/vial-reader.js (node-hid → USB HID RAW → Vial protocol)
        └── helper/zmk-reader.js (serialport → CDC-ACM → protobuf → ZMK Studio)
```

Helper processes are needed because Raycast extensions can't load native Node.js addons (`node-hid`, `serialport`). The helpers run as separate Node.js processes and communicate via JSON over stdio.

## Development

```bash
npm install
cd helper && npm install && cd ..  # Install helper native dependencies
npm run dev    # Start Raycast dev mode
npm run build  # Build for production
npm run lint   # Lint with Raycast ESLint config
```
