# Keyboard Layout Visualizer — CLAUDE.md

## Project Overview
Raycast extension for QMK/ZMK keyboard enthusiasts. Visualizes custom keymaps,
reads boards over USB (Vial HID + ZMK Studio serial), manages multiple profiles.

## Build & Test
```bash
npm install                    # Extension dependencies
cd helper && npm install       # Native USB helper dependencies
npm run dev                    # Raycast dev mode (hot reload)
npm run build                  # Production build
npm run lint                   # ESLint + Prettier + Raycast validation
npm run fix-lint               # Auto-fix formatting
```

## Architecture
- `src/commands/` — Raycast command components (React + TypeScript)
- `src/lib/svg/` — SVG rendering engine (keycap 3D, colors, geometry, RGB effects)
- `src/lib/keymap/` — Keycode parsing pipeline (numeric → string → display label)
- `src/lib/vial/` — USB communication client (spawns helper processes)
- `src/lib/firmware/` — Polymorphic firmware adapter pattern (Vial + ZMK)
- `src/lib/storage/` — LocalStorage CRUD for board profiles
- `helper/` — Standalone Node.js scripts for USB HID/serial communication
  - `vial-reader.js` — Vial protocol (node-hid, LZMA decompression)
  - `zmk-reader.js` — ZMK Studio protocol (serialport, protobuf)
  - `lzma-decompress.js` — XZ/LZMA decompression with Python fallback

## Key Patterns
- Helper processes via `child_process.execFile` (native modules can't run in Raycast)
- SVG cache with MD5 hash invalidation (`/tmp/keyviz/`)
- Vendored keycode DB from Vial's `keycodes_v6.py` (540+ entries)
- QMK keycode ranges from `quantum/keycodes.h` v0.0.8
- Firmware type: "qmk" | "zmk" | "via" | "vial"

## Commands (9)
1. View Keymap — Detail, SVG layout with layer cycling
2. Find a Key — List+Detail, reverse keycode search
3. My Boards — Grid, board gallery management
4. Add Board — List, USB detect + file import + GitHub
5. Import from GitHub — Form+List, public repo browser
6. Board Settings — List, QMK settings + RGB + layer names
7. Quick Layer Peek — Detail, hotkey-optimized
8. Keypress Tester — Detail, key coverage tracking
9. Layer Indicator — MenuBarExtra, always-visible layer

## Conventions
- Run `npm run lint` before committing — must pass clean
- Entry points in `src/*.tsx` re-export from `src/commands/*.tsx`
- New commands need: component, entry point, package.json entry
- Theme colors in `src/lib/svg/colors.ts`
- Keycode display labels in `src/lib/keymap/keycodes-data.ts` (hand-maintained)
  + `src/lib/keymap/vendored-keycodes.ts` (auto-generated from Vial)
