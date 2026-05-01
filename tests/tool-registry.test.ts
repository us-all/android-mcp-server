import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../src/tool-registry.js";

describe("ToolRegistry", () => {
  let r: ToolRegistry;

  beforeEach(() => {
    r = new ToolRegistry();
    r.register("list-devices", "List connected devices", "device");
    r.register("install-app", "Install APK", "apps");
    r.register("uninstall-app", "Uninstall app", "apps");
    r.register("tap", "Tap at coordinate", "ui");
    r.register("screenshot", "Take screenshot", "ui");
    r.register("logcat", "Capture logcat", "logcat");
  });

  it("matches by tool name token", () => {
    expect(r.search("app").map((m) => m.name).sort()).toEqual(["install-app", "uninstall-app"]);
  });

  it("respects category filter", () => {
    const matches = r.search("app", "apps");
    expect(matches.map((m) => m.name).sort()).toEqual(["install-app", "uninstall-app"]);
  });

  it("ranks name matches higher", () => {
    const matches = r.search("tap");
    expect(matches[0].name).toBe("tap");
  });

  it("summary breakdown", () => {
    const s = r.summary();
    expect(s.total).toBe(6);
    expect(s.categoryBreakdown.apps).toBe(2);
    expect(s.categoryBreakdown.ui).toBe(2);
  });
});
