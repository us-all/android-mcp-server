import { config } from "../config.js";

const SENSITIVE_PATTERNS = [
  /api[_-]?key/gi,
  /secret/gi,
  /password/gi,
  /token/gi,
  /bearer\s+\S+/gi,
  /authorization/gi,
];

function sanitize(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export class WriteBlockedError extends Error {
  constructor() {
    super(
      "Write operations are disabled. Set ANDROID_MCP_ALLOW_WRITE=true to enable.",
    );
    this.name = "WriteBlockedError";
  }
}

export class ShellBlockedError extends Error {
  constructor() {
    super(
      "Shell command execution is disabled. Set ANDROID_MCP_ALLOW_SHELL=true to enable.",
    );
    this.name = "ShellBlockedError";
  }
}

export function assertWriteAllowed(): void {
  if (!config.allowWrite) {
    throw new WriteBlockedError();
  }
}

export function assertShellAllowed(): void {
  if (!config.allowShell) {
    throw new ShellBlockedError();
  }
}

export function wrapToolHandler<T>(fn: (params: T) => Promise<unknown>) {
  return async (params: T) => {
    try {
      const result = await fn(params);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (error) {
      if (error instanceof WriteBlockedError || error instanceof ShellBlockedError) {
        return {
          content: [{ type: "text" as const, text: error.message }],
          isError: true,
        };
      }

      const structured: Record<string, unknown> = {
        message: "Unknown error",
      };

      if (error instanceof Error) {
        structured.message = sanitize(error.message);

        if ("code" in error && typeof (error as Record<string, unknown>).code === "number") {
          structured.exitCode = (error as Record<string, unknown>).code;
        }
        if ("stderr" in error && typeof (error as Record<string, unknown>).stderr === "string") {
          structured.stderr = sanitize(
            (error as Record<string, unknown>).stderr as string,
          );
        }
      } else {
        structured.message = sanitize(String(error));
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(structured, null, 2) },
        ],
        isError: true,
      };
    }
  };
}

export function wrapImageToolHandler<T>(
  fn: (params: T) => Promise<{ base64: string; mimeType: string; metadata?: unknown }>,
) {
  return async (params: T) => {
    try {
      const result = await fn(params);
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
        {
          type: "image" as const,
          data: result.base64,
          mimeType: result.mimeType,
        },
      ];
      if (result.metadata) {
        content.push({
          type: "text" as const,
          text: JSON.stringify(result.metadata, null, 2),
        });
      }
      return { content };
    } catch (error) {
      const message =
        error instanceof Error ? sanitize(error.message) : sanitize(String(error));
      return {
        content: [{ type: "text" as const, text: message }],
        isError: true,
      };
    }
  };
}
