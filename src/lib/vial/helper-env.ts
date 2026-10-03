import * as fs from "fs";
import * as path from "path";

/** Files copied from the bundled helper dir into the writable support dir. */
export const HELPER_FILES = [
  "vial-reader.js",
  "zmk-reader.js",
  "lzma-decompress.js",
  "package.json",
  "package-lock.json",
];

/** Native modules that must be present for USB access. */
export const NATIVE_DEPS = ["node-hid", "serialport"];

export function hasNativeDeps(
  dir: string,
  exists: (p: string) => boolean = fs.existsSync,
): boolean {
  return NATIVE_DEPS.every((dep) =>
    exists(path.join(dir, "node_modules", dep)),
  );
}

interface NodeLookupEnv {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  exists?: (p: string) => boolean;
  readdir?: (p: string) => string[];
}

/**
 * Locate a node binary that can load native modules. Order: KEYVIZ_NODE
 * override, every `node` on PATH, version managers (mise, nvm, fnm, volta),
 * then the usual install locations. Falls back to bare "node".
 */
export function findNodeBinary(opts: NodeLookupEnv = {}): string {
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  const exists = opts.exists ?? fs.existsSync;
  const readdir =
    opts.readdir ??
    ((p: string) => {
      try {
        return fs.readdirSync(p);
      } catch {
        return [];
      }
    });
  const win = platform === "win32";
  const exe = win ? "node.exe" : "node";
  const sep = win ? path.win32 : path.posix;
  const candidates: string[] = [];

  if (env.KEYVIZ_NODE) candidates.push(env.KEYVIZ_NODE);

  const pathDirs = (env.PATH ?? env.Path ?? "")
    .split(win ? ";" : ":")
    .filter(Boolean);
  for (const dir of pathDirs) candidates.push(sep.join(dir, exe));

  const home = env.HOME ?? env.USERPROFILE;
  if (home) {
    // newest version first so the result is deterministic
    const newestFirst = (dir: string) =>
      readdir(dir).sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true }),
      );
    const mise = sep.join(home, ".local", "share", "mise", "installs", "node");
    for (const v of newestFirst(mise)) {
      candidates.push(sep.join(mise, v, "bin", exe));
    }
    const nvm = sep.join(home, ".nvm", "versions", "node");
    for (const v of newestFirst(nvm)) {
      candidates.push(sep.join(nvm, v, "bin", exe));
    }
    candidates.push(sep.join(home, ".volta", "bin", exe));
    candidates.push(sep.join(home, ".local", "bin", exe));
  }

  if (win) {
    for (const base of [env.ProgramFiles, env["ProgramFiles(x86)"]]) {
      if (base) candidates.push(sep.join(base, "nodejs", exe));
    }
    if (env.LOCALAPPDATA) {
      candidates.push(sep.join(env.LOCALAPPDATA, "Programs", "nodejs", exe));
    }
  } else {
    candidates.push(
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/usr/bin/node",
    );
  }

  return candidates.find((p) => exists(p)) ?? "node";
}

/** Environment for helper child processes. Verbose logging is opt-in. */
export function helperEnv(
  helperPath: string,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    NODE_PATH: path.join(path.dirname(helperPath), "node_modules"),
  };
  if (base.VIAL_DEBUG !== "1") delete env.VIAL_DEBUG;
  return env;
}

/** Turn a helper process result into a value or an Error (helpers print JSON). */
export function parseHelperResult(
  error: Error | null,
  stdout: string,
  stderr: string,
): { ok: true; value: unknown } | { ok: false; error: Error } {
  let parsed: { error?: string } | undefined;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }
  if (parsed?.error) return { ok: false, error: new Error(parsed.error) };
  if (error) return { ok: false, error: new Error(stderr || error.message) };
  if (parsed === undefined) {
    return {
      ok: false,
      error: new Error(
        `Failed to parse helper output: ${stdout.slice(0, 200)}`,
      ),
    };
  }
  return { ok: true, value: parsed };
}

export interface HelperDirDeps {
  bundledDir: string;
  supportDir: string;
  fsApi?: Pick<typeof fs, "existsSync" | "mkdirSync" | "copyFileSync">;
  /** Runs `npm install --omit=dev` in `cwd`; throws on failure. */
  install: (cwd: string) => void;
}

/**
 * Directory holding the helper scripts together with their native deps.
 * Dev: assets/helper with node_modules already installed is used as is.
 * Installed: scripts are copied to supportDir and deps installed once there.
 */
export function ensureHelperDir(deps: HelperDirDeps): string {
  const fsApi = deps.fsApi ?? fs;
  const exists = (p: string) => fsApi.existsSync(p);
  if (hasNativeDeps(deps.bundledDir, exists)) return deps.bundledDir;

  const target = path.join(deps.supportDir, "helper");
  fsApi.mkdirSync(target, { recursive: true });
  for (const f of HELPER_FILES) {
    const src = path.join(deps.bundledDir, f);
    if (exists(src)) fsApi.copyFileSync(src, path.join(target, f));
  }
  if (!hasNativeDeps(target, exists)) {
    try {
      deps.install(target);
    } catch (e) {
      throw new Error(
        "USB detection is unavailable: could not install the native helper dependencies " +
          `(${NATIVE_DEPS.join(", ")}). Install Node.js + npm, or import a keymap file instead. ` +
          `Details: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return target;
}

export interface ZmkBinding {
  behavior: string;
  param1: number;
  param2: number;
}

/** Convert a ZMK Studio binding into the keycode string our parser/renderer use. */
export function zmkBindingToKeycode(
  b: ZmkBinding,
  keyName: (code: number) => string,
): string {
  switch (b.behavior) {
    case "key_press":
    case "&kp":
      return keyName(b.param1);
    case "momentary_layer":
    case "&mo":
      return `MO(${b.param1})`;
    case "layer_tap":
    case "&lt":
      return `LT(${b.param1}, ${keyName(b.param2)})`;
    case "mod_tap":
    case "&mt":
      return `MT(${keyName(b.param1)}, ${keyName(b.param2)})`;
    case "transparent":
    case "&trans":
      return "KC_TRNS";
    case "none":
    case "&none":
      return "KC_NO";
    case "toggle_layer":
    case "&tog":
      return `TG(${b.param1})`;
    case "to_layer":
    case "&to":
      return `TO(${b.param1})`;
    default:
      return (
        b.behavior +
        (b.param1 ? ` ${b.param1}` : "") +
        (b.param2 ? ` ${b.param2}` : "")
      );
  }
}
