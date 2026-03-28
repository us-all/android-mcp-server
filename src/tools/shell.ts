import { z } from "zod";
import { adbShell } from "../adb.js";
import { assertShellAllowed } from "./utils.js";

// --- Schema ---

export const executeShellSchema = z.object({
  command: z
    .string()
    .min(1, "Command must not be empty")
    .describe(
      "ADB shell command to execute. Example: 'ls /data/local/tmp'",
    ),
  timeout: z
    .coerce
    .number()
    .optional()
    .default(30000)
    .describe("Command timeout in milliseconds (default: 30000)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

// --- Handler ---

export async function executeShell(
  params: z.infer<typeof executeShellSchema>,
) {
  assertShellAllowed();
  const opts = {
    ...(params.serial ? { serial: params.serial } : {}),
    timeout: params.timeout,
  };
  const output = await adbShell(params.command, opts);
  return {
    command: params.command,
    output,
  };
}
