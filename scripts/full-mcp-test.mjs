#!/usr/bin/env node
/**
 * Full MCP Integration Test — tests all 69 tools via MCP protocol.
 * Requires a connected Android device.
 *
 * Usage: pnpm run build && node scripts/full-mcp-test.mjs
 */

import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

let client;
let passed = 0;
let failed = 0;
let skipped = 0;
const startTime = performance.now();

function parse(r) {
  const c = r.content[0];
  if (c.type === "text") try { return JSON.parse(c.text); } catch { return c.text; }
  if (c.type === "image") return { _image: true, dataLength: c.data?.length ?? 0 };
  return c;
}

async function call(name, args = {}) {
  const s = performance.now();
  const r = await client.callTool({ name, arguments: args });
  return { data: parse(r), isError: r.isError, ms: Math.round(performance.now() - s), raw: r };
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    return true;
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
    return false;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function skip(name, reason) { skipped++; console.log(`  ⊘ ${name} — ${reason}`); }
function ok(name, detail, ms) { console.log(`  ✓ ${name}${detail ? " — " + detail : ""} (${ms}ms)`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ──────────────────────────────────────────────────────

async function phase1_readonly() {
  console.log("\n═══ Phase 1: Read-only tools ═══\n");

  // 1. list-devices
  await test("list-devices", async () => {
    const { data, ms } = await call("list-devices");
    assert(data.count >= 1, `no devices: ${data.count}`);
    assert(data.devices[0].serial, "missing serial");
    ok("list-devices", `${data.count} device(s)`, ms);
  });

  // 2. get-device-info
  await test("get-device-info", async () => {
    const { data, ms } = await call("get-device-info");
    assert(data.model, "missing model");
    assert(data.sdkVersion > 0, "invalid sdk");
    ok("get-device-info", data.model, ms);
  });

  // 3. get-device-properties
  await test("get-device-properties", async () => {
    const { data, ms } = await call("get-device-properties", { filter: "ro.build" });
    assert(data.count > 0, "no properties");
    ok("get-device-properties", `${data.count} props (ro.build)`, ms);
  });

  // 4. list-packages
  await test("list-packages", async () => {
    const { data, ms } = await call("list-packages", { type: "all" });
    assert(data.count > 0, "no packages");
    ok("list-packages", `${data.count} packages`, ms);
  });

  // 5. get-package-info
  await test("get-package-info", async () => {
    const { data, ms } = await call("get-package-info", { packageName: "com.android.settings" });
    assert(data.packageName === "com.android.settings", "wrong package");
    ok("get-package-info", `v${data.versionName || "?"}`, ms);
  });

  // 6. is-app-installed
  await test("is-app-installed (true)", async () => {
    const { data, ms } = await call("is-app-installed", { packageName: "com.android.settings" });
    assert(data.installed === true, "should be installed");
    ok("is-app-installed (true)", "settings=true", ms);
  });
  await test("is-app-installed (false)", async () => {
    const { data, ms } = await call("is-app-installed", { packageName: "com.fake.nonexistent.app" });
    assert(data.installed === false, "should not be installed");
    ok("is-app-installed (false)", "fake=false", ms);
  });

  // 7. get-app-intents
  await test("get-app-intents", async () => {
    const { data, ms } = await call("get-app-intents", { packageName: "com.android.settings" });
    assert(data.intentCount >= 0, "invalid intentCount");
    ok("get-app-intents", `${data.intentCount} intents`, ms);
  });

  // 8. get-current-activity
  await test("get-current-activity", async () => {
    const { data, ms } = await call("get-current-activity");
    assert(Array.isArray(data.raw), "missing raw");
    ok("get-current-activity", data.currentFocus || data.resumedActivity || "ok", ms);
  });

  // 9. take-screenshot
  await test("take-screenshot", async () => {
    const { raw, ms } = await call("take-screenshot");
    const img = raw.content[0];
    assert(img.type === "image", "not image");
    assert(img.data.length > 1000, "image too small");
    ok("take-screenshot", `${(img.data.length / 1024).toFixed(0)}KB`, ms);
  });

  // 10-11. dump-ui-hierarchy
  let compactCount = 0;
  await test("dump-ui-hierarchy (compact)", async () => {
    const { data, ms } = await call("dump-ui-hierarchy", { compact: true });
    assert(data.elementCount > 0, "no elements");
    compactCount = data.elementCount;
    ok("dump-ui-hierarchy (compact)", `${data.elementCount} elements`, ms);
  });
  await test("dump-ui-hierarchy (full)", async () => {
    const { data, ms } = await call("dump-ui-hierarchy", { compact: false });
    assert(data.elementCount >= compactCount, `full(${data.elementCount}) < compact(${compactCount})`);
    ok("dump-ui-hierarchy (full)", `${data.elementCount} elements`, ms);
  });

  // 12. get-logcat
  await test("get-logcat", async () => {
    const { data, ms } = await call("get-logcat", { lines: 20 });
    assert(data.lineCount > 0, "no logs");
    ok("get-logcat", `${data.lineCount} lines`, ms);
  });

  // 13. search-logcat
  await test("search-logcat", async () => {
    const { data, ms } = await call("search-logcat", { pattern: "android", lines: 200 });
    assert(data.matchCount >= 0, "invalid matchCount");
    ok("search-logcat", `${data.matchCount} matches`, ms);
  });

  // 14. get-crash-logs
  await test("get-crash-logs", async () => {
    const { data, ms } = await call("get-crash-logs");
    assert(data.crashCount >= 0, "invalid crashCount");
    ok("get-crash-logs", `${data.crashCount} crashes`, ms);
  });

  // 15. get-battery-info
  await test("get-battery-info", async () => {
    const { data, ms } = await call("get-battery-info");
    assert(typeof data.level === "number", "missing level");
    ok("get-battery-info", `${data.level}%`, ms);
  });

  // 16. get-network-info
  await test("get-network-info", async () => {
    const { data, ms } = await call("get-network-info");
    assert(data.wifi, "missing wifi");
    ok("get-network-info", `wifi=${data.wifi.enabled}`, ms);
  });

  // 17. get-setting
  await test("get-setting", async () => {
    const { data, ms } = await call("get-setting", { namespace: "global", key: "airplane_mode_on" });
    assert(data.value !== undefined, "missing value");
    ok("get-setting", `airplane=${data.value}`, ms);
  });

  // 18. list-settings
  await test("list-settings", async () => {
    const { data, ms } = await call("list-settings", { namespace: "global" });
    assert(data.count > 0, "no settings");
    ok("list-settings", `${data.count} global settings`, ms);
  });

  // 19. get-orientation
  await test("get-orientation", async () => {
    const { data, ms } = await call("get-orientation");
    assert(data.orientation, "missing orientation");
    ok("get-orientation", data.orientation, ms);
  });

  // 20. list-forwards
  await test("list-forwards", async () => {
    const { data, ms } = await call("list-forwards");
    assert(Array.isArray(data.forwards), "missing forwards");
    ok("list-forwards", `${data.forwards.length} fwd, ${data.reverses.length} rev`, ms);
  });

  // 21. list-files
  await test("list-files", async () => {
    const { data, ms } = await call("list-files", { path: "/sdcard" });
    assert(data.count > 0, "no files");
    ok("list-files", `${data.count} entries`, ms);
  });

  // 22. get-mem-info (system)
  await test("get-mem-info (system)", async () => {
    const { data, ms } = await call("get-mem-info");
    assert(data.totalRam || data.topConsumers, "missing RAM info");
    ok("get-mem-info (system)", data.totalRam || "ok", ms);
  });

  // 23. get-mem-info (app)
  await test("get-mem-info (app)", async () => {
    const { data, ms } = await call("get-mem-info", { packageName: "com.android.settings" });
    assert(data.packageName, "missing package");
    ok("get-mem-info (app)", `PSS=${data.totalPssKB || "?"}KB`, ms);
  });

  // 24. get-gfx-info
  await test("get-gfx-info", async () => {
    const { data, ms } = await call("get-gfx-info", { packageName: "com.android.settings" });
    assert(data.packageName, "missing package");
    ok("get-gfx-info", `frames=${data.totalFrames ?? "?"}`, ms);
  });

  // 25. get-cpu-info
  await test("get-cpu-info", async () => {
    const { data, ms } = await call("get-cpu-info");
    assert(Array.isArray(data.topProcesses), "missing topProcesses");
    ok("get-cpu-info", `${data.topProcesses.length} processes`, ms);
  });

  // 26. execute-shell
  await test("execute-shell", async () => {
    const { data, ms } = await call("execute-shell", { command: "whoami" });
    assert(data.output.includes("shell"), `unexpected: ${data.output}`);
    ok("execute-shell", "whoami=shell", ms);
  });
}

// ──────────────────────────────────────────────────────

async function phase2_write() {
  console.log("\n═══ Phase 2: Write tools ═══\n");

  // Go to home first
  await call("press-key", { key: "HOME" });
  await sleep(500);

  // 27. tap
  await test("tap", async () => {
    const { data, ms } = await call("tap", { x: 540, y: 1170 });
    assert(data.result, "no result");
    ok("tap", data.result, ms);
  });

  await call("press-key", { key: "HOME" });
  await sleep(300);

  // 28. long-press
  await test("long-press", async () => {
    const { data, ms } = await call("long-press", { x: 540, y: 1170, duration: 500 });
    assert(data.result, "no result");
    ok("long-press", data.result, ms);
  });

  await call("press-key", { key: "HOME" });
  await sleep(300);

  // 29. double-tap
  await test("double-tap", async () => {
    const { data, ms } = await call("double-tap", { x: 540, y: 1170 });
    assert(data.result, "no result");
    ok("double-tap", data.result, ms);
  });

  await call("press-key", { key: "HOME" });
  await sleep(300);

  // 30. swipe
  await test("swipe", async () => {
    const { data, ms } = await call("swipe", { x1: 540, y1: 800, x2: 540, y2: 1600, duration: 200 });
    assert(data.result, "no result");
    ok("swipe", data.result, ms);
  });

  // 31. drag-and-drop
  await test("drag-and-drop", async () => {
    const { data, ms } = await call("drag-and-drop", { x1: 300, y1: 500, x2: 300, y2: 800, duration: 500 });
    assert(data.result, "no result");
    ok("drag-and-drop", data.result, ms);
  });

  // 32. press-key HOME
  await test("press-key", async () => {
    const { data, ms } = await call("press-key", { key: "HOME" });
    assert(data.result, "no result");
    ok("press-key", "HOME", ms);
  });
  await sleep(300);

  // 33. input-text (press home first, open search)
  await test("input-text", async () => {
    const { data, ms } = await call("input-text", { text: "mcp" });
    assert(data.result, "no result");
    ok("input-text", data.result, ms);
  });
  await call("press-key", { key: "HOME" });
  await sleep(300);

  // 34. open-url
  await test("open-url", async () => {
    const { data, ms } = await call("open-url", { url: "https://google.com" });
    assert(data.result, "no result");
    ok("open-url", "google.com", ms);
  });
  await sleep(1000);
  await call("press-key", { key: "HOME" });
  await sleep(300);

  // 35-36. launch-app → stop-app
  await test("launch-app", async () => {
    const { data, ms, isError } = await call("launch-app", {
      packageName: "com.android.settings",
      activity: ".Settings",
    });
    assert(!isError, "launch failed");
    ok("launch-app", "settings", ms);
  });
  await sleep(500);
  await test("stop-app", async () => {
    const { data, ms } = await call("stop-app", { packageName: "com.android.settings" });
    assert(data.result, "no result");
    ok("stop-app", "settings", ms);
  });

  // 37. clear-app-data
  await test("clear-app-data", async () => {
    // Use com.android.settings safe data clear — or com.google.android.calculator on emulator
    // Use a package that exists on both real devices and emulator
    const installed = await call("is-app-installed", { packageName: "com.google.android.deskclock" });
    const pkg = installed.data.installed ? "com.google.android.deskclock" : "com.sec.android.app.popupcalculator";
    const { data, ms, isError } = await call("clear-app-data", { packageName: pkg });
    assert(!isError, "clear failed");
    ok("clear-app-data", pkg.split(".").pop(), ms);
  });

  // 38-39. grant-permission → revoke-permission
  await test("grant-permission", async () => {
    const { data, ms } = await call("grant-permission", {
      packageName: "com.android.settings",
      permission: "android.permission.CAMERA",
    });
    assert(data.result, "no result");
    ok("grant-permission", "CAMERA", ms);
  });
  await test("revoke-permission", async () => {
    const { data, ms } = await call("revoke-permission", {
      packageName: "com.android.settings",
      permission: "android.permission.CAMERA",
    });
    assert(data.result, "no result");
    ok("revoke-permission", "CAMERA", ms);
  });

  // 40. send-broadcast
  await test("send-broadcast", async () => {
    const { data, ms } = await call("send-broadcast", {
      action: "com.android.mcp.TEST_ACTION",
    });
    assert(data.result, "no result");
    ok("send-broadcast", "TEST_ACTION", ms);
  });

  // 41. open-notification → close
  await test("open-notification", async () => {
    const { data, ms } = await call("open-notification");
    assert(data.result, "no result");
    ok("open-notification", data.result, ms);
  });
  await sleep(500);
  await call("press-key", { key: "HOME" });
  await sleep(300);

  // 42. set-orientation landscape → restore auto
  await test("set-orientation", async () => {
    const { data, ms } = await call("set-orientation", { orientation: "landscape" });
    assert(data.result, "no result");
    ok("set-orientation", "landscape", ms);
  });
  await sleep(500);
  await call("set-orientation", { orientation: "auto" });

  // 43. set-display-size → reset
  await test("set-display-size", async () => {
    const { data, ms } = await call("set-display-size", { width: 720, height: 1560 });
    assert(data.result, "no result");
    ok("set-display-size", "720x1560", ms);
  });
  await call("set-display-size", {}); // reset

  // 44. set-display-density → reset
  await test("set-display-density", async () => {
    const { data, ms } = await call("set-display-density", { dpi: 420 });
    assert(data.result, "no result");
    ok("set-display-density", "420dpi", ms);
  });
  await call("set-display-density", {}); // reset

  // 45. keep-screen-on
  await test("keep-screen-on", async () => {
    const { data, ms } = await call("keep-screen-on", { enabled: true });
    assert(data.result, "no result");
    ok("keep-screen-on", "enabled", ms);
  });
  await call("keep-screen-on", { enabled: false });

  // 46. change-setting → restore
  const origBrightness = await call("get-setting", { namespace: "system", key: "screen_brightness" });
  await test("change-setting", async () => {
    const { data, ms } = await call("change-setting", {
      namespace: "system",
      key: "screen_brightness",
      value: "128",
    });
    assert(data.result, "no result");
    ok("change-setting", "brightness=128", ms);
  });
  await call("change-setting", {
    namespace: "system",
    key: "screen_brightness",
    value: origBrightness.data.value,
  });

  // 47. toggle-wifi off → on
  await test("toggle-wifi", async () => {
    const { data, ms } = await call("toggle-wifi", { enabled: false });
    assert(data.result, "no result");
    ok("toggle-wifi", "disabled", ms);
  });
  await sleep(1000);
  await call("toggle-wifi", { enabled: true });
  await sleep(1000);

  // 48. lock → unlock
  await test("lock-device", async () => {
    const { data, ms } = await call("lock-device");
    assert(data.result, "no result");
    ok("lock-device", data.result, ms);
  });
  await sleep(1000);
  await test("unlock-device", async () => {
    const { data, ms } = await call("unlock-device");
    assert(data.result, "no result");
    ok("unlock-device", data.result, ms);
  });
  await sleep(1000);

  // 49-51. port-forward → reverse → remove
  await test("port-forward", async () => {
    const { data, ms } = await call("port-forward", { hostPort: 18080, devicePort: 18080 });
    assert(data.result, "no result");
    ok("port-forward", "18080→18080", ms);
  });
  await test("reverse-forward", async () => {
    const { data, ms } = await call("reverse-forward", { devicePort: 19090, hostPort: 19090 });
    assert(data.result, "no result");
    ok("reverse-forward", "19090→19090", ms);
  });
  await test("remove-forward", async () => {
    const { data, ms } = await call("remove-forward", {});
    assert(data.result, "no result");
    ok("remove-forward", "all cleared", ms);
  });

  // 52. clear-logcat
  await test("clear-logcat", async () => {
    const { data, ms } = await call("clear-logcat");
    assert(data.result, "no result");
    ok("clear-logcat", data.result, ms);
  });
}

// ──────────────────────────────────────────────────────

async function phase3_files() {
  console.log("\n═══ Phase 3: File tools ═══\n");

  // Create temp file
  const tmpFile = "/tmp/mcp-test-file.txt";
  writeFileSync(tmpFile, "MCP integration test " + Date.now());

  // 53. push-file
  await test("push-file", async () => {
    const { data, ms, isError } = await call("push-file", {
      localPath: tmpFile,
      remotePath: "/sdcard/mcp-test-file.txt",
    });
    assert(!isError, "push failed");
    ok("push-file", data.result || "ok", ms);
  });

  // 54. pull-file
  const pullTarget = "/tmp/mcp-pulled-file.txt";
  await test("pull-file", async () => {
    const { data, ms, isError } = await call("pull-file", {
      remotePath: "/sdcard/mcp-test-file.txt",
      localPath: pullTarget,
    });
    assert(!isError, "pull failed");
    ok("pull-file", data.result || "ok", ms);
  });

  // 55. delete-file
  await test("delete-file", async () => {
    const { data, ms } = await call("delete-file", { path: "/sdcard/mcp-test-file.txt" });
    assert(data.result, "no result");
    ok("delete-file", data.result, ms);
  });

  // Cleanup local
  try { unlinkSync(tmpFile); } catch {}
  try { unlinkSync(pullTarget); } catch {}
}

// ──────────────────────────────────────────────────────

async function phase4_recording() {
  console.log("\n═══ Phase 4: Screen recording ═══\n");

  // 56. start-screen-recording
  await test("start-screen-recording", async () => {
    const { data, ms } = await call("start-screen-recording", {
      fileName: "mcp-test-rec.mp4",
      timeLimit: 3,
    });
    assert(data.result, "no result");
    ok("start-screen-recording", "3s", ms);
  });

  console.log("  ⏳ Waiting 5s for recording to finish...");
  await sleep(5000);

  // 57. pull-screen-recording
  const recPath = "/tmp/mcp-test-recording.mp4";
  await test("pull-screen-recording", async () => {
    const { data, ms, isError } = await call("pull-screen-recording", {
      fileName: "mcp-test-rec.mp4",
      localPath: recPath,
    });
    assert(!isError, "pull failed");
    ok("pull-screen-recording", data.result || "ok", ms);
  });

  // Cleanup
  try { unlinkSync(recPath); } catch {}
  await call("execute-shell", { command: "rm /sdcard/mcp-test-rec.mp4" });
}

// ──────────────────────────────────────────────────────

async function phase5_emulator() {
  console.log("\n═══ Phase 5: Emulator tools ═══\n");

  const { data } = await call("list-avds");
  if (!data.avds || data.avds.length === 0) {
    skip("list-avds", "no AVDs available");
    skip("start-emulator", "no AVDs");
    skip("save-snapshot", "no emulator");
    skip("load-snapshot", "no emulator");
    skip("delete-snapshot", "no emulator");
    skip("list-snapshots", "no emulator");
    skip("stop-emulator", "no emulator");
    return;
  }

  ok("list-avds", `${data.avds.length} AVD(s)`, 0);
  passed++;
  // Emulator tests would run here if AVDs were available
  skip("start-emulator", "manual test recommended");
  skip("save-snapshot", "requires running emulator");
  skip("load-snapshot", "requires running emulator");
  skip("delete-snapshot", "requires running emulator");
  skip("list-snapshots", "requires running emulator");
  skip("stop-emulator", "requires running emulator");
}

// ──────────────────────────────────────────────────────

async function phase6_skipped() {
  console.log("\n═══ Phase 6: Skipped tools ═══\n");
  skip("connect-device", "TCP/IP only — would disconnect USB");
  skip("disconnect-device", "TCP/IP only");
  skip("bugreport", "takes 2+ minutes — run manually");
  skip("toggle-mobile-data", "may disrupt connectivity");
  skip("install-app", "no test APK");
  skip("uninstall-app", "no test app");
}

// ──────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Android MCP Server — Full Integration Test");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Time: ${new Date().toISOString()}`);

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: {
      ...process.env,
      ANDROID_MCP_ALLOW_WRITE: "true",
      ANDROID_MCP_ALLOW_SHELL: "true",
    },
  });
  client = new Client({ name: "full-test", version: "1.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(`  Tools: ${tools.tools.length}`);

  const devResult = await call("list-devices");
  if (devResult.data.count === 0) {
    console.error("\n  ✗ No device connected. Aborting.\n");
    await client.close();
    process.exit(1);
  }
  console.log(`  Device: ${devResult.data.devices[0].model || devResult.data.devices[0].serial}`);

  await phase1_readonly();
  await phase2_write();
  await phase3_files();
  await phase4_recording();
  await phase5_emulator();
  await phase6_skipped();

  const duration = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${passed + failed} executed, ${skipped} skipped`);
  console.log(`  Duration: ${duration}s`);
  console.log(`  ${failed === 0 ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"}`);
  console.log("═══════════════════════════════════════════════════");

  await client.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n  ✗ Fatal: ${e.message}`);
  process.exit(1);
});
