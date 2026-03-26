# Keyboard Layout Visualizer Changelog

## [1.0.0] - 2026-03-26

### Added

- **View Keymap**: Full-width SVG keyboard visualization with layer switching (Enter cycles, Cmd+1-9 jumps, Cmd+0 shows all stacked)
- **Find a Key**: Reverse search across all boards and layers with highlighted SVG preview
- **My Boards**: Visual grid gallery for managing multiple keyboard profiles
- **Add Board**: Unified entry point — USB detection (Vial + ZMK Studio) + file import + GitHub import
- **Import from GitHub**: Browse public GitHub repos to find and import keymap files
- **Board Settings**: Read/write QMK settings (tapping term, NKRO, auto shift, combos, etc.) + RGB lighting control + layer name editing
- **Keypress Tester**: Track which keys have been tested with coverage percentage
- **Quick Layer Peek**: Hotkey-optimized instant single-layer view
- **Layer Indicator**: Menu bar command showing active board + layer with USB polling
- **USB Board Detection**: Auto-detect Vial keyboards over USB HID RAW protocol
- **ZMK Studio**: Detect and read ZMK boards over CDC-ACM serial with protobuf
- **QMK File Import**: Parse QMK `keymap.json` with physical layout from QMK API
- **ZMK File Import**: Parse ZMK `.keymap` devicetree files with auto-detection
- **SVG Rendering**: Keycap 3D effect, category color coding, split keyboard detection, ghost keys (transparent inheritance), search highlight
- **6 Color Themes**: Auto, Minimal, Catppuccin, Nord, Solarized, High Contrast
- **Split Half Views**: Toggle between both halves, left only, right only (Cmd+Shift+H)
- **RGB Effect Simulation**: Per-key RGB colors overlaid on the keyboard SVG (10 effects)
- **Ghost Keys**: Transparent keys show inherited key from lower layer at 50% opacity
- **540+ Keycode Database**: Vendored from Vial's keycodes_v6.py for comprehensive display labels
- **SVG Caching**: Hash-based invalidation — only re-renders when inputs change
- **Board Lock Detection**: Shows Vial lock status + unlock key count
- **Keymap Change Detection**: Hash-based polling for live Vial edit sync
- **Polymorphic Firmware Adapters**: VialAdapter + ZmkAdapter with shared interface
