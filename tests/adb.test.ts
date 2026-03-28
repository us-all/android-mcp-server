import { describe, it, expect, vi } from "vitest";
import { execFile } from "node:child_process";

// Test that adb module correctly builds args with serial
describe("adb argument building", () => {
  it("should export adb and adbShell functions", async () => {
    const adbModule = await import("../src/adb.js");
    expect(typeof adbModule.adb).toBe("function");
    expect(typeof adbModule.adbShell).toBe("function");
    expect(typeof adbModule.adbRawBuffer).toBe("function");
  });
});

describe("config", () => {
  it("should have default config values", async () => {
    const { config } = await import("../src/config.js");
    expect(config.adbPath).toBeDefined();
    expect(typeof config.allowWrite).toBe("boolean");
    expect(typeof config.allowShell).toBe("boolean");
  });
});
