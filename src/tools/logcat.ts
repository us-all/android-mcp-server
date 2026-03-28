import { z } from "zod";
import { adb, adbShell } from "../adb.js";
import { assertWriteAllowed } from "./utils.js";

// --- Schemas ---

export const getLogcatSchema = z.object({
  lines: z
    .coerce
    .number()
    .optional()
    .default(100)
    .describe("Number of recent log lines to retrieve (default: 100)."),
  tag: z
    .string()
    .optional()
    .describe("Filter by log tag. Example: 'ActivityManager'"),
  priority: z
    .enum(["V", "D", "I", "W", "E", "F"])
    .optional()
    .describe(
      "Minimum log priority: V(erbose), D(ebug), I(nfo), W(arn), E(rror), F(atal).",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const clearLogcatSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const searchLogcatSchema = z.object({
  pattern: z.string().describe("Text pattern to search for in logs."),
  lines: z
    .coerce
    .number()
    .optional()
    .default(500)
    .describe("Number of recent log lines to search through (default: 500)."),
  caseSensitive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Case sensitive search (default: false)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const getCrashLogsSchema = z.object({
  packageName: z
    .string()
    .optional()
    .describe(
      "Filter crash logs for a specific package. Shows all crashes if omitted.",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

// --- Handlers ---

export async function getLogcat(params: z.infer<typeof getLogcatSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;

  const args = ["logcat", "-d", `-t`, `${params.lines}`];
  if (params.tag && params.priority) {
    args.push(`${params.tag}:${params.priority}`, "*:S");
  } else if (params.tag) {
    args.push(`${params.tag}:V`, "*:S");
  } else if (params.priority) {
    args.push(`*:${params.priority}`);
  }

  const output = await adb(args, opts);
  const lines = output
    .split("\n")
    .filter((l) => l && !l.startsWith("--------- beginning of"));

  return {
    lineCount: lines.length,
    logs: lines,
  };
}

export async function clearLogcat(
  params: z.infer<typeof clearLogcatSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adb(["logcat", "-c"], opts);
  return { result: "Logcat buffer cleared" };
}

export async function searchLogcat(
  params: z.infer<typeof searchLogcatSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adb(
    ["logcat", "-d", "-t", `${params.lines}`],
    opts,
  );

  const lines = output.split("\n").filter(Boolean);
  const pattern = params.caseSensitive
    ? params.pattern
    : params.pattern.toLowerCase();

  const matches = lines.filter((line) => {
    const target = params.caseSensitive ? line : line.toLowerCase();
    return target.includes(pattern);
  });

  return {
    matchCount: matches.length,
    totalSearched: lines.length,
    matches,
  };
}

export async function getCrashLogs(
  params: z.infer<typeof getCrashLogsSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;

  const output = await adbShell("logcat -d -b crash", opts).catch(
    async () => {
      return await adb(["logcat", "-d", "-t", "500"], opts);
    },
  );

  let lines = output.split("\n").filter(Boolean);

  if (params.packageName) {
    lines = lines.filter((line) => line.includes(params.packageName!));
  }

  const fatalLines = lines.filter(
    (line) =>
      line.includes("FATAL") ||
      line.includes("AndroidRuntime") ||
      line.includes("Exception") ||
      line.includes("Error") ||
      line.includes("crash"),
  );

  return {
    crashCount: fatalLines.length,
    crashes: fatalLines.length > 0 ? fatalLines : lines.slice(-50),
  };
}
