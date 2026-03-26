import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/vial/client.ts", // helper process — needs real USB
        "src/lib/qmk/**", // network calls to QMK API
        "src/lib/firmware/adapter.ts", // abstract registry
        "src/lib/firmware/index.ts", // adapter registration
        "src/lib/firmware/vial-adapter.ts", // needs real USB
        "src/lib/firmware/zmk-adapter.ts", // needs real USB
        "src/lib/keymap/vendored-keycodes.ts", // auto-generated
        "src/lib/keymap/vendored-zmk-keycodes.ts", // auto-generated
        "src/lib/types.ts", // type-only file
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    alias: {
      "@raycast/api": path.resolve(
        __dirname,
        "src/__mocks__/@raycast/api.ts",
      ),
    },
  },
});
