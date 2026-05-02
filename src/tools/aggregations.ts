import { z } from "zod/v4";
import { getPackageInfo } from "./apps.js";
import { getMemInfo, getCpuInfo } from "./debug.js";
import { getBatteryInfo, getNetworkInfo } from "./system.js";
import { config } from "../config.js";
import { extractFieldsDescription } from "@us-all/mcp-toolkit";

/**
 * `analyze-app` — aggregated view of an Android app.
 * Combines package metadata + memory usage + recent crash detection.
 */

export const analyzeAppSchema = z.object({
  packageName: z.string().describe("App package name (e.g. com.example.app)"),
  serial: z.string().optional().describe("Device serial (auto if single device)"),
  includeMemory: z.boolean().optional().default(true).describe("Include memory PSS/heap (default true)"),
  extractFields: z.string().optional().describe("Comma-separated dotted paths to project from response. Use `*` as wildcard."),
});

export async function analyzeApp(params: z.infer<typeof analyzeAppSchema>) {
  const { packageName, serial, includeMemory } = params;

  const [pkgR, memR] = await Promise.allSettled([
    getPackageInfo({ packageName, serial }),
    includeMemory
      ? getMemInfo({ packageName, serial })
      : Promise.resolve(null),
  ]);

  const pkg = pkgR.status === "fulfilled" ? pkgR.value : null;
  const mem = memR.status === "fulfilled" ? memR.value : null;

  return {
    packageName,
    info: pkg,
    memory: mem,
    summary: {
      packageFound: pkgR.status === "fulfilled",
      memoryIncluded: !!mem,
    },
  };
}

/**
 * `device-health` — aggregated device-wide health snapshot.
 * Combines battery + system memory + cpu + network in one call.
 * Useful for periodic monitoring or before/after snapshots.
 */

export const deviceHealthSchema = z.object({
  serial: z.string().optional().describe("Device serial (default: auto)"),
  extractFields: z.string().optional().describe(extractFieldsDescription),
});

export async function deviceHealth(params: z.infer<typeof deviceHealthSchema>) {
  const { serial } = params;
  const resolvedSerial = serial ?? config.serial ?? null;

  const [batteryR, memR, cpuR, networkR] = await Promise.allSettled([
    getBatteryInfo({ serial }),
    getMemInfo({ serial }),
    getCpuInfo({ serial }),
    getNetworkInfo({ serial }),
  ]);

  const caveats: string[] = [];

  const battery = batteryR.status === "fulfilled" ? batteryR.value : null;
  if (batteryR.status === "rejected") {
    caveats.push(`battery: ${batteryR.reason instanceof Error ? batteryR.reason.message : String(batteryR.reason)}`);
  }

  const memory = memR.status === "fulfilled" ? memR.value : null;
  if (memR.status === "rejected") {
    caveats.push(`memory: ${memR.reason instanceof Error ? memR.reason.message : String(memR.reason)}`);
  }

  const cpu = cpuR.status === "fulfilled" ? cpuR.value : null;
  if (cpuR.status === "rejected") {
    caveats.push(`cpu: ${cpuR.reason instanceof Error ? cpuR.reason.message : String(cpuR.reason)}`);
  }

  const network = networkR.status === "fulfilled" ? networkR.value : null;
  if (networkR.status === "rejected") {
    caveats.push(`network: ${networkR.reason instanceof Error ? networkR.reason.message : String(networkR.reason)}`);
  }

  return {
    serial: resolvedSerial,
    battery,
    memory,
    cpu,
    network,
    caveats,
  };
}
