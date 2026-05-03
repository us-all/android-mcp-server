import { z } from "zod/v4";
import { aggregate, extractFieldsDescription } from "@us-all/mcp-toolkit";
import { getPackageInfo } from "./apps.js";
import { getMemInfo, getCpuInfo } from "./debug.js";
import { getBatteryInfo, getNetworkInfo } from "./system.js";
import { config } from "../config.js";

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

  const caveats: string[] = [];

  const { info, memory } = await aggregate(
    {
      info: () => getPackageInfo({ packageName, serial }),
      memory: includeMemory ? () => getMemInfo({ packageName, serial }) : () => Promise.resolve(null),
    },
    caveats,
  );

  return {
    packageName,
    info,
    memory,
    summary: {
      packageFound: info !== null,
      memoryIncluded: !!memory,
    },
    caveats,
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

  const caveats: string[] = [];

  const { battery, memory, cpu, network } = await aggregate(
    {
      battery: () => getBatteryInfo({ serial }),
      memory: () => getMemInfo({ serial }),
      cpu: () => getCpuInfo({ serial }),
      network: () => getNetworkInfo({ serial }),
    },
    caveats,
  );

  return {
    serial: resolvedSerial,
    battery,
    memory,
    cpu,
    network,
    caveats,
  };
}
