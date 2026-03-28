import { z } from "zod";
import { adb, adbShell } from "../adb.js";
import { assertWriteAllowed } from "./utils.js";

// --- Schemas ---

export const listDevicesSchema = z.object({});

export const getDeviceInfoSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const getDevicePropertiesSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe(
      "Filter properties by prefix. Example: 'ro.build' to get build-related props.",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const connectDeviceSchema = z.object({
  address: z
    .string()
    .describe("Device address in host:port format. Example: '192.168.1.100:5555'"),
});

export const disconnectDeviceSchema = z.object({
  address: z
    .string()
    .optional()
    .describe(
      "Device address to disconnect. Disconnects all TCP/IP devices if omitted.",
    ),
});

// --- Handlers ---

export async function listDevices() {
  const output = await adb(["devices", "-l"]);
  const lines = output.split("\n").filter((l) => l.trim() && !l.startsWith("List"));

  const devices = lines.map((line) => {
    const parts = line.trim().split(/\s+/);
    const serial = parts[0];
    const status = parts[1];
    const details: Record<string, string> = {};
    for (const part of parts.slice(2)) {
      const [key, value] = part.split(":");
      if (key && value) {
        details[key] = value;
      }
    }
    return { serial, status, ...details };
  });

  return { count: devices.length, devices };
}

export async function getDeviceInfo(
  params: z.infer<typeof getDeviceInfoSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;

  const [model, brand, sdk, release, density, size, abi] = await Promise.all([
    adbShell("getprop ro.product.model", opts),
    adbShell("getprop ro.product.brand", opts),
    adbShell("getprop ro.build.version.sdk", opts),
    adbShell("getprop ro.build.version.release", opts),
    adbShell("wm density", opts).catch(() => "unknown"),
    adbShell("wm size", opts).catch(() => "unknown"),
    adbShell("getprop ro.product.cpu.abi", opts),
  ]);

  return {
    model: model.trim(),
    brand: brand.trim(),
    androidVersion: release.trim(),
    sdkVersion: parseInt(sdk.trim(), 10),
    abi: abi.trim(),
    display: {
      density: density.replace("Physical density: ", "").trim(),
      size: size.replace("Physical size: ", "").trim(),
    },
  };
}

export async function getDeviceProperties(
  params: z.infer<typeof getDevicePropertiesSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell("getprop", opts);

  const props: Record<string, string> = {};
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(/^\[(.+?)\]:\s*\[(.*)?\]$/);
    if (match) {
      const key = match[1];
      const value = match[2] ?? "";
      if (!params.filter || key.startsWith(params.filter)) {
        props[key] = value;
      }
    }
  }

  return { count: Object.keys(props).length, properties: props };
}

export async function connectDevice(
  params: z.infer<typeof connectDeviceSchema>,
) {
  assertWriteAllowed();
  const output = await adb(["connect", params.address]);
  return { result: output };
}

export async function disconnectDevice(
  params: z.infer<typeof disconnectDeviceSchema>,
) {
  assertWriteAllowed();
  const args = params.address
    ? ["disconnect", params.address]
    : ["disconnect"];
  const output = await adb(args);
  return { result: output };
}
