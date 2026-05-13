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
  changeSetting,
  getBatteryInfo,
  getNetworkInfo,
  getSetting,
  setDisplayDensity,
  setDisplaySize,
  unlockDevice,
} from "../src/tools/system.js";

const mockAdbShell = vi.mocked(adbShell);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBatteryInfo", () => {
  it("should parse battery dumpsys output", async () => {
    mockAdbShell.mockResolvedValue(
      "Current Battery Service state:\n" +
        "  AC powered: true\n" +
        "  USB powered: false\n" +
        "  status: 2\n" +
        "  health: 2\n" +
        "  present: true\n" +
        "  level: 85\n" +
        "  scale: 100\n" +
        "  voltage: 4200\n" +
        "  temperature: 310\n" +
        "  technology: Li-ion\n",
    );

    const result = await getBatteryInfo({});

    expect(result.ac_powered).toBe(true);
    expect(result.usb_powered).toBe(false);
    expect(result.level).toBe(85);
    expect(result.voltage).toBe(4200);
    expect(result.temperature).toBe(310);
    expect(result.technology).toBe("Li-ion");
    expect(result.present).toBe(true);
  });

  it("should handle boolean, number, and string values", async () => {
    mockAdbShell.mockResolvedValue(
      "  flag: true\n" +
        "  count: 42\n" +
        "  name: something\n",
    );

    const result = await getBatteryInfo({});

    expect(result.flag).toBe(true);
    expect(result.count).toBe(42);
    expect(result.name).toBe("something");
  });
});

describe("getNetworkInfo", () => {
  it("should detect WiFi enabled state", async () => {
    mockAdbShell
      .mockResolvedValueOnce("Wi-Fi is enabled\nSSID: MyNetwork\n")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(
        "2: wlan0: <BROADCAST> mtu 1500\n    inet 192.168.1.100/24 brd 192.168.1.255 scope global wlan0\n",
      );

    const result = await getNetworkInfo({});

    expect(result.wifi.enabled).toBe(true);
    expect(result.wifi.ipAddress).toBe("192.168.1.100");
  });

  it("should handle WiFi disabled state", async () => {
    mockAdbShell
      .mockResolvedValueOnce("Wi-Fi is disabled\n")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("1: lo: <LOOPBACK>\n    inet 127.0.0.1/8\n");

    const result = await getNetworkInfo({});

    expect(result.wifi.enabled).toBe(false);
    expect(result.wifi.ipAddress).toBeUndefined();
  });
});

describe("settings shell argument safety", () => {
  it("should validate setting keys and escape values", async () => {
    mockAdbShell.mockResolvedValueOnce("").mockResolvedValueOnce("hello world\n");

    const result = await changeSetting({
      namespace: "system",
      key: "screen_off_timeout",
      value: "hello world",
    });

    expect(mockAdbShell).toHaveBeenNthCalledWith(
      1,
      "settings put system screen_off_timeout 'hello world'",
      undefined,
    );
    expect(result.currentValue).toBe("hello world");
  });

  it("should reject invalid setting keys", async () => {
    await expect(
      getSetting({ namespace: "secure", key: "name;id" }),
    ).rejects.toThrow("Invalid setting key");

    expect(mockAdbShell).not.toHaveBeenCalled();
  });
});

describe("display shell argument safety", () => {
  it("should validate display size numbers before shelling out", async () => {
    await expect(
      setDisplaySize({ width: -1, height: 1920 }),
    ).rejects.toThrow("Invalid display width");

    expect(mockAdbShell).not.toHaveBeenCalled();
  });

  it("should validate display density numbers before shelling out", async () => {
    await expect(
      setDisplayDensity({ dpi: 0 }),
    ).rejects.toThrow("Invalid display density");

    expect(mockAdbShell).not.toHaveBeenCalled();
  });
});

describe("unlock shell argument safety", () => {
  it("should escape PIN text passed to input", async () => {
    mockAdbShell.mockResolvedValue("");

    await unlockDevice({ pin: "12'34;id" });

    expect(mockAdbShell).toHaveBeenNthCalledWith(
      3,
      "input text '12'\\''34;id'",
      undefined,
    );
  });
});
