import { z } from "zod";
import { adb, adbShell } from "../adb.js";
import { assertWriteAllowed } from "./utils.js";

// --- Schemas ---

export const getBatteryInfoSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const getNetworkInfoSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const changeSettingSchema = z.object({
  namespace: z
    .enum(["system", "secure", "global"])
    .describe("Settings namespace: system, secure, or global."),
  key: z.string().describe("Setting key. Example: 'screen_brightness'"),
  value: z.string().describe("Setting value."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

// --- Handlers ---

export async function getBatteryInfo(
  params: z.infer<typeof getBatteryInfoSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell("dumpsys battery", opts);

  const info: Record<string, string | number | boolean> = {};
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s+(\w[\w\s]*?):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().replace(/\s+/g, "_").toLowerCase();
      const val = match[2].trim();
      if (val === "true" || val === "false") {
        info[key] = val === "true";
      } else if (/^\d+$/.test(val)) {
        info[key] = parseInt(val, 10);
      } else {
        info[key] = val;
      }
    }
  }

  return info;
}

export async function getNetworkInfo(
  params: z.infer<typeof getNetworkInfoSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;

  const [wifi, connectivity, ip] = await Promise.all([
    adbShell("dumpsys wifi | head -20", opts).catch(() => ""),
    adbShell(
      "dumpsys connectivity | grep -A 5 'NetworkAgentInfo'",
      opts,
    ).catch(() => ""),
    adbShell("ip addr show", opts).catch(() => ""),
  ]);

  const wifiEnabled = wifi.includes("Wi-Fi is enabled") || wifi.includes("mWifiEnabled true");
  const ipMatch = ip.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\/\d+.*wlan/);

  return {
    wifi: {
      enabled: wifiEnabled,
      ipAddress: ipMatch ? ipMatch[1] : undefined,
      details: wifi.split("\n").slice(0, 10).filter(Boolean),
    },
    connectivity: connectivity.split("\n").filter(Boolean).slice(0, 10),
  };
}

export async function changeSetting(
  params: z.infer<typeof changeSettingSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell(
    `settings put ${params.namespace} ${params.key} ${params.value}`,
    opts,
  );

  const verify = await adbShell(
    `settings get ${params.namespace} ${params.key}`,
    opts,
  );

  return {
    result: `Set ${params.namespace}/${params.key} = ${params.value}`,
    currentValue: verify.trim(),
  };
}

// --- v1.1.0 additions ---

export const getSettingSchema = z.object({
  namespace: z
    .enum(["system", "secure", "global"])
    .describe("Settings namespace: system, secure, or global."),
  key: z.string().describe("Setting key. Example: 'screen_brightness'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const setDisplaySizeSchema = z.object({
  width: z.coerce.number().optional().describe("Width in pixels. Omit both to reset to default."),
  height: z.coerce.number().optional().describe("Height in pixels. Omit both to reset to default."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const setDisplayDensitySchema = z.object({
  dpi: z.coerce.number().optional().describe("Density in DPI. Omit to reset to default."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const keepScreenOnSchema = z.object({
  enabled: z
    .boolean()
    .describe("true to keep screen on while charging, false to disable."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const portForwardSchema = z.object({
  hostPort: z.coerce.number().describe("Port on the host machine."),
  devicePort: z.coerce.number().describe("Port on the Android device."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const reverseForwardSchema = z.object({
  devicePort: z.coerce.number().describe("Port on the Android device."),
  hostPort: z.coerce.number().describe("Port on the host machine."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const listForwardsSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const removeForwardSchema = z.object({
  hostPort: z.coerce
    .number()
    .optional()
    .describe("Host port to remove. Removes all forwards if omitted."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export async function getSetting(
  params: z.infer<typeof getSettingSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const value = await adbShell(
    `settings get ${params.namespace} ${params.key}`,
    opts,
  );
  return {
    namespace: params.namespace,
    key: params.key,
    value: value.trim(),
  };
}

export async function setDisplaySize(
  params: z.infer<typeof setDisplaySizeSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  if (params.width && params.height) {
    await adbShell(`wm size ${params.width}x${params.height}`, opts);
  } else {
    await adbShell("wm size reset", opts);
  }
  const current = await adbShell("wm size", opts);
  return { result: current.trim() };
}

export async function setDisplayDensity(
  params: z.infer<typeof setDisplayDensitySchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  if (params.dpi) {
    await adbShell(`wm density ${params.dpi}`, opts);
  } else {
    await adbShell("wm density reset", opts);
  }
  const current = await adbShell("wm density", opts);
  return { result: current.trim() };
}

export async function keepScreenOn(
  params: z.infer<typeof keepScreenOnSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const value = params.enabled ? "true" : "false";
  await adbShell(`svc power stayon ${value}`, opts);
  return { result: `Keep screen on: ${value}` };
}

export async function portForward(
  params: z.infer<typeof portForwardSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adb(
    ["forward", `tcp:${params.hostPort}`, `tcp:${params.devicePort}`],
    opts,
  );
  return {
    result: output || `Forwarding host:${params.hostPort} → device:${params.devicePort}`,
  };
}

export async function reverseForward(
  params: z.infer<typeof reverseForwardSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adb(
    ["reverse", `tcp:${params.devicePort}`, `tcp:${params.hostPort}`],
    opts,
  );
  return {
    result: output || `Reverse forwarding device:${params.devicePort} → host:${params.hostPort}`,
  };
}

export async function listForwards(
  params: z.infer<typeof listForwardsSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const [fwd, rev] = await Promise.all([
    adb(["forward", "--list"], opts).catch(() => ""),
    adb(["reverse", "--list"], opts).catch(() => ""),
  ]);
  return {
    forwards: fwd.split("\n").filter(Boolean),
    reverses: rev.split("\n").filter(Boolean),
  };
}

export async function removeForward(
  params: z.infer<typeof removeForwardSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  if (params.hostPort) {
    await adb(["forward", "--remove", `tcp:${params.hostPort}`], opts);
    return { result: `Removed forward for host:${params.hostPort}` };
  }
  await adb(["forward", "--remove-all"], opts);
  await adb(["reverse", "--remove-all"], opts);
  return { result: "Removed all forwards and reverses" };
}
