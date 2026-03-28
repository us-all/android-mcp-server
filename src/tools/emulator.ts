import { z } from "zod";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { config } from "../config.js";
import { adb, adbShell } from "../adb.js";
import { assertWriteAllowed } from "./utils.js";

const execFileAsync = promisify(execFile);

function getEmulatorPath(): string {
  if (config.androidHome) {
    return path.join(config.androidHome, "emulator", "emulator");
  }
  return "emulator";
}

function getAvdManagerPath(): string {
  if (config.androidHome) {
    return path.join(config.androidHome, "cmdline-tools", "latest", "bin", "avdmanager");
  }
  return "avdmanager";
}

// --- Schemas ---

export const listAvdsSchema = z.object({});

export const startEmulatorSchema = z.object({
  avdName: z.string().describe("Name of the AVD to start."),
  noWindow: z
    .boolean()
    .optional()
    .default(false)
    .describe("Start emulator without GUI window (headless mode)."),
  wipeData: z
    .boolean()
    .optional()
    .default(false)
    .describe("Wipe user data before starting."),
});

export const stopEmulatorSchema = z.object({
  serial: z
    .string()
    .optional()
    .default("emulator-5554")
    .describe(
      "Emulator serial number to stop (default: 'emulator-5554').",
    ),
});

export const listSnapshotsSchema = z.object({
  serial: z
    .string()
    .optional()
    .default("emulator-5554")
    .describe("Emulator serial number (default: 'emulator-5554')."),
});

export const loadSnapshotSchema = z.object({
  snapshotName: z.string().describe("Name of the snapshot to load."),
  serial: z
    .string()
    .optional()
    .default("emulator-5554")
    .describe("Emulator serial number (default: 'emulator-5554')."),
});

// --- Handlers ---

export async function listAvds() {
  const emulatorPath = getEmulatorPath();
  try {
    const { stdout } = await execFileAsync(emulatorPath, ["-list-avds"]);
    const avds = stdout
      .trim()
      .split("\n")
      .filter(Boolean);
    return { count: avds.length, avds };
  } catch {
    try {
      const avdManagerPath = getAvdManagerPath();
      const { stdout } = await execFileAsync(avdManagerPath, ["list", "avd", "-c"]);
      const avds = stdout
        .trim()
        .split("\n")
        .filter(Boolean);
      return { count: avds.length, avds };
    } catch {
      return {
        count: 0,
        avds: [],
        error:
          "Could not list AVDs. Ensure ANDROID_HOME is set and emulator/avdmanager is available.",
      };
    }
  }
}

export async function startEmulator(
  params: z.infer<typeof startEmulatorSchema>,
) {
  assertWriteAllowed();
  const emulatorPath = getEmulatorPath();
  const args = ["-avd", params.avdName];
  if (params.noWindow) args.push("-no-window");
  if (params.wipeData) args.push("-wipe-data");

  const child = spawn(emulatorPath, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return {
    result: `Emulator '${params.avdName}' starting...`,
    pid: child.pid,
  };
}

export async function stopEmulator(
  params: z.infer<typeof stopEmulatorSchema>,
) {
  assertWriteAllowed();
  const output = await adb(["emu", "kill"], { serial: params.serial });
  return { result: output || "Emulator stopped" };
}

export async function listSnapshots(
  params: z.infer<typeof listSnapshotsSchema>,
) {
  try {
    const output = await adbShell(
      "ls /data/misc/snapshots/ 2>/dev/null || echo 'default_boot'",
      { serial: params.serial },
    );
    const snapshots = output
      .trim()
      .split("\n")
      .filter(Boolean);
    return { count: snapshots.length, snapshots };
  } catch {
    return { count: 0, snapshots: [], note: "Snapshot listing not supported on this device" };
  }
}

export async function loadSnapshot(
  params: z.infer<typeof loadSnapshotSchema>,
) {
  assertWriteAllowed();
  const output = await adb(
    ["emu", "avd", "snapshot", "load", params.snapshotName],
    { serial: params.serial },
  );
  return { result: output || `Snapshot '${params.snapshotName}' loaded` };
}

// --- v1.2.0 additions ---

export const saveSnapshotSchema = z.object({
  snapshotName: z.string().describe("Name for the new snapshot."),
  serial: z
    .string()
    .optional()
    .default("emulator-5554")
    .describe("Emulator serial number (default: 'emulator-5554')."),
});

export const deleteSnapshotSchema = z.object({
  snapshotName: z.string().describe("Name of the snapshot to delete."),
  serial: z
    .string()
    .optional()
    .default("emulator-5554")
    .describe("Emulator serial number (default: 'emulator-5554')."),
});

export async function saveSnapshot(
  params: z.infer<typeof saveSnapshotSchema>,
) {
  assertWriteAllowed();
  const output = await adb(
    ["emu", "avd", "snapshot", "save", params.snapshotName],
    { serial: params.serial },
  );
  return { result: output || `Snapshot '${params.snapshotName}' saved` };
}

export async function deleteSnapshot(
  params: z.infer<typeof deleteSnapshotSchema>,
) {
  assertWriteAllowed();
  const output = await adb(
    ["emu", "avd", "snapshot", "delete", params.snapshotName],
    { serial: params.serial },
  );
  return { result: output || `Snapshot '${params.snapshotName}' deleted` };
}
