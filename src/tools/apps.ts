import { z } from "zod";
import { adb, adbShell } from "../adb.js";
import { assertWriteAllowed } from "./utils.js";

// --- Schemas ---

export const listPackagesSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe("Filter packages by name. Example: 'com.google'"),
  type: z
    .enum(["all", "system", "third-party"])
    .optional()
    .default("all")
    .describe("Package type filter: all, system, or third-party."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const getPackageInfoSchema = z.object({
  packageName: z
    .string()
    .describe("Package name. Example: 'com.android.chrome'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const installAppSchema = z.object({
  apkPath: z.string().describe("Local path to the APK file to install."),
  replace: z
    .boolean()
    .optional()
    .default(true)
    .describe("Replace existing app if installed (default: true)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const uninstallAppSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to uninstall. Example: 'com.example.app'"),
  keepData: z
    .boolean()
    .optional()
    .default(false)
    .describe("Keep app data after uninstall (default: false)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const launchAppSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to launch. Example: 'com.android.chrome'"),
  activity: z
    .string()
    .optional()
    .describe(
      "Activity to start. If omitted, launches the default launcher activity.",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const stopAppSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to force stop. Example: 'com.example.app'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

// --- Handlers ---

export async function listPackages(
  params: z.infer<typeof listPackagesSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;

  let flag = "";
  if (params.type === "system") flag = "-s";
  else if (params.type === "third-party") flag = "-3";

  const args = flag ? `pm list packages ${flag}` : "pm list packages";
  const output = await adbShell(args, opts);

  let packages = output
    .split("\n")
    .map((l) => l.replace("package:", "").trim())
    .filter(Boolean);

  if (params.filter) {
    const filter = params.filter.toLowerCase();
    packages = packages.filter((p) => p.toLowerCase().includes(filter));
  }

  packages.sort();

  return { count: packages.length, packages };
}

export async function getPackageInfo(
  params: z.infer<typeof getPackageInfoSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell(
    `dumpsys package ${params.packageName}`,
    opts,
  );

  const info: Record<string, string | string[]> = {
    packageName: params.packageName,
  };

  const versionName = output.match(/versionName=(\S+)/);
  if (versionName) info.versionName = versionName[1];

  const versionCode = output.match(/versionCode=(\d+)/);
  if (versionCode) info.versionCode = versionCode[1];

  const targetSdk = output.match(/targetSdk=(\d+)/);
  if (targetSdk) info.targetSdk = targetSdk[1];

  const minSdk = output.match(/minSdk=(\d+)/);
  if (minSdk) info.minSdk = minSdk[1];

  const firstInstall = output.match(/firstInstallTime=(.+)/);
  if (firstInstall) info.firstInstallTime = firstInstall[1].trim();

  const lastUpdate = output.match(/lastUpdateTime=(.+)/);
  if (lastUpdate) info.lastUpdateTime = lastUpdate[1].trim();

  const permissions: string[] = [];
  const permSection = output.match(
    /requested permissions:\n([\s\S]*?)(?:\n\s*\n|\ninstall permissions:)/,
  );
  if (permSection) {
    const lines = permSection[1].split("\n");
    for (const line of lines) {
      const perm = line.trim();
      if (perm && perm.startsWith("android.permission.")) {
        permissions.push(perm);
      }
    }
  }
  if (permissions.length > 0) info.permissions = permissions;

  return info;
}

export async function installApp(
  params: z.infer<typeof installAppSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const args = ["install"];
  if (params.replace) args.push("-r");
  args.push(params.apkPath);
  const output = await adb(args, { ...opts, timeout: 120_000 });
  return { result: output };
}

export async function uninstallApp(
  params: z.infer<typeof uninstallAppSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const args = ["uninstall"];
  if (params.keepData) args.push("-k");
  args.push(params.packageName);
  const output = await adb(args, opts);
  return { result: output };
}

export async function launchApp(
  params: z.infer<typeof launchAppSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;

  if (params.activity) {
    const component = `${params.packageName}/${params.activity}`;
    const output = await adbShell(`am start -n ${component}`, opts);
    return { result: output };
  }

  const output = await adbShell(
    `monkey -p ${params.packageName} -c android.intent.category.LAUNCHER 1`,
    opts,
  );
  return { result: output };
}

export async function stopApp(
  params: z.infer<typeof stopAppSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell(`am force-stop ${params.packageName}`, opts);
  return { result: output || "App stopped successfully" };
}
