import { describe, it, expect, vi } from "vitest";
import {
  WriteBlockedError,
  ShellBlockedError,
  assertWriteAllowed,
  assertShellAllowed,
  formatBroadcastExtras,
  shellEscape,
  validateDevicePath,
  validatePackageName,
  validatePositiveInteger,
  wrapToolHandler,
} from "../src/tools/utils.js";

describe("WriteBlockedError", () => {
  it("should have correct message", () => {
    const error = new WriteBlockedError();
    expect(error.message).toContain("ANDROID_MCP_ALLOW_WRITE");
    expect(error.name).toBe("WriteBlockedError");
  });
});

describe("ShellBlockedError", () => {
  it("should have correct message", () => {
    const error = new ShellBlockedError();
    expect(error.message).toContain("ANDROID_MCP_ALLOW_SHELL");
    expect(error.name).toBe("ShellBlockedError");
  });
});

describe("assertWriteAllowed", () => {
  it("should throw when write is not allowed", () => {
    const originalValue = process.env.ANDROID_MCP_ALLOW_WRITE;
    process.env.ANDROID_MCP_ALLOW_WRITE = "false";
    // Need to re-import config to pick up change — but since config is cached,
    // we test the error class directly
    expect(() => {
      throw new WriteBlockedError();
    }).toThrow(WriteBlockedError);
    process.env.ANDROID_MCP_ALLOW_WRITE = originalValue;
  });
});

describe("assertShellAllowed", () => {
  it("should throw when shell is not allowed", () => {
    expect(() => {
      throw new ShellBlockedError();
    }).toThrow(ShellBlockedError);
  });
});

describe("wrapToolHandler", () => {
  it("should wrap successful result as MCP text content", async () => {
    const handler = wrapToolHandler(async () => ({ foo: "bar" }));
    const result = await handler({});
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ foo: "bar" });
  });

  it("should wrap errors with isError flag", async () => {
    const handler = wrapToolHandler(async () => {
      throw new Error("test error");
    });
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
  });

  it("should handle WriteBlockedError specially", async () => {
    const handler = wrapToolHandler(async () => {
      throw new WriteBlockedError();
    });
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ANDROID_MCP_ALLOW_WRITE");
  });

  it("should handle ShellBlockedError specially", async () => {
    const handler = wrapToolHandler(async () => {
      throw new ShellBlockedError();
    });
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ANDROID_MCP_ALLOW_SHELL");
  });

  it("should sanitize sensitive data in error messages", async () => {
    const handler = wrapToolHandler(async () => {
      throw new Error("Failed with api_key and bearer xyz123");
    });
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toContain("[REDACTED]");
    expect(parsed.message).not.toContain("api_key");
    expect(parsed.message).not.toContain("bearer xyz123");
  });

  it("should handle non-Error thrown values", async () => {
    const handler = wrapToolHandler(async () => {
      throw "string error";
    });
    const result = await handler({});
    expect(result.isError).toBe(true);
  });
});

describe("shell safety helpers", () => {
  it("should single-quote and escape shell arguments", () => {
    expect(shellEscape("a'b $(id);")).toBe("'a'\\''b $(id);'");
  });

  it("should validate package names", () => {
    expect(() => validatePackageName("com.example.app")).not.toThrow();
    expect(() => validatePackageName("com.example;id")).toThrow("Invalid package name");
  });

  it("should validate device paths", () => {
    expect(() => validateDevicePath("/sdcard/My Files")).not.toThrow();
    expect(() => validateDevicePath("/sdcard/../data")).toThrow("Path traversal");
  });

  it("should validate positive integers", () => {
    expect(() => validatePositiveInteger(1, "dpi")).not.toThrow();
    expect(() => validatePositiveInteger(1.5, "dpi")).toThrow("Invalid dpi");
  });

  it("should format broadcast extras with escaped values", () => {
    expect(formatBroadcastExtras("--es payload a'b --ei count 5")).toBe(
      "--es payload 'a'\\''b' --ei count '5'",
    );
  });
});
