/**
 * Convert ZMK HID usage codes to ZMK key names.
 *
 * ZMK behavior params encode keys as: (usage_page << 16) | usage_id
 * Page 0x07 = Keyboard/Keypad
 * Page 0x0C = Consumer
 *
 * This maps HID usage IDs to ZMK key names from dt-bindings/zmk/keys.h,
 * which then get display labels from vendored-zmk-keycodes.ts.
 */

// HID Keyboard/Keypad page (0x07) usage → ZMK key name
const HID_KEYBOARD: Record<number, string> = {
  0x04: "A", 0x05: "B", 0x06: "C", 0x07: "D", 0x08: "E",
  0x09: "F", 0x0a: "G", 0x0b: "H", 0x0c: "I", 0x0d: "J",
  0x0e: "K", 0x0f: "L", 0x10: "M", 0x11: "N", 0x12: "O",
  0x13: "P", 0x14: "Q", 0x15: "R", 0x16: "S", 0x17: "T",
  0x18: "U", 0x19: "V", 0x1a: "W", 0x1b: "X", 0x1c: "Y", 0x1d: "Z",
  0x1e: "N1", 0x1f: "N2", 0x20: "N3", 0x21: "N4", 0x22: "N5",
  0x23: "N6", 0x24: "N7", 0x25: "N8", 0x26: "N9", 0x27: "N0",
  0x28: "ENTER", 0x29: "ESCAPE", 0x2a: "BACKSPACE", 0x2b: "TAB", 0x2c: "SPACE",
  0x2d: "MINUS", 0x2e: "EQUAL", 0x2f: "LEFT_BRACKET", 0x30: "RIGHT_BRACKET",
  0x31: "BACKSLASH", 0x33: "SEMICOLON", 0x34: "APOSTROPHE", 0x35: "GRAVE",
  0x36: "COMMA", 0x37: "PERIOD", 0x38: "SLASH", 0x39: "CAPSLOCK",
  0x3a: "F1", 0x3b: "F2", 0x3c: "F3", 0x3d: "F4",
  0x3e: "F5", 0x3f: "F6", 0x40: "F7", 0x41: "F8",
  0x42: "F9", 0x43: "F10", 0x44: "F11", 0x45: "F12",
  0x46: "PRINTSCREEN", 0x47: "SCROLLLOCK", 0x48: "PAUSE_BREAK",
  0x49: "INSERT", 0x4a: "HOME", 0x4b: "PAGE_UP",
  0x4c: "DELETE", 0x4d: "END", 0x4e: "PAGE_DOWN",
  0x4f: "RIGHT", 0x50: "LEFT", 0x51: "DOWN", 0x52: "UP",
  0x53: "KP_NUMLOCK", 0x54: "KP_SLASH", 0x55: "KP_ASTERISK",
  0x56: "KP_MINUS", 0x57: "KP_PLUS", 0x58: "KP_ENTER",
  0x59: "KP_N1", 0x5a: "KP_N2", 0x5b: "KP_N3",
  0x5c: "KP_N4", 0x5d: "KP_N5", 0x5e: "KP_N6",
  0x5f: "KP_N7", 0x60: "KP_N8", 0x61: "KP_N9",
  0x62: "KP_N0", 0x63: "KP_DOT",
  0x65: "K_APPLICATION",
  0x68: "F13", 0x69: "F14", 0x6a: "F15", 0x6b: "F16",
  0x6c: "F17", 0x6d: "F18", 0x6e: "F19", 0x6f: "F20",
  0x70: "F21", 0x71: "F22", 0x72: "F23", 0x73: "F24",
  // Modifiers
  0xe0: "LCTRL", 0xe1: "LSHIFT", 0xe2: "LALT", 0xe3: "LGUI",
  0xe4: "RCTRL", 0xe5: "RSHIFT", 0xe6: "RALT", 0xe7: "RGUI",
};

// HID Consumer page (0x0C) usage → ZMK key name
const HID_CONSUMER: Record<number, string> = {
  0xe2: "C_MUTE", 0xe9: "C_VOL_UP", 0xea: "C_VOL_DN",
  0xb5: "C_NEXT", 0xb6: "C_PREV", 0xb7: "C_STOP",
  0xcd: "C_PP", 0x6f: "C_BRI_UP", 0x70: "C_BRI_DN",
  0x183: "C_AL_CALC", 0x18a: "C_AL_EMAIL",
  0x192: "C_AL_CALCULATOR", 0x194: "C_AL_LOCAL_BROWSER",
  0x221: "C_AC_SEARCH", 0x223: "C_AC_HOME",
  0x224: "C_AC_BACK", 0x225: "C_AC_FORWARD",
  0x226: "C_AC_STOP", 0x227: "C_AC_REFRESH",
  0x22a: "C_AC_BOOKMARKS",
};

/**
 * Convert a ZMK HID usage param to a ZMK key name.
 * The returned name can be looked up in ZMK_LABELS for display.
 */
export function zmkHidToKeyName(param: number): string {
  if (param === 0) return "NONE";

  const page = (param >> 16) & 0xffff;
  const usage = param & 0xffff;

  if (page === 7 || page === 0) {
    return HID_KEYBOARD[usage] ?? `HID_${usage.toString(16).toUpperCase()}`;
  }
  if (page === 12) {
    return HID_CONSUMER[usage] ?? `C_0x${usage.toString(16).toUpperCase()}`;
  }

  return `HID_${page.toString(16)}_${usage.toString(16)}`;
}
