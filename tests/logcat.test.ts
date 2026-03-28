import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock adb module before importing logcat tools
vi.mock("../src/adb.js", () => ({
  adb: vi.fn(),
  adbShell: vi.fn(),
}));

import { adb, adbShell } from "../src/adb.js";
import {
  getLogcat,
  searchLogcat,
  getCrashLogs,
} from "../src/tools/logcat.js";

const mockAdb = vi.mocked(adb);
const mockAdbShell = vi.mocked(adbShell);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getLogcat", () => {
  it("should filter out logcat header lines", async () => {
    mockAdb.mockResolvedValue(
      "--------- beginning of main\n" +
        "03-28 12:00:00.000  1234  1234 E Tag: Error message\n" +
        "--------- beginning of system\n" +
        "03-28 12:00:01.000  5678  5678 I Tag: Info message\n",
    );

    const result = await getLogcat({ lines: 10 });
    expect(result.lineCount).toBe(2);
    expect(result.logs[0]).toContain("Error message");
    expect(result.logs[1]).toContain("Info message");
    expect(result.logs.some((l: string) => l.includes("beginning of"))).toBe(false);
  });

  it("should pass tag and priority filter", async () => {
    mockAdb.mockResolvedValue("03-28 12:00:00.000  1234  1234 E MyTag: error");

    await getLogcat({ lines: 50, tag: "MyTag", priority: "E" });

    expect(mockAdb).toHaveBeenCalledWith(
      ["logcat", "-d", "-t", "50", "MyTag:E", "*:S"],
      undefined,
    );
  });

  it("should pass priority-only filter", async () => {
    mockAdb.mockResolvedValue("");

    await getLogcat({ lines: 20, priority: "W" });

    expect(mockAdb).toHaveBeenCalledWith(
      ["logcat", "-d", "-t", "20", "*:W"],
      undefined,
    );
  });

  it("should pass tag-only filter", async () => {
    mockAdb.mockResolvedValue("");

    await getLogcat({ lines: 30, tag: "ActivityManager" });

    expect(mockAdb).toHaveBeenCalledWith(
      ["logcat", "-d", "-t", "30", "ActivityManager:V", "*:S"],
      undefined,
    );
  });

  it("should handle empty log output", async () => {
    mockAdb.mockResolvedValue("");

    const result = await getLogcat({ lines: 10 });
    expect(result.lineCount).toBe(0);
    expect(result.logs).toEqual([]);
  });
});

describe("searchLogcat", () => {
  it("should search case-insensitively by default", async () => {
    mockAdb.mockResolvedValue(
      "03-28 12:00:00 E Tag: NullPointerException\n" +
        "03-28 12:00:01 I Tag: Normal log\n" +
        "03-28 12:00:02 E Tag: nullpointerexception again\n",
    );

    const result = await searchLogcat({
      pattern: "NullPointer",
      lines: 100,
      caseSensitive: false,
    });

    expect(result.matchCount).toBe(2);
    expect(result.totalSearched).toBe(3);
  });

  it("should search case-sensitively when specified", async () => {
    mockAdb.mockResolvedValue(
      "03-28 12:00:00 E Tag: NullPointerException\n" +
        "03-28 12:00:01 E Tag: nullpointerexception\n",
    );

    const result = await searchLogcat({
      pattern: "NullPointer",
      lines: 100,
      caseSensitive: true,
    });

    expect(result.matchCount).toBe(1);
  });

  it("should return zero matches when pattern not found", async () => {
    mockAdb.mockResolvedValue("03-28 12:00:00 I Tag: Normal log\n");

    const result = await searchLogcat({
      pattern: "FATAL",
      lines: 100,
      caseSensitive: false,
    });

    expect(result.matchCount).toBe(0);
  });
});

describe("getCrashLogs", () => {
  it("should extract crash-related lines", async () => {
    mockAdbShell.mockResolvedValue(
      "03-28 E AndroidRuntime: FATAL EXCEPTION: main\n" +
        "03-28 E AndroidRuntime: java.lang.NullPointerException\n" +
        "03-28 I SomeTag: Normal operation\n",
    );

    const result = await getCrashLogs({});

    expect(result.crashCount).toBe(2);
    expect(result.crashes[0]).toContain("FATAL");
  });

  it("should filter by package name", async () => {
    mockAdbShell.mockResolvedValue(
      "03-28 E AndroidRuntime: FATAL EXCEPTION in com.example.app\n" +
        "03-28 E AndroidRuntime: FATAL EXCEPTION in com.other.app\n",
    );

    const result = await getCrashLogs({ packageName: "com.example.app" });

    expect(result.crashCount).toBe(1);
    expect(result.crashes[0]).toContain("com.example.app");
  });

  it("should return last 50 lines when no crashes found", async () => {
    mockAdbShell.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => `Line ${i}`).join("\n"),
    );

    const result = await getCrashLogs({});

    expect(result.crashCount).toBe(0);
    expect(result.crashes.length).toBe(50);
  });
});
