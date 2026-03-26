/**
 * Shared koffi loader — loads koffi once, used by all transports.
 * Uses eval("require") to prevent esbuild from trying to bundle it.
 */

import * as path from "path";
import * as os from "os";
import { environment } from "@raycast/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let koffi: any = null;

export function getKoffi() {
  if (koffi) return koffi;

  const dynamicRequire = eval("require");

  try {
    koffi = dynamicRequire("koffi");
  } catch {
    const arch = os.arch();
    const platform = os.platform();
    throw new Error(`Failed to load koffi for ${platform}_${arch}`);
  }

  return koffi;
}

/** Load a native library from assets/native/ */
export function loadNativeLib(subdir: string, filename: string) {
  const k = getKoffi();
  const libPath = path.join(environment.assetsPath, "native", subdir, filename);
  return k.load(libPath);
}
