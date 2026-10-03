import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process and fs before importing client
vi.mock("child_process", () => ({
  execFile: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn(() => true),
  };
});

import { execFile } from "child_process";

// We can't easily test the full client without the helper process,
// but we CAN test the detection and error handling paths.

describe("vial client helper process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("execFile is properly mocked", () => {
    expect(vi.isMockFunction(execFile)).toBe(true);
  });

  // The client functions call execFile with the helper path.
  // We can verify they handle errors gracefully.
  it("detect returns empty array on helper failure", async () => {
    const mockExecFile = vi.mocked(execFile);
    mockExecFile.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callback(new Error("helper not found"), "", "");
        return {} as ReturnType<typeof execFile>;
      },
    );

    // Import after mocking
    const { detectVialDevices } = await import("./client");
    const devices = await detectVialDevices();
    expect(devices).toEqual([]);
  });
});
