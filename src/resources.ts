import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listDevices, getDeviceInfo } from "./tools/device.js";
import { adbShell } from "./adb.js";

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), "ui");
const DEVICE_HEALTH_HTML = readFileSync(join(UI_DIR, "device-health.html"), "utf-8");

/**
 * MCP Resources for hot Android entities.
 * URI scheme: `android://`
 *   - android://devices                              — list of connected devices
 *   - android://device/{serial}                      — device details by serial
 *   - android://app/{packageName}/activities         — launchable activities for a package
 *   - android://device/{serial}/processes            — running processes snapshot
 */

function asJson(uri: string, data: unknown) {
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2),
    }],
  };
}

/** Optional `?serial=...` from a resource URI. */
function serialFromUri(uri: URL): string | undefined {
  const s = uri.searchParams.get("serial");
  return s ? s : undefined;
}

/**
 * Parse `dumpsys package <pkg>` output for activity declarations.
 * Looks at the "Activity Resolver Table" section (intent filters → launchable
 * activities) plus per-package Activity entries with `exported=...` flags.
 */
export function parseActivitiesFromDumpsys(
  output: string,
  packageName: string,
): Array<{ activity: string; exported: boolean; launchable: boolean }> {
  // Track activities seen in the LAUNCHER intent filter section.
  const launchable = new Set<string>();
  const lines = output.split("\n");

  // 1. Walk the Activity Resolver Table looking for android.intent.category.LAUNCHER
  //    blocks. Component names appear on lines like:
  //      "  abcd1234 com.example/.MainActivity filter ..."
  //    or as "<pkg>/<cls>" tokens within the block.
  let inLauncherSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("android.intent.category.LAUNCHER")) {
      inLauncherSection = true;
      continue;
    }
    if (inLauncherSection) {
      // A blank line or a new intent-category header ends the block.
      if (/^\s*$/.test(line)) {
        inLauncherSection = false;
        continue;
      }
      const compMatch = line.match(
        /([a-zA-Z][\w.]*)\/(\.?[a-zA-Z][\w.$]*)/,
      );
      if (compMatch && compMatch[1] === packageName) {
        const cls = compMatch[2].startsWith(".")
          ? packageName + compMatch[2]
          : compMatch[2];
        launchable.add(cls);
      }
    }
  }

  // 2. Collect every Activity entry for this package; capture `exported=` if present.
  //    Entries look like:
  //      "  Activity #0:"
  //      "    ActivityInfo:"
  //      "      packageName=com.example processName=com.example"
  //      "      name=com.example.MainActivity"
  //      "      exported=true"
  const activities = new Map<string, { exported: boolean }>();
  let currentName: string | null = null;
  let currentExported = false;
  let currentPkg: string | null = null;

  const flush = () => {
    if (currentName && currentPkg === packageName) {
      const cls = currentName.startsWith(".")
        ? packageName + currentName
        : currentName;
      // Last-write-wins is fine — the dumpsys block is consistent.
      activities.set(cls, { exported: currentExported });
    }
    currentName = null;
    currentExported = false;
    currentPkg = null;
  };

  for (const line of lines) {
    if (/^\s*Activity #\d+:/.test(line) || /^\s*ActivityInfo:/.test(line)) {
      // New activity record — flush the previous one.
      flush();
      continue;
    }
    const pkgM = line.match(/packageName=(\S+)/);
    if (pkgM) currentPkg = pkgM[1];

    const nameM = line.match(/^\s*name=(\S+)/);
    if (nameM) currentName = nameM[1];

    if (/exported=true/.test(line)) currentExported = true;
    else if (/exported=false/.test(line)) currentExported = false;
  }
  flush();

  // 3. Also fall back to component tokens "<pkg>/<.Activity>" that appear in
  //    Activity Resolver entries — these are sometimes the only signal in
  //    minimal dumpsys output. Only add ones not already captured.
  for (const line of lines) {
    const m = line.match(
      new RegExp(
        `(?:^|\\s)${packageName.replace(/\./g, "\\.")}\\/(\\.?[a-zA-Z][\\w.$]*)`,
      ),
    );
    if (m) {
      const cls = m[1].startsWith(".") ? packageName + m[1] : m[1];
      if (!activities.has(cls)) {
        activities.set(cls, { exported: launchable.has(cls) });
      }
    }
  }

  const result = [...activities.entries()].map(([activity, meta]) => ({
    activity,
    exported: meta.exported,
    launchable: launchable.has(activity),
  }));

  // Stable sort: launchable first, then alphabetical.
  result.sort((a, b) => {
    if (a.launchable !== b.launchable) return a.launchable ? -1 : 1;
    return a.activity.localeCompare(b.activity);
  });

  return result;
}

/**
 * Parse `ps -A -o PID,USER,VSZ,RSS,NAME` (Android toybox) output.
 * Falls back gracefully if columns shift; unrecognized rows are skipped.
 */
export function parseProcessList(output: string): Array<{
  pid: number;
  name: string;
  user: string;
  vss: number;
  rss: number;
}> {
  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect & skip the header row (first row containing non-numeric PID column).
  const header = lines[0];
  const start = /^\s*PID\b/i.test(header) || !/^\d+\s/.test(header) ? 1 : 0;

  const procs: Array<{
    pid: number;
    name: string;
    user: string;
    vss: number;
    rss: number;
  }> = [];

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(/\s+/);
    // Expect: PID USER VSZ RSS NAME (toybox layout differs from busybox; both
    // produce >=5 columns with NAME being the trailing field — possibly with
    // spaces, e.g. "[kworker/0:1H]"). Join everything from index 4 onward.
    if (cols.length < 5) continue;
    const pid = parseInt(cols[0], 10);
    if (!Number.isFinite(pid)) continue;
    const user = cols[1];
    const vss = parseInt(cols[2], 10);
    const rss = parseInt(cols[3], 10);
    const name = cols.slice(4).join(" ");
    procs.push({
      pid,
      name,
      user,
      vss: Number.isFinite(vss) ? vss : 0,
      rss: Number.isFinite(rss) ? rss : 0,
    });
  }

  return procs;
}

export function registerResources(server: McpServer): void {
  server.registerResource(
    "devices",
    "android://devices",
    {
      title: "Connected Android Devices",
      description: "All connected Android devices and emulators",
      mimeType: "application/json",
    },
    async (uri) => {
      const data = await listDevices();
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "device",
    new ResourceTemplate("android://device/{serial}", { list: undefined }),
    {
      title: "Android Device Info",
      description: "Detailed device info (model, brand, Android version, display) by serial",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await getDeviceInfo({ serial: String(vars.serial) });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "app-activities",
    new ResourceTemplate("android://app/{packageName}/activities", {
      list: undefined,
    }),
    {
      title: "App Launchable Activities",
      description:
        "Activities declared by a package, with exported / launchable flags. Optional ?serial=<id> selects a device.",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const packageName = String(vars.packageName);
      const serial = serialFromUri(uri);
      const opts = serial ? { serial } : undefined;
      const output = await adbShell(`dumpsys package ${packageName}`, opts);
      const activities = parseActivitiesFromDumpsys(output, packageName);
      return asJson(uri.toString(), {
        packageName,
        count: activities.length,
        activities,
      });
    },
  );

  server.registerResource(
    "device-processes",
    new ResourceTemplate("android://device/{serial}/processes", {
      list: undefined,
    }),
    {
      title: "Device Processes",
      description:
        "Running processes snapshot ({pid, name, user, vss, rss}) via `ps -A`.",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const serial = String(vars.serial);
      const output = await adbShell(
        "ps -A -o PID,USER,VSZ,RSS,NAME",
        { serial },
      );
      const processes = parseProcessList(output);
      return asJson(uri.toString(), {
        serial,
        count: processes.length,
        processes,
      });
    },
  );

  // --- Apps SDK UI templates (ui:// scheme) ---
  // Rendered by ChatGPT / Apps SDK clients via _meta["openai/outputTemplate"].
  // Claude clients ignore the metadata and use the tool's text content instead.
  server.registerResource(
    "device-health-card",
    "ui://widget/device-health.html",
    {
      title: "Device Health card",
      description: "Apps SDK UI template rendered with device-health tool output",
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/outputTemplate": "ui://widget/device-health.html",
        "ui.resourceUri": "ui://widget/device-health.html",
      },
    },
    async (uri) => ({
      contents: [{
        uri: uri.toString(),
        mimeType: "text/html+skybridge",
        text: DEVICE_HEALTH_HTML,
      }],
    }),
  );
}
