import { z } from "zod";
import { adbShell } from "../adb.js";
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
