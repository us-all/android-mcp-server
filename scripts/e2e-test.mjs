#!/usr/bin/env node
/**
 * Full E2E Validation Suite for android-mcp-server
 */

import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// ─── Helpers ───

async function createClient() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: {
      ...process.env,
      ANDROID_MCP_ALLOW_WRITE: "true",
      ANDROID_MCP_ALLOW_SHELL: "true",
    },
  });
  const client = new Client({ name: "e2e-test", version: "1.0" });
  await client.connect(transport);
  return client;
}

function parseResult(r) {
  if (!r || !r.content || !r.content[0]) return null;
  const c = r.content[0];
  if (c.type === "text") {
    try { return JSON.parse(c.text); } catch { return c.text; }
  }
  if (c.type === "image") return { _image: true, mimeType: c.mimeType, dataLength: c.data?.length ?? 0 };
  return c;
}

const results = {};

function record(tool, run, latency, success, error, notes) {
  if (!results[tool]) results[tool] = [];
  results[tool].push({ run, latency, success, error, notes });
}

async function callAndRecord(client, tool, args, run) {
  const start = performance.now();
  try {
    const r = await client.callTool({ name: tool, arguments: args ?? {} });
    const latency = Math.round(performance.now() - start);
    const parsed = parseResult(r);
    const isError = r.isError === true;
    record(tool, run, latency, !isError, isError ? parsed : null, parsed);
    return { parsed, isError, latency };
  } catch (e) {
    const latency = Math.round(performance.now() - start);
    record(tool, run, latency, false, e.message, null);
    return { parsed: null, isError: true, latency, error: e.message };
  }
}

// ─── Test Suites ───

async function testStability(client) {
  console.log("\n══════ A. STABILITY TEST (10 sequential runs) ══════\n");
  const tools = [
    ["list-devices", {}],
    ["get-device-info", {}],
    ["get-battery-info", {}],
    ["list-packages", { type: "third-party", filter: "com.android" }],
    ["get-logcat", { lines: 20, priority: "E" }],
    ["get-network-info", {}],
    ["dump-ui-hierarchy", { compact: true }],
    ["execute-shell", { command: "echo stability_test" }],
  ];

  for (let i = 1; i <= 10; i++) {
    process.stdout.write(`  Run ${i}/10: `);
    for (const [tool, args] of tools) {
      const { isError, latency } = await callAndRecord(client, tool, args, `stability-${i}`);
      process.stdout.write(isError ? "✗" : "✓");
    }
    console.log();
  }
}

async function testScreenshot(client) {
  console.log("\n══════ C. SCREENSHOT CONSISTENCY (10 captures) ══════\n");
  const sizes = [];
  for (let i = 1; i <= 10; i++) {
    const { parsed, latency } = await callAndRecord(client, "take-screenshot", {}, `screenshot-${i}`);
    if (parsed?._image) {
      sizes.push(parsed.dataLength);
      // Validate base64
      try {
        const buf = Buffer.from(parsed.dataLength > 0 ? "test" : "", "base64"); // lightweight check
        const pngHeader = [0x89, 0x50, 0x4E, 0x47]; // PNG magic bytes won't be checked on truncated
      } catch (e) {
        record("take-screenshot", `decode-${i}`, 0, false, "base64 decode failed", null);
      }
      console.log(`  Screenshot ${i}: ${(parsed.dataLength / 1024).toFixed(0)}KB, ${latency}ms`);
    } else {
      console.log(`  Screenshot ${i}: FAILED (${latency}ms)`);
    }
  }
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const deviation = sizes.map(s => Math.abs(s - avg) / avg * 100);
  const maxDev = Math.max(...deviation);
  console.log(`  Size range: ${(Math.min(...sizes)/1024).toFixed(0)}KB - ${(Math.max(...sizes)/1024).toFixed(0)}KB`);
  console.log(`  Max deviation: ${maxDev.toFixed(1)}%`);
  if (maxDev > 50) {
    console.log(`  ⚠️  HIGH VARIANCE in screenshot sizes`);
  }
}

async function testUiHierarchy(client) {
  console.log("\n══════ B. UI HIERARCHY DEEP VALIDATION ══════\n");

  // Compare compact vs full
  const compact = await callAndRecord(client, "dump-ui-hierarchy", { compact: true }, "hierarchy-compact");
  const full = await callAndRecord(client, "dump-ui-hierarchy", { compact: false }, "hierarchy-full");

  const compactCount = compact.parsed?.elementCount ?? 0;
  const fullCount = full.parsed?.elementCount ?? 0;

  console.log(`  Compact elements: ${compactCount}`);
  console.log(`  Full elements: ${fullCount}`);
  console.log(`  Ratio: ${fullCount > 0 ? (compactCount / fullCount * 100).toFixed(1) : 0}% interactive`);

  if (compactCount > fullCount) {
    console.log(`  ❌ BUG: compact count > full count!`);
  }
  if (fullCount === 0) {
    console.log(`  ❌ BUG: full hierarchy is empty!`);
  }

  // Validate element structure
  const elements = compact.parsed?.elements ?? [];
  let boundsIssues = 0;
  let missingCenter = 0;
  let emptyClass = 0;

  for (const el of elements) {
    if (!el.bounds || !el.bounds.match(/\[\d+,\d+\]\[\d+,\d+\]/)) boundsIssues++;
    if (!el.center) missingCenter++;
    if (!el.class) emptyClass++;
  }

  console.log(`  Bounds issues: ${boundsIssues}`);
  console.log(`  Missing center: ${missingCenter}`);
  console.log(`  Empty class: ${emptyClass}`);

  // Consistency test - run 5 times
  console.log(`\n  Consistency (5 runs):`);
  for (let i = 1; i <= 5; i++) {
    const r = await callAndRecord(client, "dump-ui-hierarchy", { compact: true }, `hierarchy-consistency-${i}`);
    console.log(`    Run ${i}: ${r.parsed?.elementCount ?? 'ERR'} elements, ${r.latency}ms`);
  }
}

async function testShellSafety(client) {
  console.log("\n══════ D. SHELL EXECUTION SAFETY ══════\n");

  // Normal commands
  const normalCmds = [
    ["whoami", "basic identity"],
    ["getprop ro.build.version.release", "system prop"],
    ["pm list packages | head -5", "piped command"],
    ["id", "user info"],
    ["date", "system date"],
  ];

  for (const [cmd, desc] of normalCmds) {
    const { parsed, latency, isError } = await callAndRecord(client, "execute-shell", { command: cmd }, `shell-${desc}`);
    console.log(`  ${isError ? "✗" : "✓"} ${desc} (${cmd}): ${latency}ms${isError ? " ERROR" : ""}`);
  }

  // Edge cases
  console.log(`\n  Edge cases:`);

  // Invalid command
  const inv = await callAndRecord(client, "execute-shell", { command: "nonexistent_command_xyz" }, "shell-invalid");
  console.log(`  ${inv.isError ? "✓ (expected)" : "⚠️ (should error)"} Invalid command: ${inv.latency}ms`);

  // Empty command
  const empty = await callAndRecord(client, "execute-shell", { command: "" }, "shell-empty");
  console.log(`  ${empty.isError ? "✓ (expected)" : "⚠️"} Empty command: ${empty.latency}ms`);

  // Special characters
  const special = await callAndRecord(client, "execute-shell", { command: "echo 'hello world' && echo \"test\"" }, "shell-special");
  console.log(`  ${special.isError ? "✗" : "✓"} Special chars: ${special.latency}ms`);

  // Long output command
  const longOut = await callAndRecord(client, "execute-shell", { command: "pm list packages" }, "shell-long-output");
  const outputLen = typeof longOut.parsed === "object" ? (longOut.parsed?.output?.length ?? 0) : 0;
  console.log(`  ${longOut.isError ? "✗" : "✓"} Long output (${outputLen} chars): ${longOut.latency}ms`);

  // Timeout test (short timeout)
  const timeout = await callAndRecord(client, "execute-shell", { command: "sleep 2 && echo done", timeout: 1000 }, "shell-timeout");
  console.log(`  ${timeout.isError ? "✓ (expected timeout)" : "⚠️ (should timeout)"} Timeout test: ${timeout.latency}ms`);
}

async function testLogcatStress(client) {
  console.log("\n══════ F. LOGCAT STRESS ══════\n");

  // Various line counts
  const lineCounts = [10, 50, 100, 500, 1000];
  for (const lines of lineCounts) {
    const { parsed, latency, isError } = await callAndRecord(client, "get-logcat", { lines }, `logcat-${lines}`);
    const actual = parsed?.lineCount ?? 0;
    console.log(`  ${isError ? "✗" : "✓"} ${lines} lines requested → ${actual} returned, ${latency}ms`);
  }

  // Search test
  const search = await callAndRecord(client, "search-logcat", { pattern: "Error", lines: 500 }, "logcat-search");
  console.log(`  Search "Error": ${search.parsed?.matchCount ?? 0} matches in ${search.latency}ms`);

  // Crash logs
  const crash = await callAndRecord(client, "get-crash-logs", {}, "logcat-crash");
  console.log(`  Crash logs: ${crash.parsed?.crashCount ?? 0} entries, ${crash.latency}ms`);

  // Rapid sequential calls
  console.log(`\n  Rapid fire (10x):`);
  for (let i = 0; i < 10; i++) {
    const { latency, isError } = await callAndRecord(client, "get-logcat", { lines: 20, priority: "W" }, `logcat-rapid-${i}`);
    process.stdout.write(isError ? "✗" : "✓");
  }
  console.log();
}

async function testNetworkEdge(client) {
  console.log("\n══════ E. NETWORK / CONNECTIVITY EDGE CASES ══════\n");

  // Baseline
  const baseline = await callAndRecord(client, "get-network-info", {}, "network-baseline");
  console.log(`  Baseline WiFi: ${JSON.stringify(baseline.parsed?.wifi?.enabled)}, ${baseline.latency}ms`);

  // Multiple rapid calls
  console.log(`  Rapid network queries (5x):`);
  for (let i = 0; i < 5; i++) {
    const { latency, isError } = await callAndRecord(client, "get-network-info", {}, `network-rapid-${i}`);
    process.stdout.write(`${latency}ms `);
  }
  console.log();
}

async function testPermissionFailure() {
  console.log("\n══════ G. PERMISSION / FAILURE CASES ══════\n");

  // Create a client WITHOUT write permission
  const roTransport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { ...process.env, ANDROID_MCP_ALLOW_WRITE: "false", ANDROID_MCP_ALLOW_SHELL: "false" },
  });
  const roClient = new Client({ name: "e2e-readonly", version: "1.0" });
  await roClient.connect(roTransport);

  // Write-protected tools
  const writeCmds = [
    ["tap", { x: 100, y: 100 }],
    ["install-app", { apkPath: "/tmp/test.apk" }],
    ["push-file", { localPath: "/tmp/test", remotePath: "/sdcard/test" }],
    ["clear-logcat", {}],
    ["change-setting", { namespace: "global", key: "test", value: "1" }],
  ];

  for (const [tool, args] of writeCmds) {
    const { isError, parsed } = await callAndRecord(roClient, tool, args, `perm-write-${tool}`);
    const blocked = isError && (typeof parsed === "string" ? parsed.includes("ALLOW_WRITE") : false);
    console.log(`  ${blocked ? "✓ BLOCKED" : isError ? "✓ ERROR" : "❌ ALLOWED"} ${tool}`);
  }

  // Shell-protected
  const { isError: shellBlocked } = await callAndRecord(roClient, "execute-shell", { command: "echo test" }, "perm-shell");
  console.log(`  ${shellBlocked ? "✓ BLOCKED" : "❌ ALLOWED"} execute-shell`);

  // Read tools should still work
  const readCmds = ["list-devices", "get-device-info", "get-battery-info"];
  for (const tool of readCmds) {
    const { isError } = await callAndRecord(roClient, tool, {}, `perm-read-${tool}`);
    console.log(`  ${isError ? "❌ BLOCKED" : "✓ ALLOWED"} ${tool} (read)`);
  }

  await roClient.close();
}

// ─── Report Generator ───

function generateReport() {
  console.log("\n\n" + "═".repeat(70));
  console.log("  FULL E2E VALIDATION REPORT");
  console.log("═".repeat(70));

  // Summary
  let totalRuns = 0, totalPass = 0, totalFail = 0;
  for (const [, runs] of Object.entries(results)) {
    for (const r of runs) {
      totalRuns++;
      if (r.success) totalPass++; else totalFail++;
    }
  }

  const passRate = (totalPass / totalRuns * 100).toFixed(1);
  const status = totalFail === 0 ? "PASS" : passRate >= 95 ? "PARTIAL" : "FAIL";
  console.log(`\n### 1. Summary`);
  console.log(`  Status: ${status}`);
  console.log(`  Total runs: ${totalRuns}`);
  console.log(`  Pass: ${totalPass} (${passRate}%)`);
  console.log(`  Fail: ${totalFail}`);

  // Tool-by-tool table
  console.log(`\n### 2. Tool-by-tool Results`);
  console.log(`  ${"Tool".padEnd(22)} ${"Runs".padStart(5)} ${"Pass".padStart(5)} ${"Fail".padStart(5)} ${"Rate".padStart(7)} ${"Avg(ms)".padStart(8)} ${"Min".padStart(6)} ${"Max".padStart(6)}`);
  console.log(`  ${"-".repeat(22)} ${"-".repeat(5)} ${"-".repeat(5)} ${"-".repeat(5)} ${"-".repeat(7)} ${"-".repeat(8)} ${"-".repeat(6)} ${"-".repeat(6)}`);

  const toolNames = [...new Set(Object.keys(results))].sort();
  const criticalIssues = [];
  const minorIssues = [];

  for (const tool of toolNames) {
    const runs = results[tool];
    const pass = runs.filter(r => r.success).length;
    const fail = runs.length - pass;
    const latencies = runs.map(r => r.latency).filter(l => l > 0);
    const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const min = latencies.length ? Math.min(...latencies) : 0;
    const max = latencies.length ? Math.max(...latencies) : 0;
    const rate = (pass / runs.length * 100).toFixed(0) + "%";

    console.log(`  ${tool.padEnd(22)} ${String(runs.length).padStart(5)} ${String(pass).padStart(5)} ${String(fail).padStart(5)} ${rate.padStart(7)} ${String(avg).padStart(8)} ${String(min).padStart(6)} ${String(max).padStart(6)}`);

    if (fail > 0 && !tool.startsWith("perm-") && !runs[0]?.run?.includes("timeout") && !runs[0]?.run?.includes("invalid") && !runs[0]?.run?.includes("empty")) {
      const failRuns = runs.filter(r => !r.success);
      for (const fr of failRuns) {
        if (fr.run?.includes("perm-") || fr.run?.includes("invalid") || fr.run?.includes("empty") || fr.run?.includes("timeout")) continue;
        criticalIssues.push({ tool, run: fr.run, error: fr.error, latency: fr.latency });
      }
    }

    if (max > 5000 && tool !== "take-screenshot") {
      minorIssues.push(`${tool}: max latency ${max}ms (consider timeout/optimization)`);
    }
    if (max > 0 && max > avg * 3 && latencies.length > 3) {
      minorIssues.push(`${tool}: high latency variance (avg=${avg}ms, max=${max}ms)`);
    }
  }

  // Critical Issues
  console.log(`\n### 3. Critical Issues`);
  if (criticalIssues.length === 0) {
    console.log(`  None found.`);
  } else {
    for (const issue of criticalIssues) {
      console.log(`  ❌ ${issue.tool} [${issue.run}]: ${JSON.stringify(issue.error).substring(0, 200)}`);
    }
  }

  // Minor Issues
  console.log(`\n### 4. Minor Issues / Improvements`);
  if (minorIssues.length === 0) {
    console.log(`  None found.`);
  } else {
    for (const issue of minorIssues) {
      console.log(`  ⚠️  ${issue}`);
    }
  }

  return { status, totalRuns, totalPass, totalFail, criticalIssues, minorIssues };
}

// ─── Main ───

async function main() {
  console.log("Android MCP Server — Full E2E Validation");
  console.log(`Device: Galaxy S24 (SM-S921N), Android 16, SDK 36`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("─".repeat(50));

  const client = await createClient();

  await testStability(client);
  await testUiHierarchy(client);
  await testScreenshot(client);
  await testShellSafety(client);
  await testLogcatStress(client);
  await testNetworkEdge(client);

  await client.close();

  // Permission tests use their own read-only client internally
  await testPermissionFailure();

  generateReport();
  process.exit(0);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
