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
import {
  listPackages,
  getPackageInfo,
  getCurrentActivity,
  openUrl,
  sendBroadcast,
  stopApp,
} from "../src/tools/apps.js";

const mockAdbShell = vi.mocked(adbShell);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPackages", () => {
  it("should parse package list and sort", async () => {
    mockAdbShell.mockResolvedValue(
      "package:com.google.chrome\n" +
        "package:com.android.settings\n" +
        "package:com.example.app\n",
    );

    const result = await listPackages({ type: "all" });

    expect(result.count).toBe(3);
    expect(result.packages[0]).toBe("com.android.settings");
    expect(result.packages[2]).toBe("com.google.chrome");
  });

  it("should filter packages by name", async () => {
    mockAdbShell.mockResolvedValue(
      "package:com.google.chrome\n" +
        "package:com.google.maps\n" +
        "package:com.example.app\n",
    );

    const result = await listPackages({ type: "all", filter: "google" });

    expect(result.count).toBe(2);
    expect(result.packages.every((p: string) => p.includes("google"))).toBe(true);
  });

  it("should pass correct flag for third-party", async () => {
    mockAdbShell.mockResolvedValue("");

    await listPackages({ type: "third-party" });

    expect(mockAdbShell).toHaveBeenCalledWith(
      "pm list packages -3",
      undefined,
    );
  });

  it("should pass correct flag for system", async () => {
    mockAdbShell.mockResolvedValue("");

    await listPackages({ type: "system" });

    expect(mockAdbShell).toHaveBeenCalledWith(
      "pm list packages -s",
      undefined,
    );
  });

  it("should handle empty package list", async () => {
    mockAdbShell.mockResolvedValue("");

    const result = await listPackages({ type: "all" });

    expect(result.count).toBe(0);
    expect(result.packages).toEqual([]);
  });
});

describe("getPackageInfo", () => {
  it("should parse package dumpsys output", async () => {
    mockAdbShell.mockResolvedValue(
      "Packages:\n" +
        "  versionCode=123\n" +
        "  versionName=1.2.3\n" +
        "  targetSdk=34\n" +
        "  minSdk=21\n" +
        "  firstInstallTime=2024-01-01\n" +
        "  lastUpdateTime=2024-06-15\n" +
        "  requested permissions:\n" +
        "    android.permission.CAMERA\n" +
        "    android.permission.INTERNET\n" +
        "\n",
    );

    const result = await getPackageInfo({ packageName: "com.example.app" });

    expect(result.packageName).toBe("com.example.app");
    expect(result.versionCode).toBe("123");
    expect(result.versionName).toBe("1.2.3");
    expect(result.targetSdk).toBe("34");
    expect(result.minSdk).toBe("21");
  });

  it("should handle missing fields gracefully", async () => {
    mockAdbShell.mockResolvedValue("Packages:\n  versionName=1.0\n");

    const result = await getPackageInfo({ packageName: "com.test" });

    expect(result.packageName).toBe("com.test");
    expect(result.versionName).toBe("1.0");
    expect(result.versionCode).toBeUndefined();
    expect(result.targetSdk).toBeUndefined();
  });

  it("should reject invalid package names before shelling out", async () => {
    await expect(
      getPackageInfo({ packageName: "com.example;id" }),
    ).rejects.toThrow("Invalid package name");

    expect(mockAdbShell).not.toHaveBeenCalled();
  });
});

describe("getCurrentActivity", () => {
  it("should parse resumed activity", async () => {
    mockAdbShell.mockResolvedValue(
      "  mResumedActivity: ActivityRecord{abc123 u0 com.example.app/.MainActivity t42}\n" +
        "  mCurrentFocus=Window{def456 u0 com.example.app/.MainActivity}\n",
    );

    const result = await getCurrentActivity({});

    expect(result.resumedActivity).toBe("com.example.app/.MainActivity");
    expect(result.currentFocus).toBe("com.example.app/.MainActivity");
  });

  it("should handle missing resumed activity", async () => {
    mockAdbShell.mockResolvedValue(
      "  mCurrentFocus=Window{abc u0 StatusBar}\n",
    );

    const result = await getCurrentActivity({});

    expect(result.resumedActivity).toBeUndefined();
    expect(result.currentFocus).toBe("StatusBar");
  });
});

describe("shell argument safety", () => {
  it("should escape URLs passed to am start", async () => {
    mockAdbShell.mockResolvedValue("");

    await openUrl({ url: "https://example.com/a'b?x=$(id)" });

    expect(mockAdbShell).toHaveBeenCalledWith(
      "am start -a android.intent.action.VIEW -d 'https://example.com/a'\\''b?x=$(id)'",
      undefined,
    );
  });

  it("should validate package names used in shell commands", async () => {
    await expect(
      stopApp({ packageName: "com.example.app;reboot" }),
    ).rejects.toThrow("Invalid package name");

    expect(mockAdbShell).not.toHaveBeenCalled();
  });

  it("should validate broadcast fields and escape extra values", async () => {
    mockAdbShell.mockResolvedValue("");

    await sendBroadcast({
      action: "com.example.ACTION",
      component: "com.example.app/.Receiver",
      extras: "--es payload a'b --ei count 5",
    });

    expect(mockAdbShell).toHaveBeenCalledWith(
      "am broadcast -a com.example.ACTION -n com.example.app/.Receiver --es payload 'a'\\''b' --ei count '5'",
      undefined,
    );
  });

  it("should reject malformed broadcast extras", async () => {
    await expect(
      sendBroadcast({
        action: "com.example.ACTION",
        extras: "--es payload",
      }),
    ).rejects.toThrow("requires a key and value");

    expect(mockAdbShell).not.toHaveBeenCalled();
  });
});
