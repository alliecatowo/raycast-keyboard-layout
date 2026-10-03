import { describe, expect, it, vi } from "vitest";
import {
  ensureHelperDir,
  findNodeBinary,
  hasNativeDeps,
  helperEnv,
  parseHelperResult,
  zmkBindingToKeycode,
} from "./helper-env";

const keyName = (c: number) => `K${c}`;

describe("findNodeBinary", () => {
  it("prefers the KEYVIZ_NODE override", () => {
    const exists = (p: string) => p === "/custom/node" || p === "/usr/bin/node";
    expect(
      findNodeBinary({ env: { KEYVIZ_NODE: "/custom/node" }, exists }),
    ).toBe("/custom/node");
  });

  it("finds node on PATH before well-known locations", () => {
    const exists = (p: string) => p === "/a/bin/node" || p === "/usr/bin/node";
    expect(
      findNodeBinary({
        env: { PATH: "/x:/a/bin" },
        platform: "linux",
        exists,
      }),
    ).toBe("/a/bin/node");
  });

  it("picks the newest version-manager install", () => {
    const base = "/h/.local/share/mise/installs/node";
    const exists = (p: string) => p === `${base}/24.10.0/bin/node`;
    expect(
      findNodeBinary({
        env: { HOME: "/h", PATH: "" },
        platform: "linux",
        exists,
        readdir: (d) => (d === base ? ["24.9.0", "24.10.0", "22.1.0"] : []),
      }),
    ).toBe(`${base}/24.10.0/bin/node`);
  });

  it("looks in Program Files on Windows", () => {
    const want = "C:\\Program Files\\nodejs\\node.exe";
    expect(
      findNodeBinary({
        env: { ProgramFiles: "C:\\Program Files", PATH: "" },
        platform: "win32",
        exists: (p) => p === want,
      }),
    ).toBe(want);
  });

  it("falls back to bare node", () => {
    expect(
      findNodeBinary({ env: {}, platform: "linux", exists: () => false }),
    ).toBe("node");
  });
});

describe("helperEnv", () => {
  it("sets NODE_PATH next to the helper script", () => {
    const env = helperEnv("/h/vial-reader.js", { FOO: "1" });
    expect(env.NODE_PATH).toBe("/h/node_modules");
    expect(env.FOO).toBe("1");
  });

  it("only passes VIAL_DEBUG through when it is exactly 1", () => {
    expect(helperEnv("/h/x.js", {}).VIAL_DEBUG).toBeUndefined();
    expect(
      helperEnv("/h/x.js", { VIAL_DEBUG: "0" }).VIAL_DEBUG,
    ).toBeUndefined();
    expect(helperEnv("/h/x.js", { VIAL_DEBUG: "1" }).VIAL_DEBUG).toBe("1");
  });
});

describe("parseHelperResult", () => {
  it("returns parsed JSON on success", () => {
    expect(parseHelperResult(null, '{"devices":[]}', "")).toEqual({
      ok: true,
      value: { devices: [] },
    });
  });

  it("surfaces a JSON error from stdout even when the process failed", () => {
    const r = parseHelperResult(
      new Error("exit 1"),
      '{"error":"no device"}',
      "",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe("no device");
  });

  it("prefers stderr, then the process error, when stdout is not JSON", () => {
    const a = parseHelperResult(new Error("exit 1"), "", "boom");
    const b = parseHelperResult(new Error("exit 1"), "", "");
    expect(a.ok === false && a.error.message).toBe("boom");
    expect(b.ok === false && b.error.message).toBe("exit 1");
  });

  it("reports unparseable output without an error", () => {
    const r = parseHelperResult(null, "garbage", "");
    expect(r.ok === false && r.error.message).toMatch(
      /Failed to parse helper output: garbage/,
    );
  });
});

describe("ensureHelperDir", () => {
  function fakeFs(initial: string[]) {
    const files = new Set(initial);
    return {
      files,
      existsSync: (p: string) => files.has(p),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn((_s: string, d: string) => void files.add(d)),
    };
  }
  const deps = ["node-hid", "serialport"];

  it("uses the bundled dir when it already has native deps (dev)", () => {
    const f = fakeFs(deps.map((d) => `/b/node_modules/${d}`));
    const install = vi.fn();
    expect(
      ensureHelperDir({
        bundledDir: "/b",
        supportDir: "/s",
        fsApi: f as never,
        install,
      }),
    ).toBe("/b");
    expect(install).not.toHaveBeenCalled();
    expect(f.copyFileSync).not.toHaveBeenCalled();
  });

  it("copies scripts to the support dir and installs once (installed)", () => {
    const f = fakeFs(["/b/vial-reader.js", "/b/package.json"]);
    const install = vi.fn((cwd: string) => {
      for (const d of deps) f.files.add(`${cwd}/node_modules/${d}`);
    });
    const dir = ensureHelperDir({
      bundledDir: "/b",
      supportDir: "/s",
      fsApi: f as never,
      install,
    });
    expect(dir).toBe("/s/helper");
    expect(f.copyFileSync).toHaveBeenCalledTimes(2);
    expect(install).toHaveBeenCalledWith("/s/helper");
    // second call: deps present, no reinstall
    ensureHelperDir({
      bundledDir: "/b",
      supportDir: "/s",
      fsApi: f as never,
      install,
    });
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("throws a helpful message when install fails", () => {
    const f = fakeFs([]);
    expect(() =>
      ensureHelperDir({
        bundledDir: "/b",
        supportDir: "/s",
        fsApi: f as never,
        install: () => {
          throw new Error("npm: not found");
        },
      }),
    ).toThrow(
      /USB detection is unavailable.*import a keymap file.*npm: not found/s,
    );
  });

  it("hasNativeDeps needs every dependency", () => {
    expect(hasNativeDeps("/d", (p) => p === "/d/node_modules/node-hid")).toBe(
      false,
    );
  });
});

describe("zmkBindingToKeycode", () => {
  const b = (behavior: string, param1 = 0, param2 = 0) => ({
    behavior,
    param1,
    param2,
  });
  it("maps the supported behaviors in both spellings", () => {
    expect(zmkBindingToKeycode(b("&kp", 4), keyName)).toBe("K4");
    expect(zmkBindingToKeycode(b("key_press", 4), keyName)).toBe("K4");
    expect(zmkBindingToKeycode(b("&mo", 2), keyName)).toBe("MO(2)");
    expect(zmkBindingToKeycode(b("&lt", 1, 5), keyName)).toBe("LT(1, K5)");
    expect(zmkBindingToKeycode(b("&mt", 6, 7), keyName)).toBe("MT(K6, K7)");
    expect(zmkBindingToKeycode(b("&trans"), keyName)).toBe("KC_TRNS");
    expect(zmkBindingToKeycode(b("none"), keyName)).toBe("KC_NO");
    expect(zmkBindingToKeycode(b("&tog", 3), keyName)).toBe("TG(3)");
    expect(zmkBindingToKeycode(b("&to", 1), keyName)).toBe("TO(1)");
  });
  it("falls back to the behavior name and non-zero params", () => {
    expect(zmkBindingToKeycode(b("&bt", 1, 2), keyName)).toBe("&bt 1 2");
    expect(zmkBindingToKeycode(b("&reset"), keyName)).toBe("&reset");
  });
});
