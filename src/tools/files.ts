import { z } from "zod";
import { adb, adbShell } from "../adb.js";
import { assertWriteAllowed, shellEscape, validateDevicePath } from "./utils.js";

// --- Schemas ---

export const listFilesSchema = z.object({
  path: z
    .string()
    .optional()
    .default("/sdcard")
    .describe("Directory path on device (default: /sdcard)."),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("List files recursively (default: false)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const pullFileSchema = z.object({
  remotePath: z
    .string()
    .describe("File path on the device to pull."),
  localPath: z
    .string()
    .describe("Local destination path."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const pushFileSchema = z.object({
  localPath: z.string().describe("Local file path to push."),
  remotePath: z
    .string()
    .describe("Destination path on the device."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const deleteFileSchema = z.object({
  path: z.string().describe("File or directory path on the device to delete."),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Delete recursively for directories (default: false)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

// --- Handlers ---

export async function listFiles(params: z.infer<typeof listFilesSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const flag = params.recursive ? "-lR" : "-la";
  validateDevicePath(params.path);
  const output = await adbShell(`ls ${flag} ${shellEscape(params.path)}`, opts);

  const lines = output.split("\n").filter(Boolean);
  return {
    path: params.path,
    count: lines.length,
    entries: lines,
  };
}

export async function pullFile(params: z.infer<typeof pullFileSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adb(
    ["pull", params.remotePath, params.localPath],
    opts,
  );
  return { result: output };
}

export async function pushFile(params: z.infer<typeof pushFileSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adb(
    ["push", params.localPath, params.remotePath],
    opts,
  );
  return { result: output };
}

export async function deleteFile(params: z.infer<typeof deleteFileSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const flag = params.recursive ? "-rf" : "-f";
  validateDevicePath(params.path);
  const output = await adbShell(`rm ${flag} ${shellEscape(params.path)}`, opts);
  return { result: output || `Deleted: ${params.path}` };
}
