import dotenv from "dotenv";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

dotenv.config();

const execFileAsync = promisify(execFile);

export const config = {
  androidHome: process.env.ANDROID_HOME ?? "",
  adbPath: process.env.ADB_PATH ?? "adb",
  serial: process.env.ANDROID_SERIAL ?? "",
  allowWrite: process.env.ANDROID_MCP_ALLOW_WRITE === "true",
  allowShell: process.env.ANDROID_MCP_ALLOW_SHELL === "true",
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
