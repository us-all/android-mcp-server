#!/usr/bin/env node
/**
 * Smoke test — verifies the MCP server starts, connects, and core tools respond.
 * Requires a connected Android device or emulator.
 *
 * Usage: pnpm run smoke
 */

import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const TIMEOUT = 15_000;
let client;
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "assertion failed");
}

try {
  console.log("Android MCP Server — Smoke Test\n");

  // 1. Connect
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: {
      ...process.env,
      ANDROID_MCP_ALLOW_WRITE: "true",
      ANDROID_MCP_ALLOW_SHELL: "true",
    },
  });
  client = new Client({ name: "smoke-test", version: "1.0" });

  const connectTimeout = setTimeout(() => {
    console.error("  ✗ Connection timed out");
    process.exit(1);
  }, TIMEOUT);

  await client.connect(transport);
  clearTimeout(connectTimeout);
  console.log("  ✓ Server connected\n");

  // 2. Tool listing
  const tools = await client.listTools();
  await test(`Tool count ≥ 50 (got ${tools.tools.length})`, () => {
    assert(tools.tools.length >= 50, `only ${tools.tools.length} tools`);
  });

  // 3. Core read tools (no device needed for list-devices)
  await test("list-devices returns valid response", async () => {
    const r = await client.callTool({ name: "list-devices", arguments: {} });
    const data = JSON.parse(r.content[0].text);
    assert(typeof data.count === "number", "missing count");
    assert(Array.isArray(data.devices), "missing devices array");
  });

  // 4. Check if a device is connected for device-dependent tests
  const devResult = await client.callTool({ name: "list-devices", arguments: {} });
  const devData = JSON.parse(devResult.content[0].text);
  const hasDevice = devData.count > 0 && devData.devices.some((d) => d.status === "device");

  if (!hasDevice) {
    console.log("\n  ⚠ No device connected — skipping device-dependent tests\n");
  } else {
    console.log(`\n  Device: ${devData.devices[0].model ?? devData.devices[0].serial}\n`);

    await test("get-device-info", async () => {
      const r = await client.callTool({ name: "get-device-info", arguments: {} });
      const data = JSON.parse(r.content[0].text);
      assert(data.model, "missing model");
      assert(data.sdkVersion > 0, "invalid sdk");
    });

    await test("get-battery-info", async () => {
      const r = await client.callTool({ name: "get-battery-info", arguments: {} });
      const data = JSON.parse(r.content[0].text);
      assert(typeof data.level === "number", "missing level");
    });

    await test("take-screenshot returns image", async () => {
      const r = await client.callTool({ name: "take-screenshot", arguments: {} });
      assert(r.content[0].type === "image", "not an image");
      assert(r.content[0].data.length > 1000, "image too small");
    });

    await test("dump-ui-hierarchy (compact)", async () => {
      const r = await client.callTool({ name: "dump-ui-hierarchy", arguments: { compact: true } });
      const data = JSON.parse(r.content[0].text);
      assert(typeof data.elementCount === "number", "missing elementCount");
      assert(Array.isArray(data.elements), "missing elements");
    });

    await test("get-logcat", async () => {
      const r = await client.callTool({ name: "get-logcat", arguments: { lines: 5 } });
      const data = JSON.parse(r.content[0].text);
      assert(typeof data.lineCount === "number", "missing lineCount");
    });

    await test("get-current-activity", async () => {
      const r = await client.callTool({ name: "get-current-activity", arguments: {} });
      const data = JSON.parse(r.content[0].text);
      assert(Array.isArray(data.raw), "missing raw");
    });

    await test("execute-shell (echo)", async () => {
      const r = await client.callTool({ name: "execute-shell", arguments: { command: "echo smoke_ok" } });
      const data = JSON.parse(r.content[0].text);
      assert(data.output.includes("smoke_ok"), "unexpected output");
    });
  }

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log(`  ${failed === 0 ? "✓ SMOKE TEST PASSED" : "✗ SMOKE TEST FAILED"}`);

  await client.close();
  process.exit(failed > 0 ? 1 : 0);
} catch (e) {
  console.error(`\n  ✗ Fatal: ${e.message}`);
  if (client) await client.close().catch(() => {});
  process.exit(1);
}
