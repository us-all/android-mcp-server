#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, "..", "dist", "index.js");

const BASE_ENV = {};

const SCENARIOS = [
  { label: "default", env: {} },
  { label: "narrow (device,ui)", env: { ANDROID_TOOLS: "device,ui" } },
  { label: "typical (device,ui,apps,logcat)", env: { ANDROID_TOOLS: "device,ui,apps,logcat" } },
];

function estimateTokens(text) { return Math.round(text.length / 4); }

function measure(envOverlay) {
  const init = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "tok", version: "1" } } });
  const initialized = JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" });
  const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const result = spawnSync("node", [SERVER_ENTRY], { input: `${init}\n${initialized}\n${list}\n`, timeout: 15000, env: { ...process.env, ...BASE_ENV, ...envOverlay }, encoding: "utf8" });
  for (const line of (result.stdout ?? "").split("\n").filter(Boolean)) {
    try {
      const msg = JSON.parse(line);
      if (msg.id === 2 && msg.result?.tools) {
        const j = JSON.stringify(msg.result.tools);
        return { count: msg.result.tools.length, bytes: j.length, tokens: estimateTokens(j) };
      }
    } catch {}
  }
  return { error: "no tools/list response", stderr: (result.stderr ?? "").slice(0, 200) };
}

console.log("scenario,toolCount,jsonBytes,estTokens,vsDefault");
let baseline = null;
let exitCode = 0;
for (const { label, env } of SCENARIOS) {
  const r = measure(env);
  if (r.error) { console.error(`${label},ERROR,${r.error}`); exitCode = 1; continue; }
  if (baseline === null) baseline = r.tokens;
  const reduction = baseline > 0 ? Math.round(((baseline - r.tokens) / baseline) * 100) : 0;
  const vs = env && Object.keys(env).length > 0 ? `-${reduction}%` : "—";
  console.log(`${label},${r.count},${r.bytes},${r.tokens},${vs}`);
}

const budget = Number(process.env.TOKEN_BUDGET ?? 0);
if (budget > 0 && baseline > budget) { console.error(`\n❌ default schema tokens (${baseline}) exceed TOKEN_BUDGET=${budget}`); exitCode = 2; }
process.exit(exitCode);
