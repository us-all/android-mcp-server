import { z } from "zod/v4";
import { getPackageInfo } from "./apps.js";
import { getMemInfo } from "./debug.js";

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
