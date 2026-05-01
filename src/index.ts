#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateConfig } from "./config.js";
import { wrapToolHandler, wrapImageToolHandler } from "./tools/utils.js";

// Device tools
import {
  listDevicesSchema,
  listDevices,
  getDeviceInfoSchema,
  getDeviceInfo,
  getDevicePropertiesSchema,
  getDeviceProperties,
  connectDeviceSchema,
  connectDevice,
  disconnectDeviceSchema,
  disconnectDevice,
} from "./tools/device.js";

// App tools
import {
  listPackagesSchema,
  listPackages,
  getPackageInfoSchema,
  getPackageInfo,
  installAppSchema,
  installApp,
  uninstallAppSchema,
  uninstallApp,
  launchAppSchema,
  launchApp,
  stopAppSchema,
  stopApp,
  clearAppDataSchema,
  clearAppData,
  grantPermissionSchema,
  grantPermission,
  revokePermissionSchema,
  revokePermission,
  openUrlSchema,
  openUrl,
  sendBroadcastSchema,
  sendBroadcast,
  getCurrentActivitySchema,
  getCurrentActivity,
  isAppInstalledSchema,
  isAppInstalled,
  getAppIntentsSchema,
  getAppIntents,
} from "./tools/apps.js";

// UI tools
import {
  takeScreenshotSchema,
  takeScreenshot,
  dumpUiHierarchySchema,
  dumpUiHierarchy,
  tapSchema,
  tap,
  longPressSchema,
  longPress,
  swipeSchema,
  swipe,
  inputTextSchema,
  inputText,
  pressKeySchema,
  pressKey,
  dragAndDropSchema,
  dragAndDrop,
  screenRecordStartSchema,
  screenRecordStart,
  screenRecordPullSchema,
  screenRecordPull,
  doubleTapSchema,
  doubleTap,
  takeAnnotatedScreenshotSchema,
  takeAnnotatedScreenshot,
  tapElementSchema,
  tapElement,
} from "./tools/ui.js";

// Logcat tools
import {
  getLogcatSchema,
  getLogcat,
  clearLogcatSchema,
  clearLogcat,
  searchLogcatSchema,
  searchLogcat,
  getCrashLogsSchema,
  getCrashLogs,
} from "./tools/logcat.js";

// Emulator tools
import {
  listAvdsSchema,
  listAvds,
  startEmulatorSchema,
  startEmulator,
  stopEmulatorSchema,
  stopEmulator,
  listSnapshotsSchema,
  listSnapshots,
  loadSnapshotSchema,
  loadSnapshot,
  saveSnapshotSchema,
  saveSnapshot,
  deleteSnapshotSchema,
  deleteSnapshot,
} from "./tools/emulator.js";

// File tools
import {
  listFilesSchema,
  listFiles,
  pullFileSchema,
  pullFile,
  pushFileSchema,
  pushFile,
  deleteFileSchema,
  deleteFile,
} from "./tools/files.js";

// Shell tools
import { executeShellSchema, executeShell } from "./tools/shell.js";

// System tools
import {
  getBatteryInfoSchema,
  getBatteryInfo,
  getNetworkInfoSchema,
  getNetworkInfo,
  changeSettingSchema,
  changeSetting,
  getSettingSchema,
  getSetting,
  setDisplaySizeSchema,
  setDisplaySize,
  setDisplayDensitySchema,
  setDisplayDensity,
  keepScreenOnSchema,
  keepScreenOn,
  portForwardSchema,
  portForward,
  reverseForwardSchema,
  reverseForward,
  listForwardsSchema,
  listForwards,
  removeForwardSchema,
  removeForward,
  toggleWifiSchema,
  toggleWifi,
  toggleMobileDataSchema,
  toggleMobileData,
  openNotificationSchema,
  openNotification,
  lockDeviceSchema,
  lockDevice,
  unlockDeviceSchema,
  unlockDevice,
  getOrientationSchema,
  getOrientation,
  setOrientationSchema,
  setOrientation,
  listSettingsSchema,
  listSettings,
} from "./tools/system.js";

// Debug tools
import {
  bugreportSchema,
  bugreport,
  getMemInfoSchema,
  getMemInfo,
  getGfxInfoSchema,
  getGfxInfo,
  getCpuInfoSchema,
  getCpuInfo,
  doctorSchema,
  doctor,
} from "./tools/debug.js";

// --- Server setup ---

import { registry, searchToolsSchema, searchTools, type Category } from "./tool-registry.js";
import { registerResources } from "./resources.js";

await validateConfig();

const server = new McpServer({
  name: "android-mcp-server",
  version: "1.3.0",
});

// --- Tool registration with category filtering (ANDROID_TOOLS / ANDROID_DISABLE) ---
let currentCategory: Category = "device";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tool(name: string, description: string, schema: any, handler: any): void {
  registry.register(name, description, currentCategory);
  if (registry.isEnabled(currentCategory)) {
    server.tool(name, description, schema, handler);
  }
}

// ========== Device tools ==========
currentCategory = "device";

tool(
  "list-devices",
  "List all connected Android devices and emulators with their status and details",
  listDevicesSchema.shape,
  wrapToolHandler(listDevices),
);

tool(
  "get-device-info",
  "Get detailed device information including model, brand, Android version, SDK version, display density and size",
  getDeviceInfoSchema.shape,
  wrapToolHandler(getDeviceInfo),
);

tool(
  "get-device-properties",
  "Get Android system properties (getprop). Optionally filter by prefix like 'ro.build' or 'ro.product'",
  getDevicePropertiesSchema.shape,
  wrapToolHandler(getDeviceProperties),
);

tool(
  "connect-device",
  "Connect to a device over TCP/IP (wireless ADB). Requires ANDROID_MCP_ALLOW_WRITE=true",
  connectDeviceSchema.shape,
  wrapToolHandler(connectDevice),
);

tool(
  "disconnect-device",
  "Disconnect a TCP/IP device or all TCP/IP devices. Requires ANDROID_MCP_ALLOW_WRITE=true",
  disconnectDeviceSchema.shape,
  wrapToolHandler(disconnectDevice),
);

// ========== App tools ==========
currentCategory = "apps";

tool(
  "list-packages",
  "List installed packages on the device. Filter by name or type (all, system, third-party)",
  listPackagesSchema.shape,
  wrapToolHandler(listPackages),
);

tool(
  "get-package-info",
  "Get detailed package info: version, SDK targets, install time, permissions",
  getPackageInfoSchema.shape,
  wrapToolHandler(getPackageInfo),
);

tool(
  "install-app",
  "Install an APK file on the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  installAppSchema.shape,
  wrapToolHandler(installApp),
);

tool(
  "uninstall-app",
  "Uninstall an app from the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  uninstallAppSchema.shape,
  wrapToolHandler(uninstallApp),
);

tool(
  "launch-app",
  "Launch an app by package name. Optionally specify activity. Requires ANDROID_MCP_ALLOW_WRITE=true",
  launchAppSchema.shape,
  wrapToolHandler(launchApp),
);

tool(
  "stop-app",
  "Force stop an app by package name. Requires ANDROID_MCP_ALLOW_WRITE=true",
  stopAppSchema.shape,
  wrapToolHandler(stopApp),
);

// ========== UI tools ==========
currentCategory = "ui";

tool(
  "take-screenshot",
  "Capture a screenshot of the device screen. Returns a PNG image",
  takeScreenshotSchema.shape,
  wrapImageToolHandler(takeScreenshot),
);

tool(
  "dump-ui-hierarchy",
  "Dump the UI accessibility tree. Compact mode (default) returns only interactive elements with coordinates for token efficiency",
  dumpUiHierarchySchema.shape,
  wrapToolHandler(dumpUiHierarchy),
);

tool(
  "tap",
  "Tap at specific screen coordinates. Requires ANDROID_MCP_ALLOW_WRITE=true",
  tapSchema.shape,
  wrapToolHandler(tap),
);

tool(
  "long-press",
  "Long press at specific screen coordinates. Requires ANDROID_MCP_ALLOW_WRITE=true",
  longPressSchema.shape,
  wrapToolHandler(longPress),
);

tool(
  "swipe",
  "Swipe from one point to another. Requires ANDROID_MCP_ALLOW_WRITE=true",
  swipeSchema.shape,
  wrapToolHandler(swipe),
);

tool(
  "input-text",
  "Type text on the device. Focus an input field first using tap. Requires ANDROID_MCP_ALLOW_WRITE=true",
  inputTextSchema.shape,
  wrapToolHandler(inputText),
);

tool(
  "press-key",
  "Press a key event (BACK, HOME, ENTER, VOLUME_UP, etc). Requires ANDROID_MCP_ALLOW_WRITE=true",
  pressKeySchema.shape,
  wrapToolHandler(pressKey),
);

// ========== Logcat tools ==========
currentCategory = "logcat";

tool(
  "get-logcat",
  "Get recent logcat output. Filter by tag, priority level, and number of lines",
  getLogcatSchema.shape,
  wrapToolHandler(getLogcat),
);

tool(
  "clear-logcat",
  "Clear the logcat buffer. Requires ANDROID_MCP_ALLOW_WRITE=true",
  clearLogcatSchema.shape,
  wrapToolHandler(clearLogcat),
);

tool(
  "search-logcat",
  "Search logcat for a text pattern. Supports case-sensitive and case-insensitive search",
  searchLogcatSchema.shape,
  wrapToolHandler(searchLogcat),
);

tool(
  "get-crash-logs",
  "Get crash logs from the device. Optionally filter by package name",
  getCrashLogsSchema.shape,
  wrapToolHandler(getCrashLogs),
);

// ========== Emulator tools ==========
currentCategory = "emulator";

tool(
  "list-avds",
  "List available Android Virtual Devices (AVDs) that can be started",
  listAvdsSchema.shape,
  wrapToolHandler(listAvds),
);

tool(
  "start-emulator",
  "Start an Android emulator by AVD name. Supports headless mode and data wipe. Requires ANDROID_MCP_ALLOW_WRITE=true",
  startEmulatorSchema.shape,
  wrapToolHandler(startEmulator),
);

tool(
  "stop-emulator",
  "Stop a running Android emulator. Requires ANDROID_MCP_ALLOW_WRITE=true",
  stopEmulatorSchema.shape,
  wrapToolHandler(stopEmulator),
);

tool(
  "list-snapshots",
  "List available emulator snapshots",
  listSnapshotsSchema.shape,
  wrapToolHandler(listSnapshots),
);

tool(
  "load-snapshot",
  "Load an emulator snapshot. Requires ANDROID_MCP_ALLOW_WRITE=true",
  loadSnapshotSchema.shape,
  wrapToolHandler(loadSnapshot),
);

// ========== File tools ==========
currentCategory = "files";

tool(
  "list-files",
  "List files on the device at a given path. Supports recursive listing",
  listFilesSchema.shape,
  wrapToolHandler(listFiles),
);

tool(
  "pull-file",
  "Pull (download) a file from the device to local filesystem",
  pullFileSchema.shape,
  wrapToolHandler(pullFile),
);

tool(
  "push-file",
  "Push (upload) a local file to the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  pushFileSchema.shape,
  wrapToolHandler(pushFile),
);

tool(
  "delete-file",
  "Delete a file or directory on the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  deleteFileSchema.shape,
  wrapToolHandler(deleteFile),
);

// ========== Shell tools ==========
currentCategory = "shell";

tool(
  "execute-shell",
  "Execute an arbitrary ADB shell command. Requires ANDROID_MCP_ALLOW_SHELL=true (separate from write permission for security)",
  executeShellSchema.shape,
  wrapToolHandler(executeShell),
);

// ========== System tools ==========
currentCategory = "system";

tool(
  "get-battery-info",
  "Get battery status including level, charging state, temperature, and health",
  getBatteryInfoSchema.shape,
  wrapToolHandler(getBatteryInfo),
);

tool(
  "get-network-info",
  "Get network information including WiFi status, IP address, and connectivity details",
  getNetworkInfoSchema.shape,
  wrapToolHandler(getNetworkInfo),
);

tool(
  "change-setting",
  "Change an Android system setting (system/secure/global namespace). Requires ANDROID_MCP_ALLOW_WRITE=true",
  changeSettingSchema.shape,
  wrapToolHandler(changeSetting),
);

// ========== v1.1.0 — App tools ==========
currentCategory = "apps";

tool(
  "clear-app-data",
  "Clear all data and cache for an app (equivalent to factory reset for the app). Requires ANDROID_MCP_ALLOW_WRITE=true",
  clearAppDataSchema.shape,
  wrapToolHandler(clearAppData),
);

tool(
  "grant-permission",
  "Grant a runtime permission to an app. Example: android.permission.CAMERA. Requires ANDROID_MCP_ALLOW_WRITE=true",
  grantPermissionSchema.shape,
  wrapToolHandler(grantPermission),
);

tool(
  "revoke-permission",
  "Revoke a runtime permission from an app. Requires ANDROID_MCP_ALLOW_WRITE=true",
  revokePermissionSchema.shape,
  wrapToolHandler(revokePermission),
);

tool(
  "open-url",
  "Open a URL on the device browser. Supports http/https and deep link URIs. Requires ANDROID_MCP_ALLOW_WRITE=true",
  openUrlSchema.shape,
  wrapToolHandler(openUrl),
);

tool(
  "send-broadcast",
  "Send a broadcast intent with optional extras. Example action: 'android.intent.action.BOOT_COMPLETED'. Requires ANDROID_MCP_ALLOW_WRITE=true",
  sendBroadcastSchema.shape,
  wrapToolHandler(sendBroadcast),
);

tool(
  "get-current-activity",
  "Get the currently visible (resumed) activity and window focus information",
  getCurrentActivitySchema.shape,
  wrapToolHandler(getCurrentActivity),
);

// ========== v1.1.0 — UI tools ==========
currentCategory = "ui";

tool(
  "drag-and-drop",
  "Drag from one point to another (e.g. reorder list items). Requires ANDROID_MCP_ALLOW_WRITE=true",
  dragAndDropSchema.shape,
  wrapToolHandler(dragAndDrop),
);

tool(
  "start-screen-recording",
  "Start recording the device screen to a video file (max 180s). Recording runs in background. Requires ANDROID_MCP_ALLOW_WRITE=true",
  screenRecordStartSchema.shape,
  wrapToolHandler(screenRecordStart),
);

tool(
  "pull-screen-recording",
  "Pull a screen recording file from the device to local filesystem",
  screenRecordPullSchema.shape,
  wrapToolHandler(screenRecordPull),
);

// ========== v1.1.0 — System tools ==========
currentCategory = "system";

tool(
  "get-setting",
  "Read an Android system setting value from system/secure/global namespace",
  getSettingSchema.shape,
  wrapToolHandler(getSetting),
);

tool(
  "set-display-size",
  "Override display resolution (wm size). Omit width/height to reset to default. Requires ANDROID_MCP_ALLOW_WRITE=true",
  setDisplaySizeSchema.shape,
  wrapToolHandler(setDisplaySize),
);

tool(
  "set-display-density",
  "Override display density in DPI (wm density). Omit dpi to reset to default. Requires ANDROID_MCP_ALLOW_WRITE=true",
  setDisplayDensitySchema.shape,
  wrapToolHandler(setDisplayDensity),
);

tool(
  "keep-screen-on",
  "Keep the device screen on while charging (prevents screen timeout). Requires ANDROID_MCP_ALLOW_WRITE=true",
  keepScreenOnSchema.shape,
  wrapToolHandler(keepScreenOn),
);

tool(
  "port-forward",
  "Forward a host port to a device port (adb forward). Useful for connecting to app servers. Requires ANDROID_MCP_ALLOW_WRITE=true",
  portForwardSchema.shape,
  wrapToolHandler(portForward),
);

tool(
  "reverse-forward",
  "Reverse forward a device port to a host port (adb reverse). Lets device access host services. Requires ANDROID_MCP_ALLOW_WRITE=true",
  reverseForwardSchema.shape,
  wrapToolHandler(reverseForward),
);

tool(
  "list-forwards",
  "List all active port forwards and reverse forwards",
  listForwardsSchema.shape,
  wrapToolHandler(listForwards),
);

tool(
  "remove-forward",
  "Remove a specific port forward or all forwards/reverses. Requires ANDROID_MCP_ALLOW_WRITE=true",
  removeForwardSchema.shape,
  wrapToolHandler(removeForward),
);

// ========== v1.3.0 — Enhanced UI tools ==========
currentCategory = "ui";

tool(
  "take-annotated-screenshot",
  "Capture screenshot + interactive element map with numbered indexes. Use tap-element with the index to interact. Solves coordinate accuracy issues",
  takeAnnotatedScreenshotSchema.shape,
  wrapImageToolHandler(takeAnnotatedScreenshot),
);

tool(
  "tap-element",
  "Tap an interactive element by its index number from dump-ui-hierarchy or take-annotated-screenshot. More reliable than coordinate-based tap. Requires ANDROID_MCP_ALLOW_WRITE=true",
  tapElementSchema.shape,
  wrapToolHandler(tapElement),
);

// ========== v1.2.0 — App tools ==========
currentCategory = "apps";

tool(
  "is-app-installed",
  "Check if an app is installed on the device (returns boolean)",
  isAppInstalledSchema.shape,
  wrapToolHandler(isAppInstalled),
);

tool(
  "get-app-intents",
  "Discover intent actions and deep links supported by an app",
  getAppIntentsSchema.shape,
  wrapToolHandler(getAppIntents),
);

// ========== v1.2.0 — UI tools ==========
currentCategory = "ui";

tool(
  "double-tap",
  "Double tap at specific screen coordinates. Requires ANDROID_MCP_ALLOW_WRITE=true",
  doubleTapSchema.shape,
  wrapToolHandler(doubleTap),
);

// ========== v1.2.0 — Emulator tools ==========
currentCategory = "emulator";

tool(
  "save-snapshot",
  "Save the current emulator state as a named snapshot. Requires ANDROID_MCP_ALLOW_WRITE=true",
  saveSnapshotSchema.shape,
  wrapToolHandler(saveSnapshot),
);

tool(
  "delete-snapshot",
  "Delete an emulator snapshot. Requires ANDROID_MCP_ALLOW_WRITE=true",
  deleteSnapshotSchema.shape,
  wrapToolHandler(deleteSnapshot),
);

// ========== v1.2.0 — System tools ==========
currentCategory = "system";

tool(
  "toggle-wifi",
  "Enable or disable WiFi. Requires ANDROID_MCP_ALLOW_WRITE=true",
  toggleWifiSchema.shape,
  wrapToolHandler(toggleWifi),
);

tool(
  "toggle-mobile-data",
  "Enable or disable mobile data. Requires ANDROID_MCP_ALLOW_WRITE=true",
  toggleMobileDataSchema.shape,
  wrapToolHandler(toggleMobileData),
);

tool(
  "open-notification",
  "Open the notification/status bar panel. Requires ANDROID_MCP_ALLOW_WRITE=true",
  openNotificationSchema.shape,
  wrapToolHandler(openNotification),
);

tool(
  "lock-device",
  "Lock the device screen (press power button). Requires ANDROID_MCP_ALLOW_WRITE=true",
  lockDeviceSchema.shape,
  wrapToolHandler(lockDevice),
);

tool(
  "unlock-device",
  "Wake up and unlock the device. Optionally enter PIN/password. Requires ANDROID_MCP_ALLOW_WRITE=true",
  unlockDeviceSchema.shape,
  wrapToolHandler(unlockDevice),
);

tool(
  "get-orientation",
  "Get current screen orientation and auto-rotate setting",
  getOrientationSchema.shape,
  wrapToolHandler(getOrientation),
);

tool(
  "set-orientation",
  "Set screen orientation to portrait, landscape, or auto-rotate. Requires ANDROID_MCP_ALLOW_WRITE=true",
  setOrientationSchema.shape,
  wrapToolHandler(setOrientation),
);

tool(
  "list-settings",
  "List all settings in a namespace (system/secure/global)",
  listSettingsSchema.shape,
  wrapToolHandler(listSettings),
);

// ========== v1.2.0 — Debug tools ==========
currentCategory = "debug";

tool(
  "bugreport",
  "Generate a full Android bugreport zip file. Takes up to 2 minutes",
  bugreportSchema.shape,
  wrapToolHandler(bugreport),
);

tool(
  "get-mem-info",
  "Get memory usage info. Per-app (PSS, heap, views) or system summary (RAM, top consumers)",
  getMemInfoSchema.shape,
  wrapToolHandler(getMemInfo),
);

tool(
  "get-gfx-info",
  "Get GPU rendering performance: frame count, jank percentage, percentile latencies",
  getGfxInfoSchema.shape,
  wrapToolHandler(getGfxInfo),
);

tool(
  "get-cpu-info",
  "Get CPU usage info with top consuming processes",
  getCpuInfoSchema.shape,
  wrapToolHandler(getCpuInfo),
);

// ========== v1.3.0 — Doctor ==========
currentCategory = "debug";

tool(
  "doctor",
  "Check environment health: ADB, devices, ANDROID_HOME, emulator, permissions. Run this first to diagnose setup issues",
  doctorSchema.shape,
  wrapToolHandler(doctor),
);

// ========== Meta tools (always enabled) ==========
currentCategory = "meta";

tool(
  "search-tools",
  "Discover available tools by natural language query. Returns matching tool names + descriptions across all categories. Use this first to navigate the 72+ tool surface efficiently.",
  searchToolsSchema.shape,
  wrapToolHandler(searchTools),
);

// --- MCP Resources (android:// URI scheme) ---
registerResources(server);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Android MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
