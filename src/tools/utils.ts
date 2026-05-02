import { createWrapToolHandler } from "@us-all/mcp-toolkit";
import { config } from "../config.js";

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

// --- Input validation helpers ---

/**
 * Escape a string for safe use inside single-quoted Android shell arguments.
 * Handles all shell metacharacters: backticks, $(), semicolons, pipes, etc.
 */
export function shellEscape(s: string): string {
  // Replace every single-quote with the sequence: end-quote, escaped-quote, start-quote
  // Then wrap the whole thing in single quotes.
  // Inside single quotes, the Android shell interprets nothing except another single quote.
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/** Validate Android setting key (alphanumeric, underscores, dots, hyphens). */
export function validateSettingKey(key: string): void {
  if (!/^[a-zA-Z0-9_.\-]+$/.test(key)) {
    throw new Error(
      `Invalid setting key: ${JSON.stringify(key)}. Only alphanumeric, underscore, dot, and hyphen are allowed.`,
    );
  }
}

/** Validate Android setting value (no shell metacharacters). */
export function validateSettingValue(value: string): void {
  if (!/^[a-zA-Z0-9_.\-:\/,@+ ]*$/.test(value)) {
    throw new Error(
      `Invalid setting value: ${JSON.stringify(value)}. Contains disallowed characters.`,
    );
  }
}

/** Validate Android keycode format (e.g. KEYCODE_BACK, KEYCODE_VOLUME_UP). */
export function validateKeycode(keycode: string): void {
  if (!/^KEYCODE_[A-Z0-9_]+$/.test(keycode)) {
    throw new Error(
      `Invalid keycode: ${JSON.stringify(keycode)}. Expected format: KEYCODE_<NAME> with uppercase letters, digits, and underscores.`,
    );
  }
}

/** Validate Android package name (e.g. com.example.app). */
export function validatePackageName(name: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(name)) {
    throw new Error(
      `Invalid package name: ${JSON.stringify(name)}. Expected format: com.example.app`,
    );
  }
}

/** Validate Android permission string (e.g. android.permission.CAMERA). */
export function validatePermission(perm: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(perm)) {
    throw new Error(
      `Invalid permission: ${JSON.stringify(perm)}. Only alphanumeric, dots, and underscores are allowed.`,
    );
  }
}

/** Validate Android component name (e.g. com.example.app/.MainActivity). */
export function validateComponent(component: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+\/\.?[a-zA-Z][a-zA-Z0-9_.]*$/.test(component)) {
    throw new Error(
      `Invalid component: ${JSON.stringify(component)}. Expected format: com.example.app/.Activity`,
    );
  }
}

/** Validate Android broadcast action (e.g. android.intent.action.VIEW). */
export function validateAction(action: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(action)) {
    throw new Error(
      `Invalid action: ${JSON.stringify(action)}. Only alphanumeric, dots, and underscores are allowed.`,
    );
  }
}

/** Validate broadcast extras format (--es key val, --ei key val, etc.). */
export function validateExtras(extras: string): void {
  // Split by flag boundaries and validate each flag+key+value group
  const tokens = extras.trim().split(/\s+/);
  const validFlags = new Set(["--es", "--ei", "--ez", "--ef", "--el", "--eu", "--esa"]);
  let i = 0;
  while (i < tokens.length) {
    if (!validFlags.has(tokens[i])) {
      throw new Error(
        `Invalid extras flag: ${JSON.stringify(tokens[i])}. Allowed: ${[...validFlags].join(", ")}`,
      );
    }
    if (i + 2 >= tokens.length) {
      throw new Error(
        `Extras flag ${tokens[i]} requires a key and value.`,
      );
    }
    const key = tokens[i + 1];
    if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(key)) {
      throw new Error(
        `Invalid extras key: ${JSON.stringify(key)}. Only alphanumeric, dots, and underscores are allowed.`,
      );
    }
    // value is validated by shellEscape when constructing the command
    i += 3;
  }
}

/** Validate device file path (must be absolute, no traversal). */
export function validateDevicePath(path: string): void {
  if (!path.startsWith("/")) {
    throw new Error(
      `Invalid device path: ${JSON.stringify(path)}. Must be an absolute path starting with /.`,
    );
  }
  // Normalize and check for traversal
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      throw new Error(
        `Invalid device path: ${JSON.stringify(path)}. Path traversal (..) is not allowed.`,
      );
    }
  }
  // Block shell metacharacters in path
  if (/[;|&`$(){}!<>]/.test(path)) {
    throw new Error(
      `Invalid device path: ${JSON.stringify(path)}. Contains disallowed shell characters.`,
    );
  }
}

// Local sanitize helper retained for the image handler's error path
// (image responses are Android-specific and not part of the shared
// text-wrapper surface in @us-all/mcp-toolkit).
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

/**
 * Text-response tool wrapper — delegates to the shared toolkit factory.
 * Handles WriteBlockedError / ShellBlockedError (passthrough) and ADB-style
 * errors with `code` (numeric exit code) / `stderr` (string).
 */
export const wrapToolHandler = createWrapToolHandler({
  // Defaults already cover api_key, authorization, bearer, password, secret,
  // token. No Android-specific patterns to add.
  errorExtractors: [
    {
      match: (error) => error instanceof WriteBlockedError,
      extract: (error) => ({
        kind: "passthrough",
        text: (error as WriteBlockedError).message,
      }),
    },
    {
      match: (error) => error instanceof ShellBlockedError,
      extract: (error) => ({
        kind: "passthrough",
        text: (error as ShellBlockedError).message,
      }),
    },
    {
      // ADB-style error shape: numeric `code` (exit code) and/or `stderr`.
      match: (error) => {
        if (!(error instanceof Error)) return false;
        const e = error as unknown as Record<string, unknown>;
        return typeof e.code === "number" || typeof e.stderr === "string";
      },
      extract: (error) => {
        const err = error as Error;
        const e = error as unknown as Record<string, unknown>;
        const data: Record<string, unknown> & { message: string } = {
          message: err.message,
        };
        if (typeof e.code === "number") data.code = e.code;
        if (typeof e.stderr === "string") data.stderr = e.stderr;
        return { kind: "structured", data };
      },
    },
  ],
});

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
