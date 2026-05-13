import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/adb.js", () => ({
  adb: vi.fn(),
  adbShell: vi.fn(),
}));

// Mock config to allow writes in tests
vi.mock("../src/config.js", () => ({
  config: {
    adbPath: "adb",
    serial: "",
    allowWrite: true,
    allowShell: true,
    androidHome: "",
  },
}));

import { adbShell } from "../src/adb.js";
import { deleteFile, listFiles } from "../src/tools/files.js";

const mockAdbShell = vi.mocked(adbShell);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("file shell argument safety", () => {
  it("should escape device paths passed to ls", async () => {
    mockAdbShell.mockResolvedValue("file\n");

    await listFiles({ path: "/sdcard/My Files", recursive: false });

    expect(mockAdbShell).toHaveBeenCalledWith(
      "ls -la '/sdcard/My Files'",
      undefined,
    );
  });

  it("should reject unsafe device paths before shelling out", async () => {
    await expect(
      listFiles({ path: "/sdcard/test;id", recursive: false }),
    ).rejects.toThrow("Invalid device path");

    expect(mockAdbShell).not.toHaveBeenCalled();
  });

  it("should escape device paths passed to rm", async () => {
    mockAdbShell.mockResolvedValue("");

    await deleteFile({ path: "/sdcard/My Files", recursive: true });

    expect(mockAdbShell).toHaveBeenCalledWith(
      "rm -rf '/sdcard/My Files'",
      undefined,
    );
  });
});
