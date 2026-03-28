import { describe, it, expect } from "vitest";
import { executeShellSchema } from "../src/tools/shell.js";

describe("executeShell schema validation", () => {
  it("should reject empty command", () => {
    const result = executeShellSchema.safeParse({ command: "" });
    expect(result.success).toBe(false);
  });

  it("should accept valid command", () => {
    const result = executeShellSchema.safeParse({ command: "ls /sdcard" });
    expect(result.success).toBe(true);
  });

  it("should accept command with timeout", () => {
    const result = executeShellSchema.safeParse({
      command: "echo test",
      timeout: 5000,
    });
    expect(result.success).toBe(true);
    expect(result.data?.timeout).toBe(5000);
  });

  it("should use default timeout of 30000", () => {
    const result = executeShellSchema.safeParse({ command: "echo test" });
    expect(result.success).toBe(true);
    expect(result.data?.timeout).toBe(30000);
  });

  it("should accept command with serial", () => {
    const result = executeShellSchema.safeParse({
      command: "echo test",
      serial: "ABC123",
    });
    expect(result.success).toBe(true);
    expect(result.data?.serial).toBe("ABC123");
  });
});
