import { z } from "zod";
import { adb, adbShell } from "../adb.js";
import {
  assertWriteAllowed,
  shellEscape,
  validatePositiveInteger,
  validateSettingKey,
  validateSettingValue,
} from "./utils.js";

// --- Schemas ---

export const getBatteryInfoSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const getNetworkInfoSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
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
    .describe("Device serial (default: auto)"),
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
  validateSettingKey(params.key);
  validateSettingValue(params.value);
  await adbShell(
    `settings put ${params.namespace} ${params.key} ${shellEscape(params.value)}`,
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
    .describe("Device serial (default: auto)"),
});

export const setDisplaySizeSchema = z.object({
  width: z.coerce.number().optional().describe("Width in pixels. Omit both to reset to default."),
  height: z.coerce.number().optional().describe("Height in pixels. Omit both to reset to default."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const setDisplayDensitySchema = z.object({
  dpi: z.coerce.number().optional().describe("Density in DPI. Omit to reset to default."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const keepScreenOnSchema = z.object({
  enabled: z
    .boolean()
    .describe("true to keep screen on while charging, false to disable."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const portForwardSchema = z.object({
  hostPort: z.coerce.number().describe("Port on the host machine."),
  devicePort: z.coerce.number().describe("Port on the Android device."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const reverseForwardSchema = z.object({
  devicePort: z.coerce.number().describe("Port on the Android device."),
  hostPort: z.coerce.number().describe("Port on the host machine."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const listForwardsSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const removeForwardSchema = z.object({
  hostPort: z.coerce
    .number()
    .optional()
    .describe("Host port to remove. Removes all forwards if omitted."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export async function getSetting(
  params: z.infer<typeof getSettingSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  validateSettingKey(params.key);
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
  if (params.width !== undefined || params.height !== undefined) {
    if (params.width === undefined || params.height === undefined) {
      throw new Error("Display width and height must be provided together.");
    }
    validatePositiveInteger(params.width, "display width");
    validatePositiveInteger(params.height, "display height");
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
  if (params.dpi !== undefined) {
    validatePositiveInteger(params.dpi, "display density");
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

// --- v1.2.0 additions ---

export const toggleWifiSchema = z.object({
  enabled: z.boolean().describe("true to enable WiFi, false to disable."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const toggleMobileDataSchema = z.object({
  enabled: z.boolean().describe("true to enable mobile data, false to disable."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const openNotificationSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const lockDeviceSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const unlockDeviceSchema = z.object({
  pin: z
    .string()
    .optional()
    .describe("PIN or password to unlock. Omit if no lock screen security."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const getOrientationSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const setOrientationSchema = z.object({
  orientation: z
    .enum(["portrait", "landscape", "auto"])
    .describe("Screen orientation: portrait (0), landscape (1), or auto (enable auto-rotate)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const listSettingsSchema = z.object({
  namespace: z
    .enum(["system", "secure", "global"])
    .describe("Settings namespace to list."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export async function toggleWifi(
  params: z.infer<typeof toggleWifiSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const cmd = params.enabled ? "svc wifi enable" : "svc wifi disable";
  await adbShell(cmd, opts);
  return { result: `WiFi ${params.enabled ? "enabled" : "disabled"}` };
}

export async function toggleMobileData(
  params: z.infer<typeof toggleMobileDataSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const cmd = params.enabled ? "svc data enable" : "svc data disable";
  await adbShell(cmd, opts);
  return { result: `Mobile data ${params.enabled ? "enabled" : "disabled"}` };
}

export async function openNotification(
  params: z.infer<typeof openNotificationSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell("cmd statusbar expand-notifications", opts);
  return { result: "Notification panel opened" };
}

export async function lockDevice(
  params: z.infer<typeof lockDeviceSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell("input keyevent KEYCODE_POWER", opts);
  return { result: "Device locked (power button pressed)" };
}

export async function unlockDevice(
  params: z.infer<typeof unlockDeviceSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  // Wake up
  await adbShell("input keyevent KEYCODE_WAKEUP", opts);
  // Swipe up to dismiss lock screen
  await adbShell("input swipe 540 1800 540 800 300", opts);
  // Enter PIN if provided
  if (params.pin) {
    await adbShell(`input text ${shellEscape(params.pin)}`, opts);
    await adbShell("input keyevent KEYCODE_ENTER", opts);
  }
  return { result: "Device unlock attempted" };
}

export async function getOrientation(
  params: z.infer<typeof getOrientationSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const [rotation, autoRotate] = await Promise.all([
    adbShell("dumpsys input | grep 'SurfaceOrientation'", opts).catch(() => ""),
    adbShell("settings get system accelerometer_rotation", opts).catch(() => "0"),
  ]);

  const rotMatch = rotation.match(/SurfaceOrientation:\s*(\d)/);
  const rotValue = rotMatch ? parseInt(rotMatch[1], 10) : 0;
  const orientations = ["portrait", "landscape", "reverse-portrait", "reverse-landscape"];

  return {
    rotation: rotValue,
    orientation: orientations[rotValue] ?? "unknown",
    autoRotate: autoRotate.trim() === "1",
  };
}

export async function setOrientation(
  params: z.infer<typeof setOrientationSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;

  if (params.orientation === "auto") {
    await adbShell("settings put system accelerometer_rotation 1", opts);
    return { result: "Auto-rotate enabled" };
  }

  // Disable auto-rotate first
  await adbShell("settings put system accelerometer_rotation 0", opts);
  const value = params.orientation === "portrait" ? "0" : "1";
  await adbShell(
    `settings put system user_rotation ${value}`,
    opts,
  );
  return { result: `Orientation set to ${params.orientation}` };
}

export async function listSettings(
  params: z.infer<typeof listSettingsSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell(
    `settings list ${params.namespace}`,
    opts,
  );

  const settings: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      settings[line.substring(0, idx)] = line.substring(idx + 1);
    }
  }

  return { namespace: params.namespace, count: Object.keys(settings).length, settings };
}
