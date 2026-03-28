import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/adb.js", () => ({
  adb: vi.fn(),
  adbShell: vi.fn(),
}));

import { adb, adbShell } from "../src/adb.js";
import { listDevices, getDeviceInfo, getDeviceProperties } from "../src/tools/device.js";

const mockAdb = vi.mocked(adb);
const mockAdbShell = vi.mocked(adbShell);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDevices", () => {
  it("should parse device list with details", async () => {
    mockAdb.mockResolvedValue(
      "List of devices attached\n" +
        "R3CX90B0JDF            device usb:1-1 product:e1sksx model:SM_S921N device:e1s transport_id:9\n" +
        "emulator-5554          device product:sdk_gphone64 model:sdk_gphone64_arm64 device:emu64a transport_id:1\n",
    );

    const result = await listDevices();

    expect(result.count).toBe(2);
    expect(result.devices[0].serial).toBe("R3CX90B0JDF");
    expect(result.devices[0].status).toBe("device");
    expect(result.devices[0].model).toBe("SM_S921N");
    expect(result.devices[1].serial).toBe("emulator-5554");
  });

  it("should handle empty device list", async () => {
    mockAdb.mockResolvedValue("List of devices attached\n");

    const result = await listDevices();
    expect(result.count).toBe(0);
    expect(result.devices).toEqual([]);
  });

  it("should handle unauthorized devices", async () => {
    mockAdb.mockResolvedValue(
      "List of devices attached\nABC123    unauthorized usb:1-2\n",
    );

    const result = await listDevices();
    expect(result.count).toBe(1);
    expect(result.devices[0].status).toBe("unauthorized");
  });
});

describe("getDeviceInfo", () => {
  it("should parse device info from multiple getprop calls", async () => {
    mockAdbShell
      .mockResolvedValueOnce("SM-S921N")      // model
      .mockResolvedValueOnce("samsung")        // brand
      .mockResolvedValueOnce("36")             // sdk
      .mockResolvedValueOnce("16")             // release
      .mockResolvedValueOnce("Physical density: 480") // density
      .mockResolvedValueOnce("Physical size: 1080x2340") // size
      .mockResolvedValueOnce("arm64-v8a");     // abi

    const result = await getDeviceInfo({});

    expect(result.model).toBe("SM-S921N");
    expect(result.brand).toBe("samsung");
    expect(result.sdkVersion).toBe(36);
    expect(result.androidVersion).toBe("16");
    expect(result.abi).toBe("arm64-v8a");
    expect(result.display.density).toBe("480");
    expect(result.display.size).toBe("1080x2340");
  });
});

describe("getDeviceProperties", () => {
  it("should parse getprop output", async () => {
    mockAdbShell.mockResolvedValue(
      "[ro.build.version.sdk]: [36]\n" +
        "[ro.build.version.release]: [16]\n" +
        "[ro.product.model]: [SM-S921N]\n" +
        "[persist.sys.timezone]: [Asia/Seoul]\n",
    );

    const result = await getDeviceProperties({});

    expect(result.count).toBe(4);
    expect(result.properties["ro.build.version.sdk"]).toBe("36");
    expect(result.properties["ro.product.model"]).toBe("SM-S921N");
  });

  it("should filter properties by prefix", async () => {
    mockAdbShell.mockResolvedValue(
      "[ro.build.version.sdk]: [36]\n" +
        "[ro.build.version.release]: [16]\n" +
        "[ro.product.model]: [SM-S921N]\n",
    );

    const result = await getDeviceProperties({ filter: "ro.build" });

    expect(result.count).toBe(2);
    expect(result.properties["ro.product.model"]).toBeUndefined();
  });

  it("should handle empty property values", async () => {
    mockAdbShell.mockResolvedValue("[ro.test.empty]: []\n");

    const result = await getDeviceProperties({});

    expect(result.count).toBe(1);
    expect(result.properties["ro.test.empty"]).toBe("");
  });
});
