import dotenv from "dotenv";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

dotenv.config();

const execFileAsync = promisify(execFile);

function parseList(raw: string | undefined): string[] | null {
  if (!raw) return null;
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export const config = {
  androidHome: process.env.ANDROID_HOME ?? "",
  adbPath: process.env.ADB_PATH ?? "adb",
  serial: process.env.ANDROID_SERIAL ?? "",
  allowWrite: process.env.ANDROID_MCP_ALLOW_WRITE === "true",
  allowShell: process.env.ANDROID_MCP_ALLOW_SHELL === "true",
  enabledCategories: parseList(process.env.ANDROID_TOOLS),
  disabledCategories: parseList(process.env.ANDROID_DISABLE),
};

export async function validateConfig(): Promise<void> {
  try {
    await execFileAsync(config.adbPath, ["version"]);
  } catch {
    throw new Error(
      `ADB not found at "${config.adbPath}". ` +
        "Install Android SDK and ensure adb is in PATH, or set ADB_PATH environment variable.",
    );
  }
}
