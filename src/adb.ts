import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT = 30_000;

export interface AdbOptions {
  serial?: string;
  timeout?: number;
}

function buildArgs(args: string[], options?: AdbOptions): string[] {
  const serial = options?.serial ?? config.serial;
  if (serial) {
    return ["-s", serial, ...args];
  }
  return args;
}

export async function adb(
  args: string[],
  options?: AdbOptions,
): Promise<string> {
  const fullArgs = buildArgs(args, options);
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const { stdout } = await execFileAsync(config.adbPath, fullArgs, {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trim();
}

export async function adbShell(
  command: string,
  options?: AdbOptions,
): Promise<string> {
  return adb(["shell", command], options);
}

export async function adbRawBuffer(
  args: string[],
  options?: AdbOptions,
): Promise<Buffer> {
  const fullArgs = buildArgs(args, options);
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const { stdout } = await execFileAsync(config.adbPath, fullArgs, {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "buffer",
  });

  return stdout;
}
