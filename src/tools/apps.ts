import { z } from "zod";
import { adb, adbShell } from "../adb.js";
import {
  assertWriteAllowed,
  formatBroadcastExtras,
  shellEscape,
  validateAction,
  validateActivityName,
  validateComponent,
  validatePackageName,
  validatePermission,
} from "./utils.js";

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
    .describe("Device serial (default: auto)"),
});

export const getPackageInfoSchema = z.object({
  packageName: z
    .string()
    .describe("Package name. Example: 'com.android.chrome'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
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
    .describe("Device serial (default: auto)"),
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
    .describe("Device serial (default: auto)"),
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
    .describe("Device serial (default: auto)"),
});

export const stopAppSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to force stop. Example: 'com.example.app'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
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
  validatePackageName(params.packageName);
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
  validatePackageName(params.packageName);
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
  validatePackageName(params.packageName);

  if (params.activity) {
    validateActivityName(params.activity);
    const component = `${params.packageName}/${params.activity}`;
    validateComponent(component);
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
  validatePackageName(params.packageName);
  const output = await adbShell(`am force-stop ${params.packageName}`, opts);
  return { result: output || "App stopped successfully" };
}

// --- v1.1.0 additions ---

export const clearAppDataSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to clear data for. Example: 'com.example.app'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const grantPermissionSchema = z.object({
  packageName: z
    .string()
    .describe("Package name. Example: 'com.example.app'"),
  permission: z
    .string()
    .describe(
      "Permission to grant. Example: 'android.permission.CAMERA'",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const revokePermissionSchema = z.object({
  packageName: z
    .string()
    .describe("Package name. Example: 'com.example.app'"),
  permission: z
    .string()
    .describe(
      "Permission to revoke. Example: 'android.permission.CAMERA'",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const openUrlSchema = z.object({
  url: z
    .string()
    .describe("URL to open on the device. Example: 'https://google.com'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const sendBroadcastSchema = z.object({
  action: z
    .string()
    .describe(
      "Broadcast action. Example: 'android.intent.action.BOOT_COMPLETED'",
    ),
  extras: z
    .string()
    .optional()
    .describe(
      "Extras flags, e.g. '--es key val --ei count 5'. Supports --es/--ei/--ez/--ef.",
    ),
  component: z
    .string()
    .optional()
    .describe(
      "Target component. Example: 'com.example.app/.MyReceiver'",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const getCurrentActivitySchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export async function clearAppData(
  params: z.infer<typeof clearAppDataSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  validatePackageName(params.packageName);
  const output = await adbShell(`pm clear ${params.packageName}`, opts);
  return { result: output.trim() };
}

export async function grantPermission(
  params: z.infer<typeof grantPermissionSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  validatePackageName(params.packageName);
  validatePermission(params.permission);
  await adbShell(
    `pm grant ${params.packageName} ${params.permission}`,
    opts,
  );
  return {
    result: `Granted ${params.permission} to ${params.packageName}`,
  };
}

export async function revokePermission(
  params: z.infer<typeof revokePermissionSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  validatePackageName(params.packageName);
  validatePermission(params.permission);
  await adbShell(
    `pm revoke ${params.packageName} ${params.permission}`,
    opts,
  );
  return {
    result: `Revoked ${params.permission} from ${params.packageName}`,
  };
}

export async function openUrl(params: z.infer<typeof openUrlSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell(
    `am start -a android.intent.action.VIEW -d ${shellEscape(params.url)}`,
    opts,
  );
  return { result: output };
}

export async function sendBroadcast(
  params: z.infer<typeof sendBroadcastSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  validateAction(params.action);
  let cmd = `am broadcast -a ${params.action}`;
  if (params.component) {
    validateComponent(params.component);
    cmd += ` -n ${params.component}`;
  }
  if (params.extras) {
    const extras = formatBroadcastExtras(params.extras);
    if (extras) cmd += ` ${extras}`;
  }
  const output = await adbShell(cmd, opts);
  return { result: output };
}

export async function getCurrentActivity(
  params: z.infer<typeof getCurrentActivitySchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell(
    "dumpsys activity activities | grep -E 'mResumedActivity|mCurrentFocus'",
    opts,
  );

  const lines = output.split("\n").filter(Boolean);
  const info: Record<string, string> = {};

  for (const line of lines) {
    const resumed = line.match(
      /mResumedActivity.*\{[^}]*\s+([^\s}]+)\s+/,
    );
    if (resumed) info.resumedActivity = resumed[1];

    const focus = line.match(/mCurrentFocus.*\{[^}]*\s+([^\s}]+)\s*\}/);
    if (focus) info.currentFocus = focus[1];
  }

  return { ...info, raw: lines };
}

// --- v1.2.0 additions ---

export const isAppInstalledSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to check. Example: 'com.android.chrome'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export const getAppIntentsSchema = z.object({
  packageName: z
    .string()
    .describe("Package name to discover intents for. Example: 'com.android.chrome'"),
  serial: z
    .string()
    .optional()
    .describe("Device serial (default: auto)"),
});

export async function isAppInstalled(
  params: z.infer<typeof isAppInstalledSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  validatePackageName(params.packageName);
  const output = await adbShell(`pm list packages ${params.packageName}`, opts);
  const installed = output.split("\n").some(
    (l) => l.trim() === `package:${params.packageName}`,
  );
  return { packageName: params.packageName, installed };
}

export async function getAppIntents(
  params: z.infer<typeof getAppIntentsSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  validatePackageName(params.packageName);
  const output = await adbShell(
    `dumpsys package ${params.packageName} | grep -A 1 "android.intent.action"`,
    opts,
  );

  const actions = new Set<string>();
  for (const line of output.split("\n")) {
    const match = line.match(/Action:\s*"([^"]+)"/);
    if (match) actions.add(match[1]);
    const match2 = line.match(/(android\.intent\.action\.\S+)/);
    if (match2) actions.add(match2[1]);
  }

  return {
    packageName: params.packageName,
    intentCount: actions.size,
    intents: [...actions].sort(),
  };
}
