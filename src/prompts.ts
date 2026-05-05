import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// MCP Prompts: pre-built workflow templates that clients can invoke. Each
// returns a user-facing instruction the LLM should follow, leveraging the
// already-registered Android tools.
//
// Convention: prompt argument schemas use `z.string()` per MCP spec (clients
// pass arguments as strings). Numeric / boolean defaults are parsed inside
// the handler.

export function registerPrompts(server: McpServer): void {
  // ========== 1. crash-investigation ==========
  server.registerPrompt(
    "crash-investigation",
    {
      title: "Investigate app crash",
      description:
        "Pull recent crash logs for an app, correlate with package info (targetSdk, permissions) and current memory state, then produce a diagnosis.",
      argsSchema: {
        packageName: z.string().describe("App package name, e.g. 'com.example.app'"),
        serial: z.string().optional().describe("Device serial (optional; required when multiple devices are connected)"),
      },
    },
    ({ packageName, serial }) => {
      const serialArg = serial ? `, serial=${JSON.stringify(serial)}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Investigate recent crashes for the Android package '${packageName}'.`,
                "",
                "Steps:",
                `1. Call \`get-crash-logs\` with packageName=${JSON.stringify(packageName)}${serialArg} to extract recent crash stack traces (FATAL EXCEPTION / AndroidRuntime entries).`,
                `2. Call \`get-package-info\` with packageName=${JSON.stringify(packageName)}${serialArg}; record targetSdkVersion, minSdkVersion, versionName, and the granted permissions list.`,
                `3. Call \`get-mem-info\` with packageName=${JSON.stringify(packageName)}${serialArg} to capture the app's current heap state (PSS, native heap, java heap).`,
                "4. Correlate the crash stack trace with the SDK version (deprecated APIs? permission model changes between target SDK and runtime?) and the memory state (OOM? low native heap?).",
                "5. Produce a diagnosis: most likely root cause + which signal supports it (stack frame, SDK gap, memory pressure) + concrete next-step (e.g. 'targetSdk=33 but uses background location without FOREGROUND_SERVICE_LOCATION permission').",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  // ========== 2. memory-leak-detection ==========
  server.registerPrompt(
    "memory-leak-detection",
    {
      title: "Detect memory leak via sampling",
      description:
        "Sample app memory N times at a fixed interval, snapshot screen for visual context, compute heap deltas, and flag monotonic growth as a leak suspect.",
      argsSchema: {
        packageName: z.string().describe("App package name to monitor"),
        samples: z.string().optional().describe("Number of samples to take (default: '5')"),
        intervalSeconds: z.string().optional().describe("Seconds between samples (default: '10')"),
      },
    },
    ({ packageName, samples, intervalSeconds }) => {
      const n = samples ?? "5";
      const interval = intervalSeconds ?? "10";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Detect memory leaks in '${packageName}' by sampling heap usage ${n} times every ${interval} seconds.`,
                "",
                "Steps:",
                `1. Take a baseline reading: call \`get-mem-info\` with packageName=${JSON.stringify(packageName)}. Record nativeHeap, javaHeap, totalPss, and viewCount with timestamp t0.`,
                `2. Loop ${n} times. Between iterations, wait ${interval} seconds. In each iteration:`,
                `   a. Call \`get-mem-info\` with packageName=${JSON.stringify(packageName)}.`,
                `   b. Call \`take-screenshot\` to capture the current UI state for visual context (note which screen the user is on).`,
                "   c. Append (timestamp, nativeHeap, javaHeap, totalPss, viewCount, screen-description) to a samples table.",
                "3. Compute deltas between consecutive samples for each metric.",
                "4. Flag suspected leaks: any metric that is **monotonically non-decreasing** across all samples AND grew by >10% from baseline. Pay special attention to nativeHeap (native leaks via JNI/Bitmap) and viewCount (Activity/Fragment leaks).",
                "5. Produce a markdown table of samples + a verdict: 'NO LEAK' / 'SUSPECTED LEAK in <metric>' with the growth slope and which UI screen seems to drive growth.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  // ========== 3. ui-element-locator ==========
  server.registerPrompt(
    "ui-element-locator",
    {
      title: "Locate UI element by natural-language description",
      description:
        "Take an annotated screenshot + UI hierarchy, match the user's description to the best element, and return its index/coordinates with a tap suggestion.",
      argsSchema: {
        description: z.string().describe("Natural-language description of the target element, e.g. 'the blue Login button at the bottom'"),
        serial: z.string().optional().describe("Device serial (optional)"),
      },
    },
    ({ description, serial }) => {
      const serialArg = serial ? `, serial=${JSON.stringify(serial)}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Locate the UI element described as: "${description}".`,
                "",
                "Steps:",
                `1. Call \`take-annotated-screenshot\`${serial ? ` with serial=${JSON.stringify(serial)}` : ""} to get a numbered overlay of all interactive elements with their indexes and bounds.`,
                `2. Call \`dump-ui-hierarchy\` with compact=true${serialArg} to retrieve a token-efficient list of clickable/focusable elements (text, content-desc, resource-id, bounds, index).`,
                `3. Match "${description}" against each candidate using these signals (in priority order):`,
                "   a. text content (visible label).",
                "   b. content-desc (accessibility label).",
                "   c. resource-id (developer-given id, often semantic).",
                "   d. spatial position from the annotated screenshot (e.g. 'bottom', 'top-right').",
                "4. Pick the highest-confidence match. If multiple match, prefer the one closest to the position hint in the description.",
                "5. Return: { index, text, resource-id, bounds, center coordinates (x, y) } and suggest the next call: `tap-element` with that index (preferred), or `tap` with the center coords as fallback. If no good match (<60% confidence), say so and list the top 3 candidates.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  // ========== 4. app-startup-profile ==========
  server.registerPrompt(
    "app-startup-profile",
    {
      title: "Profile app cold-start performance",
      description:
        "Clear logcat, launch the app, parse the ActivityManagerService 'Displayed' line for launch time, capture cpu/gfx info, and produce startup metrics + recommendations.",
      argsSchema: {
        packageName: z.string().describe("Package name to launch and profile"),
        serial: z.string().optional().describe("Device serial (optional)"),
      },
    },
    ({ packageName, serial }) => {
      const serialArg = serial ? `, serial=${JSON.stringify(serial)}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Profile cold-start performance of '${packageName}'.`,
                "",
                "Steps:",
                `1. Call \`stop-app\` with packageName=${JSON.stringify(packageName)}${serialArg} to ensure a true cold start (ignore failures if the app isn't running).`,
                `2. Call \`clear-logcat\`${serial ? ` with serial=${JSON.stringify(serial)}` : ""} so the next launch's 'Displayed' line is easy to find.`,
                `3. Call \`launch-app\` with packageName=${JSON.stringify(packageName)}${serialArg}. Record the wall-clock timestamp at this moment as t_launch.`,
                `4. Call \`get-logcat\` with tag='ActivityTaskManager' (or fall back to tag='ActivityManager' on older Android), priority='I', lines=200${serialArg}. Search for a line matching \`Displayed ${packageName}/.*: \\+([0-9ms]+)\` — the suffix is the cold-start time reported by the system. If not seen yet, repeat the get-logcat call up to 3 times with a small wait.`,
                `5. Once Displayed is captured, call \`get-cpu-info\` with packageName=${JSON.stringify(packageName)}${serialArg} and \`get-gfx-info\` with packageName=${JSON.stringify(packageName)}${serialArg} to capture CPU usage and first-frame jank stats.`,
                "6. Produce a report with: cold-start time (ms, from the Displayed line), CPU% during launch, jank percentage / 50p / 90p / 95p frame times, and recommendations:",
                "   - Cold start >2000ms: investigate Application.onCreate() blocking work, content provider init, large dependency-injection graphs.",
                "   - Jank >10%: profile main-thread work in onCreate/onResume.",
                "   - High first-frame latency (>700ms 95p): suspect synchronous I/O in UI thread.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  // ========== 5. permission-audit ==========
  server.registerPrompt(
    "permission-audit",
    {
      title: "Audit app permissions for over-privilege",
      description:
        "List declared/granted permissions for an app, classify by Android protection level, flag dangerous permissions that look unjustified, and suggest revoke commands.",
      argsSchema: {
        packageName: z.string().describe("Package name to audit"),
      },
    },
    ({ packageName }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Audit the permission surface of '${packageName}'.`,
                "",
                "Steps:",
                `1. Call \`get-package-info\` with packageName=${JSON.stringify(packageName)} to get declared permissions (requested + granted).`,
                "2. Classify each permission by Android protection level:",
                "   - **dangerous** (runtime-prompted): CAMERA, READ/WRITE_EXTERNAL_STORAGE, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, RECORD_AUDIO, READ/WRITE_CONTACTS, READ/SEND_SMS, READ/WRITE_CALL_LOG, READ_PHONE_STATE, BODY_SENSORS, ACTIVITY_RECOGNITION, POST_NOTIFICATIONS, READ_MEDIA_IMAGES/VIDEO/AUDIO, etc.",
                "   - **normal** (auto-granted): INTERNET, ACCESS_NETWORK_STATE, VIBRATE, WAKE_LOCK, etc.",
                "   - **signature** (system-only): platform-protected, only granted to apps signed with the platform key.",
                `3. Flag dangerous permissions that look unjustified given the package name pattern. Heuristic: if '${packageName}' has no obvious need (e.g. a calculator app requesting RECORD_AUDIO, or a flashlight app requesting READ_CONTACTS), call it out. State the heuristic + your reasoning explicitly so the user can override.`,
                "4. For each flagged permission, suggest a revocation command:",
                `   \`revoke-permission\` with packageName=${JSON.stringify(packageName)}, permission='<perm>'.`,
                "   Note: this requires \`ANDROID_MCP_ALLOW_WRITE=true\`. If write is not enabled, just print the suggested commands; do not attempt the call.",
                "5. Produce a markdown report: table of (permission, protection level, granted?, justified?), then the list of suggested revocations.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "anr-investigation",
    {
      title: "Investigate an ANR (Application Not Responding)",
      description:
        "Pull the latest ANR trace, identify the blocking thread/lock, correlate with logcat around the ANR timestamp, and produce a triage summary with suggested next steps.",
      argsSchema: {
        packageName: z.string().optional().describe("Package name to scope the investigation. Omit to pull the most recent ANR regardless of app."),
        serial: z.string().optional().describe("Device serial. Omit when only one device is connected."),
      },
    },
    ({ packageName, serial }) => {
      const ser = serial ? ` with serial=${JSON.stringify(serial)}` : "";
      const pkg = packageName ? `'${packageName}'` : "the most recent ANR";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Investigate ${pkg} ANR on the device${ser ? " (serial " + JSON.stringify(serial) + ")" : ""}.`,
              "",
              "Steps:",
              `1. Read \`/data/anr/anr_*\` traces. Use \`run-shell\` with command='ls -lt /data/anr/' (requires ANDROID_MCP_ALLOW_SHELL=true) to find the latest file. If shell isn't enabled, fall back to \`logcat-search\`${ser} with query='ANR in${packageName ? " " + packageName : ""}' to find ANR notifications and timestamps.`,
              `2. Pull the trace contents and identify the **main thread** stack — the thread that was blocked. Look for one of:`,
              "   - **lock contention**: 'waiting to lock' / 'held by tid=N' — grab the holder thread's stack too.",
              "   - **binder transaction**: 'IPCThreadState' / 'BinderProxy.transactNative' — likely a system-service round-trip blocking.",
              "   - **disk/network on main thread**: 'StrictMode' violations OR 'FileInputStream.read' / 'OkHttp' frames in the main stack.",
              "   - **deadlock**: 'waiting on' cycle between two app threads.",
              `3. Call \`logcat-search\`${ser} with query='AndroidRuntime|ANR' time-bounded to ±60s of the ANR timestamp to surface adjacent crashes / GC pauses / WindowManager 'no focused window' messages.`,
              `4. Call \`get-cpu-info\`${ser} and \`get-memory-info\`${ser ? ` with serial=${JSON.stringify(serial)}` : ""} to capture system pressure at investigation time (a useful baseline if the issue is reproducible).`,
              "5. Produce a triage summary:",
              "   - Suspected category (lock contention / binder / disk on main / deadlock / GC pressure / unknown)",
              "   - Blocking thread + blocker thread stacks (3-5 frames each)",
              "   - Adjacent logcat lines (timestamp + tag + message)",
              "   - One concrete next action (e.g. 'move FileWriter call off main thread', 'add timeout on Binder call', 'profile with Macrobenchmark to reproduce')",
              "Do NOT call any write tools. Read-only investigation.",
            ].join("\n"),
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "battery-drain-investigation",
    {
      title: "Investigate battery drain attributable to an app",
      description:
        "Use batterystats / dumpsys battery / wakelock data to identify an app's drain footprint, top wakelock holders, doze interactions, and produce a remediation plan.",
      argsSchema: {
        packageName: z.string().describe("Package name to investigate. Use list-installed-packages or detect from logs."),
        serial: z.string().optional().describe("Device serial. Omit when only one device is connected."),
      },
    },
    ({ packageName, serial }) => {
      const ser = serial ? ` with serial=${JSON.stringify(serial)}` : "";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Investigate battery drain attributable to '${packageName}'${serial ? ` on serial ${JSON.stringify(serial)}` : ""}.`,
              "",
              "Steps:",
              `1. Reset the counters baseline (so subsequent runs reflect the active period):`,
              `   \`run-shell\`${ser} with command='dumpsys batterystats --reset' (requires ANDROID_MCP_ALLOW_SHELL=true). If shell isn't enabled, skip this step and read whatever's in the existing window.`,
              `2. Capture battery state once (level, plugged, temperature) via \`get-battery-info\`${ser}.`,
              `3. Read the wake-lock and CPU attribution slices for ${JSON.stringify(packageName)}:`,
              `   - \`run-shell\`${ser} with command='dumpsys batterystats --since-checkin | grep -E "^9,${packageName},|^9,h,|wakelock"' — top consumers by package.`,
              `   - \`run-shell\`${ser} with command='dumpsys power | grep -A 5 "Wake Locks"' — currently-held wakelocks.`,
              `   - \`run-shell\`${ser} with command='dumpsys deviceidle | grep -E "STATE|whitelist"' — doze state and whether the app is on the battery whitelist.`,
              `4. Read the JobScheduler / WorkManager state for ${JSON.stringify(packageName)}:`,
              `   - \`run-shell\`${ser} with command='dumpsys jobscheduler | grep -A 10 ${JSON.stringify(packageName)}' — surfaces stuck or frequently-rescheduled jobs.`,
              `5. Read the network attribution:`,
              `   - \`run-shell\`${ser} with command='dumpsys netstats | grep -A 3 ${JSON.stringify(packageName)}' — bytes per uid.`,
              "6. Produce a remediation plan:",
              "   - Suspected category: chatty wakelock / frequent jobs / network polling / location pings / foreground service overuse / unknown",
              "   - Top 3 offenders by approximate energy contribution (numbers from batterystats)",
              "   - Concrete fixes (e.g. 'replace 30s polling with WorkManager + setBackoffCriteria', 'add JobInfo.setRequiresDeviceIdle if data isn't time-sensitive', 'check that the FCM listener exits ≤10s')",
              "Do NOT call any write tools. Read-only investigation.",
            ].join("\n"),
          },
        }],
      };
    },
  );
}
