import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { adb, adbShell } from "../adb.js";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

// --- Schemas ---

export const bugreportSchema = z.object({
  localPath: z
    .string()
    .describe("Local path to save the bugreport zip file."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const getMemInfoSchema = z.object({
  packageName: z
    .string()
    .optional()
    .describe(
      "Package name for app-specific memory info. Shows system summary if omitted.",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const getGfxInfoSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to get GPU rendering info for."),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const getCpuInfoSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

// --- Handlers ---

export async function bugreport(params: z.infer<typeof bugreportSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adb(
    ["bugreport", params.localPath],
    { ...opts, timeout: 120_000 },
  );
  return { result: output };
}

export async function getMemInfo(params: z.infer<typeof getMemInfoSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const cmd = params.packageName
    ? `dumpsys meminfo ${params.packageName}`
    : "dumpsys meminfo -s";
  const output = await adbShell(cmd, opts);

  if (params.packageName) {
    const info: Record<string, string | number> = {
      packageName: params.packageName,
    };

    const totalPss = output.match(/TOTAL\s+(\d+)/);
    if (totalPss) info.totalPssKB = parseInt(totalPss[1], 10);

    const nativeHeap = output.match(/Native Heap\s+(\d+)/);
    if (nativeHeap) info.nativeHeapKB = parseInt(nativeHeap[1], 10);

    const dalvikHeap = output.match(/Dalvik Heap\s+(\d+)/);
    if (dalvikHeap) info.dalvikHeapKB = parseInt(dalvikHeap[1], 10);

    const views = output.match(/Views:\s*(\d+)/);
    if (views) info.views = parseInt(views[1], 10);

    const activities = output.match(/Activities:\s*(\d+)/);
    if (activities) info.activities = parseInt(activities[1], 10);

    return info;
  }

  // System summary: extract top consumers
  const lines = output.split("\n");
  const summary = lines
    .filter((l) => l.match(/^\s+\d+.*K:/))
    .slice(0, 15)
    .map((l) => l.trim());

  const totalRam = output.match(/Total RAM:\s*([^\n]+)/);
  const freeRam = output.match(/Free RAM:\s*([^\n]+)/);
  const usedRam = output.match(/Used RAM:\s*([^\n]+)/);

  return {
    totalRam: totalRam?.[1]?.trim(),
    freeRam: freeRam?.[1]?.trim(),
    usedRam: usedRam?.[1]?.trim(),
    topConsumers: summary,
  };
}

export async function getGfxInfo(params: z.infer<typeof getGfxInfoSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell(
    `dumpsys gfxinfo ${params.packageName} framestats`,
    opts,
  );

  const info: Record<string, unknown> = {
    packageName: params.packageName,
  };

  const totalFrames = output.match(/Total frames rendered:\s*(\d+)/);
  if (totalFrames) info.totalFrames = parseInt(totalFrames[1], 10);

  const janky = output.match(/Janky frames:\s*(\d+)\s*\(([^)]+)\)/);
  if (janky) {
    info.jankyFrames = parseInt(janky[1], 10);
    info.jankyPercentage = janky[2];
  }

  const p50 = output.match(/50th percentile:\s*(\d+)ms/);
  if (p50) info.p50ms = parseInt(p50[1], 10);

  const p90 = output.match(/90th percentile:\s*(\d+)ms/);
  if (p90) info.p90ms = parseInt(p90[1], 10);

  const p95 = output.match(/95th percentile:\s*(\d+)ms/);
  if (p95) info.p95ms = parseInt(p95[1], 10);

  const p99 = output.match(/99th percentile:\s*(\d+)ms/);
  if (p99) info.p99ms = parseInt(p99[1], 10);

  return info;
}

export async function getCpuInfo(params: z.infer<typeof getCpuInfoSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell("dumpsys cpuinfo", opts);

  const lines = output.split("\n").filter(Boolean);
  const processes = lines
    .filter((l) => l.match(/^\s+[\d.]+%/))
    .slice(0, 20)
    .map((l) => {
      const match = l.match(/^\s+([\d.]+)%\s+([\d.]+)%\s+(\d+)\/(.+)/);
      if (match) {
        return {
          totalCpu: match[1] + "%",
          userCpu: match[2] + "%",
          pid: parseInt(match[3], 10),
          process: match[4].trim(),
        };
      }
      return l.trim();
    });

  const totalLine = lines.find((l) => l.includes("TOTAL"));

  return {
    total: totalLine?.trim(),
    topProcesses: processes,
  };
}

// --- v1.3.0 additions ---

export const doctorSchema = z.object({});

export async function doctor() {
  const checks: Array<{ name: string; status: "ok" | "warn" | "fail"; detail: string }> = [];

  // 1. ADB version
  try {
    const { stdout } = await execFileAsync(config.adbPath, ["version"]);
    const version = stdout.match(/Android Debug Bridge version ([\d.]+)/);
    checks.push({
      name: "ADB",
      status: "ok",
      detail: version ? `v${version[1]}` : stdout.trim().split("\n")[0],
    });
  } catch {
    checks.push({ name: "ADB", status: "fail", detail: `Not found at "${config.adbPath}"` });
  }

  // 2. Connected devices
  try {
    const output = await adb(["devices"]);
    const devices = output.split("\n").filter((l) => l.includes("\tdevice")).length;
    const unauthorized = output.split("\n").filter((l) => l.includes("unauthorized")).length;
    checks.push({
      name: "Devices",
      status: devices > 0 ? "ok" : "fail",
      detail: `${devices} connected${unauthorized ? `, ${unauthorized} unauthorized` : ""}`,
    });
  } catch (e) {
    checks.push({ name: "Devices", status: "fail", detail: (e as Error).message });
  }

  // 3. ANDROID_HOME
  checks.push({
    name: "ANDROID_HOME",
    status: config.androidHome ? "ok" : "warn",
    detail: config.androidHome || "Not set (emulator tools may not work)",
  });

  // 4. Emulator
  if (config.androidHome) {
    try {
      const path = await import("node:path");
      const emuPath = path.default.join(config.androidHome, "emulator", "emulator");
      await execFileAsync(emuPath, ["-list-avds"]);
      checks.push({ name: "Emulator", status: "ok", detail: "Available" });
    } catch {
      checks.push({ name: "Emulator", status: "warn", detail: "Not installed or not in ANDROID_HOME" });
    }
  } else {
    checks.push({ name: "Emulator", status: "warn", detail: "Skipped (ANDROID_HOME not set)" });
  }

  // 5. Write permission
  checks.push({
    name: "Write permission",
    status: config.allowWrite ? "ok" : "warn",
    detail: config.allowWrite ? "Enabled" : "Disabled (set ANDROID_MCP_ALLOW_WRITE=true)",
  });

  // 6. Shell permission
  checks.push({
    name: "Shell permission",
    status: config.allowShell ? "ok" : "warn",
    detail: config.allowShell ? "Enabled" : "Disabled (set ANDROID_MCP_ALLOW_SHELL=true)",
  });

  // 7. Target device info
  if (config.serial) {
    checks.push({ name: "Target device", status: "ok", detail: config.serial });
  }

  const allOk = checks.every((c) => c.status === "ok");
  const hasFail = checks.some((c) => c.status === "fail");

  return {
    status: hasFail ? "FAIL" : allOk ? "OK" : "WARN",
    checks,
  };
}
