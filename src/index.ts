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
} from "./tools/system.js";

// --- Server setup ---

await validateConfig();

const server = new McpServer({
  name: "android-mcp-server",
  version: "1.1.0",
});

// ========== Device tools ==========

server.tool(
  "list-devices",
  "List all connected Android devices and emulators with their status and details",
  listDevicesSchema.shape,
  wrapToolHandler(listDevices),
);

server.tool(
  "get-device-info",
  "Get detailed device information including model, brand, Android version, SDK version, display density and size",
  getDeviceInfoSchema.shape,
  wrapToolHandler(getDeviceInfo),
);

server.tool(
  "get-device-properties",
  "Get Android system properties (getprop). Optionally filter by prefix like 'ro.build' or 'ro.product'",
  getDevicePropertiesSchema.shape,
  wrapToolHandler(getDeviceProperties),
);

server.tool(
  "connect-device",
  "Connect to a device over TCP/IP (wireless ADB). Requires ANDROID_MCP_ALLOW_WRITE=true",
  connectDeviceSchema.shape,
  wrapToolHandler(connectDevice),
);

server.tool(
  "disconnect-device",
  "Disconnect a TCP/IP device or all TCP/IP devices. Requires ANDROID_MCP_ALLOW_WRITE=true",
  disconnectDeviceSchema.shape,
  wrapToolHandler(disconnectDevice),
);

// ========== App tools ==========

server.tool(
  "list-packages",
  "List installed packages on the device. Filter by name or type (all, system, third-party)",
  listPackagesSchema.shape,
  wrapToolHandler(listPackages),
);

server.tool(
  "get-package-info",
  "Get detailed package info: version, SDK targets, install time, permissions",
  getPackageInfoSchema.shape,
  wrapToolHandler(getPackageInfo),
);

server.tool(
  "install-app",
  "Install an APK file on the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  installAppSchema.shape,
  wrapToolHandler(installApp),
);

server.tool(
  "uninstall-app",
  "Uninstall an app from the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  uninstallAppSchema.shape,
  wrapToolHandler(uninstallApp),
);

server.tool(
  "launch-app",
  "Launch an app by package name. Optionally specify activity. Requires ANDROID_MCP_ALLOW_WRITE=true",
  launchAppSchema.shape,
  wrapToolHandler(launchApp),
);

server.tool(
  "stop-app",
  "Force stop an app by package name. Requires ANDROID_MCP_ALLOW_WRITE=true",
  stopAppSchema.shape,
  wrapToolHandler(stopApp),
);

// ========== UI tools ==========

server.tool(
  "take-screenshot",
  "Capture a screenshot of the device screen. Returns a PNG image",
  takeScreenshotSchema.shape,
  wrapImageToolHandler(takeScreenshot),
);

server.tool(
  "dump-ui-hierarchy",
  "Dump the UI accessibility tree. Compact mode (default) returns only interactive elements with coordinates for token efficiency",
  dumpUiHierarchySchema.shape,
  wrapToolHandler(dumpUiHierarchy),
);

server.tool(
  "tap",
  "Tap at specific screen coordinates. Requires ANDROID_MCP_ALLOW_WRITE=true",
  tapSchema.shape,
  wrapToolHandler(tap),
);

server.tool(
  "long-press",
  "Long press at specific screen coordinates. Requires ANDROID_MCP_ALLOW_WRITE=true",
  longPressSchema.shape,
  wrapToolHandler(longPress),
);

server.tool(
  "swipe",
  "Swipe from one point to another. Requires ANDROID_MCP_ALLOW_WRITE=true",
  swipeSchema.shape,
  wrapToolHandler(swipe),
);

server.tool(
  "input-text",
  "Type text on the device. Focus an input field first using tap. Requires ANDROID_MCP_ALLOW_WRITE=true",
  inputTextSchema.shape,
  wrapToolHandler(inputText),
);

server.tool(
  "press-key",
  "Press a key event (BACK, HOME, ENTER, VOLUME_UP, etc). Requires ANDROID_MCP_ALLOW_WRITE=true",
  pressKeySchema.shape,
  wrapToolHandler(pressKey),
);

// ========== Logcat tools ==========

server.tool(
  "get-logcat",
  "Get recent logcat output. Filter by tag, priority level, and number of lines",
  getLogcatSchema.shape,
  wrapToolHandler(getLogcat),
);

server.tool(
  "clear-logcat",
  "Clear the logcat buffer. Requires ANDROID_MCP_ALLOW_WRITE=true",
  clearLogcatSchema.shape,
  wrapToolHandler(clearLogcat),
);

server.tool(
  "search-logcat",
  "Search logcat for a text pattern. Supports case-sensitive and case-insensitive search",
  searchLogcatSchema.shape,
  wrapToolHandler(searchLogcat),
);

server.tool(
  "get-crash-logs",
  "Get crash logs from the device. Optionally filter by package name",
  getCrashLogsSchema.shape,
  wrapToolHandler(getCrashLogs),
);

// ========== Emulator tools ==========

server.tool(
  "list-avds",
  "List available Android Virtual Devices (AVDs) that can be started",
  listAvdsSchema.shape,
  wrapToolHandler(listAvds),
);

server.tool(
  "start-emulator",
  "Start an Android emulator by AVD name. Supports headless mode and data wipe. Requires ANDROID_MCP_ALLOW_WRITE=true",
  startEmulatorSchema.shape,
  wrapToolHandler(startEmulator),
);

server.tool(
  "stop-emulator",
  "Stop a running Android emulator. Requires ANDROID_MCP_ALLOW_WRITE=true",
  stopEmulatorSchema.shape,
  wrapToolHandler(stopEmulator),
);

server.tool(
  "list-snapshots",
  "List available emulator snapshots",
  listSnapshotsSchema.shape,
  wrapToolHandler(listSnapshots),
);

server.tool(
  "load-snapshot",
  "Load an emulator snapshot. Requires ANDROID_MCP_ALLOW_WRITE=true",
  loadSnapshotSchema.shape,
  wrapToolHandler(loadSnapshot),
);

// ========== File tools ==========

server.tool(
  "list-files",
  "List files on the device at a given path. Supports recursive listing",
  listFilesSchema.shape,
  wrapToolHandler(listFiles),
);

server.tool(
  "pull-file",
  "Pull (download) a file from the device to local filesystem",
  pullFileSchema.shape,
  wrapToolHandler(pullFile),
);

server.tool(
  "push-file",
  "Push (upload) a local file to the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  pushFileSchema.shape,
  wrapToolHandler(pushFile),
);

server.tool(
  "delete-file",
  "Delete a file or directory on the device. Requires ANDROID_MCP_ALLOW_WRITE=true",
  deleteFileSchema.shape,
  wrapToolHandler(deleteFile),
);

// ========== Shell tools ==========

server.tool(
  "execute-shell",
  "Execute an arbitrary ADB shell command. Requires ANDROID_MCP_ALLOW_SHELL=true (separate from write permission for security)",
  executeShellSchema.shape,
  wrapToolHandler(executeShell),
);

// ========== System tools ==========

server.tool(
  "get-battery-info",
  "Get battery status including level, charging state, temperature, and health",
  getBatteryInfoSchema.shape,
  wrapToolHandler(getBatteryInfo),
);

server.tool(
  "get-network-info",
  "Get network information including WiFi status, IP address, and connectivity details",
  getNetworkInfoSchema.shape,
  wrapToolHandler(getNetworkInfo),
);

server.tool(
  "change-setting",
  "Change an Android system setting (system/secure/global namespace). Requires ANDROID_MCP_ALLOW_WRITE=true",
  changeSettingSchema.shape,
  wrapToolHandler(changeSetting),
);

// ========== v1.1.0 — App tools ==========

server.tool(
  "clear-app-data",
  "Clear all data and cache for an app (equivalent to factory reset for the app). Requires ANDROID_MCP_ALLOW_WRITE=true",
  clearAppDataSchema.shape,
  wrapToolHandler(clearAppData),
);

server.tool(
  "grant-permission",
  "Grant a runtime permission to an app. Example: android.permission.CAMERA. Requires ANDROID_MCP_ALLOW_WRITE=true",
  grantPermissionSchema.shape,
  wrapToolHandler(grantPermission),
);

server.tool(
  "revoke-permission",
  "Revoke a runtime permission from an app. Requires ANDROID_MCP_ALLOW_WRITE=true",
  revokePermissionSchema.shape,
  wrapToolHandler(revokePermission),
);

server.tool(
  "open-url",
  "Open a URL on the device browser. Supports http/https and deep link URIs. Requires ANDROID_MCP_ALLOW_WRITE=true",
  openUrlSchema.shape,
  wrapToolHandler(openUrl),
);

server.tool(
  "send-broadcast",
  "Send a broadcast intent with optional extras. Example action: 'android.intent.action.BOOT_COMPLETED'. Requires ANDROID_MCP_ALLOW_WRITE=true",
  sendBroadcastSchema.shape,
  wrapToolHandler(sendBroadcast),
);

server.tool(
  "get-current-activity",
  "Get the currently visible (resumed) activity and window focus information",
  getCurrentActivitySchema.shape,
  wrapToolHandler(getCurrentActivity),
);

// ========== v1.1.0 — UI tools ==========

server.tool(
  "drag-and-drop",
  "Drag from one point to another (e.g. reorder list items). Requires ANDROID_MCP_ALLOW_WRITE=true",
  dragAndDropSchema.shape,
  wrapToolHandler(dragAndDrop),
);

server.tool(
  "start-screen-recording",
  "Start recording the device screen to a video file (max 180s). Recording runs in background. Requires ANDROID_MCP_ALLOW_WRITE=true",
  screenRecordStartSchema.shape,
  wrapToolHandler(screenRecordStart),
);

server.tool(
  "pull-screen-recording",
  "Pull a screen recording file from the device to local filesystem",
  screenRecordPullSchema.shape,
  wrapToolHandler(screenRecordPull),
);

// ========== v1.1.0 — System tools ==========

server.tool(
  "get-setting",
  "Read an Android system setting value from system/secure/global namespace",
  getSettingSchema.shape,
  wrapToolHandler(getSetting),
);

server.tool(
  "set-display-size",
  "Override display resolution (wm size). Omit width/height to reset to default. Requires ANDROID_MCP_ALLOW_WRITE=true",
  setDisplaySizeSchema.shape,
  wrapToolHandler(setDisplaySize),
);

server.tool(
  "set-display-density",
  "Override display density in DPI (wm density). Omit dpi to reset to default. Requires ANDROID_MCP_ALLOW_WRITE=true",
  setDisplayDensitySchema.shape,
  wrapToolHandler(setDisplayDensity),
);

server.tool(
  "keep-screen-on",
  "Keep the device screen on while charging (prevents screen timeout). Requires ANDROID_MCP_ALLOW_WRITE=true",
  keepScreenOnSchema.shape,
  wrapToolHandler(keepScreenOn),
);

server.tool(
  "port-forward",
  "Forward a host port to a device port (adb forward). Useful for connecting to app servers. Requires ANDROID_MCP_ALLOW_WRITE=true",
  portForwardSchema.shape,
  wrapToolHandler(portForward),
);

server.tool(
  "reverse-forward",
  "Reverse forward a device port to a host port (adb reverse). Lets device access host services. Requires ANDROID_MCP_ALLOW_WRITE=true",
  reverseForwardSchema.shape,
  wrapToolHandler(reverseForward),
);

server.tool(
  "list-forwards",
  "List all active port forwards and reverse forwards",
  listForwardsSchema.shape,
  wrapToolHandler(listForwards),
);

server.tool(
  "remove-forward",
  "Remove a specific port forward or all forwards/reverses. Requires ANDROID_MCP_ALLOW_WRITE=true",
  removeForwardSchema.shape,
  wrapToolHandler(removeForward),
);

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
