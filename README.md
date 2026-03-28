# Android MCP Server

Android MCP server — ADB-based device management, UI automation, logcat debugging, emulator control, and more via the [Model Context Protocol](https://modelcontextprotocol.io/).

[한국어](./README_KO.md)

## Why This Server?

| Feature | Other Android MCPs | This Server |
|---------|-------------------|-------------|
| UI Automation (tap, swipe, screenshot) | ✓ | ✓ |
| UI Hierarchy (accessibility tree) | ✓ | ✓ (compact mode for token efficiency) |
| Logcat filtering & crash log extraction | — | ✓ |
| Emulator lifecycle (AVD start/stop/snapshot) | — | ✓ |
| File management (push/pull) | — | ✓ |
| System info (battery, network, settings) | — | ✓ |
| App data clear & permission management | — | ✓ |
| Screen recording (start/pull) | — | ✓ |
| Port forwarding (forward/reverse) | — | ✓ |
| Display size/density override | — | ✓ |
| Broadcast intents & deep link testing | — | ✓ |
| 2-tier security (write + shell gating) | — | ✓ |
| Pure ADB (no Appium/uiautomator2 dependency) | — | ✓ |
| TypeScript + official MCP SDK | — | ✓ |

## Quick Start

### 1. npx (recommended)

```bash
npx @us-all/android-mcp
```

### 2. Docker

```bash
docker run --rm \
  --device /dev/bus/usb \
  -e ANDROID_MCP_ALLOW_WRITE=true \
  ghcr.io/us-all/android-mcp-server:latest
```

### 3. Build from source

```bash
git clone https://github.com/us-all/android-mcp-server.git
cd android-mcp-server
pnpm install
pnpm run build
pnpm start
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANDROID_HOME` | No | auto-detect | Android SDK path |
| `ADB_PATH` | No | `adb` (PATH) | Path to ADB binary |
| `ANDROID_SERIAL` | No | auto (single device) | Target device serial number |
| `ANDROID_MCP_ALLOW_WRITE` | No | `false` | Enable write operations (install, tap, push, etc.) |
| `ANDROID_MCP_ALLOW_SHELL` | No | `false` | Enable arbitrary shell command execution |

### Read-Only Mode (default)

By default, only read operations are permitted. Write operations (`tap`, `install-app`, `push-file`, etc.) return an error unless `ANDROID_MCP_ALLOW_WRITE=true` is set. Shell command execution requires a separate `ANDROID_MCP_ALLOW_SHELL=true` flag for additional security.

### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "android": {
      "command": "npx",
      "args": ["@us-all/android-mcp"],
      "env": {
        "ANDROID_MCP_ALLOW_WRITE": "true"
      }
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "android": {
      "type": "stdio",
      "command": "npx",
      "args": ["@us-all/android-mcp"],
      "env": {
        "ANDROID_MCP_ALLOW_WRITE": "true",
        "ANDROID_MCP_ALLOW_SHELL": "true"
      }
    }
  }
}
```

Or from a local build:

```json
{
  "mcpServers": {
    "android": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/android-mcp-server",
      "env": {
        "ANDROID_MCP_ALLOW_WRITE": "true",
        "ANDROID_MCP_ALLOW_SHELL": "true"
      }
    }
  }
}
```

## Tools (52)

### Device (5)

| Tool | Description | R/W |
|------|-------------|-----|
| `list-devices` | List connected devices and emulators with status | R |
| `get-device-info` | Device model, brand, Android version, SDK, display info | R |
| `get-device-properties` | System properties via getprop (filterable by prefix) | R |
| `connect-device` | Connect to device over TCP/IP (wireless ADB) | W |
| `disconnect-device` | Disconnect TCP/IP device | W |

### Apps (12)

| Tool | Description | R/W |
|------|-------------|-----|
| `list-packages` | List installed packages (filter by name, type: all/system/3rd-party) | R |
| `get-package-info` | Package version, SDK targets, install time, permissions | R |
| `install-app` | Install APK file on device | W |
| `uninstall-app` | Uninstall app (optionally keep data) | W |
| `launch-app` | Launch app by package name (or specific activity) | W |
| `stop-app` | Force stop an app | W |
| `clear-app-data` | Clear all app data and cache (test isolation) | W |
| `grant-permission` | Grant a runtime permission (e.g. CAMERA) | W |
| `revoke-permission` | Revoke a runtime permission | W |
| `open-url` | Open URL on device browser (http/https/deep links) | W |
| `send-broadcast` | Send broadcast intent with optional extras | W |
| `get-current-activity` | Get currently visible activity and window focus | R |

### UI Automation (10)

| Tool | Description | R/W |
|------|-------------|-----|
| `take-screenshot` | Capture screen as PNG image (returned as base64) | R |
| `dump-ui-hierarchy` | Dump accessibility tree — compact mode returns interactive elements only with center coordinates for token efficiency | R |
| `tap` | Tap at (x, y) coordinates | W |
| `long-press` | Long press at (x, y) with configurable duration | W |
| `swipe` | Swipe gesture from (x1,y1) to (x2,y2) | W |
| `input-text` | Type text (special characters escaped) | W |
| `press-key` | Key event: BACK, HOME, ENTER, VOLUME_UP, etc. | W |
| `drag-and-drop` | Drag from one point to another (reorder items, etc.) | W |
| `start-screen-recording` | Start recording device screen to video file (max 180s) | W |
| `pull-screen-recording` | Pull recorded video from device to local filesystem | R |

### Logcat (4)

| Tool | Description | R/W |
|------|-------------|-----|
| `get-logcat` | Get recent logs with tag and priority filter (V/D/I/W/E/F) | R |
| `clear-logcat` | Clear logcat buffer | W |
| `search-logcat` | Search logs by text pattern (case-insensitive supported) | R |
| `get-crash-logs` | Extract crash/fatal logs, optionally filtered by package | R |

### Emulator (5)

| Tool | Description | R/W |
|------|-------------|-----|
| `list-avds` | List available Android Virtual Devices | R |
| `start-emulator` | Start AVD (supports headless mode, data wipe) | W |
| `stop-emulator` | Stop a running emulator | W |
| `list-snapshots` | List emulator snapshots | R |
| `load-snapshot` | Load an emulator snapshot | W |

### Files (4)

| Tool | Description | R/W |
|------|-------------|-----|
| `list-files` | List files on device (supports recursive) | R |
| `pull-file` | Download file from device to local filesystem | R |
| `push-file` | Upload local file to device | W |
| `delete-file` | Delete file or directory on device | W |

### System (11)

| Tool | Description | R/W |
|------|-------------|-----|
| `get-battery-info` | Battery level, charging state, temperature, health | R |
| `get-network-info` | WiFi status, IP address, connectivity details | R |
| `change-setting` | Modify system/secure/global settings | W |
| `get-setting` | Read a system setting value (system/secure/global) | R |
| `set-display-size` | Override display resolution (responsive testing) | W |
| `set-display-density` | Override display density in DPI | W |
| `keep-screen-on` | Prevent screen timeout while charging | W |
| `port-forward` | Forward host port to device port (adb forward) | W |
| `reverse-forward` | Reverse forward device port to host (adb reverse) | W |
| `list-forwards` | List all active port forwards and reverses | R |
| `remove-forward` | Remove specific or all port forwards | W |

### Shell (1)

| Tool | Description | R/W |
|------|-------------|-----|
| `execute-shell` | Execute arbitrary ADB shell command (requires `ANDROID_MCP_ALLOW_SHELL`) | W |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                 Claude / AI Client                   │
└─────────────────────┬────────────────────────────────┘
                      │ MCP Protocol (stdio)
                      ▼
┌──────────────────────────────────────────────────────┐
│           android-mcp-server (index.ts)              │
│                                                      │
│  ┌─────────┐  ┌──────────────────────────────────┐   │
│  │config.ts│  │          tools/                   │   │
│  │ ADB path│  │  device.ts  ── 5 tools           │   │
│  │ serial  │  │  apps.ts    ── 12 tools          │   │
│  │ perms   │  │  ui.ts      ── 10 tools          │   │
│  └─────────┘  │  logcat.ts  ── 4 tools           │   │
│               │  emulator.ts── 5 tools           │   │
│  ┌─────────┐  │  files.ts   ── 4 tools           │   │
│  │ adb.ts  │  │  system.ts  ── 11 tools          │   │
│  │ wrapper │  │  shell.ts   ── 1 tool            │   │
│  └─────────┘  │  utils.ts   ── error handling    │   │
│               └──────────────────────────────────┘   │
└─────────────────────┬────────────────────────────────┘
                      │ child_process (execFile)
                      ▼
┌──────────────────────────────────────────────────────┐
│              ADB (Android Debug Bridge)              │
│                                                      │
│         USB / TCP-IP / Emulator connection            │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
               Android Device
```

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5.x (strict mode, ESM)
- **MCP SDK:** @modelcontextprotocol/sdk 1.27+
- **Validation:** zod 4.x
- **XML Parser:** fast-xml-parser (UI hierarchy parsing)
- **Android:** ADB via child_process (no Appium, no uiautomator2)
- **Testing:** vitest (fork pool isolation)
- **Package Manager:** pnpm

## Security

- **Read-only by default** — All write operations blocked unless `ANDROID_MCP_ALLOW_WRITE=true`
- **Shell gating** — Arbitrary shell commands require separate `ANDROID_MCP_ALLOW_SHELL=true`
- **Error sanitization** — API keys, tokens, passwords redacted from all error outputs
- **Input validation** — All parameters validated via zod schemas before execution
- **No ambient authority** — No global state mutation; explicit device targeting via serial

## Development

```bash
pnpm install          # Install dependencies
pnpm run dev          # Watch mode (tsc --watch)
pnpm run build        # Compile TypeScript → dist/
pnpm test             # Run unit tests
pnpm start            # Run MCP server
```

### Adding a new tool

1. Define zod schema + async handler in `src/tools/<category>.ts`
2. Import and register with `server.tool()` in `src/index.ts`
3. Use `wrapToolHandler()` for consistent response formatting
4. Use `assertWriteAllowed()` for write operations
5. Run `pnpm run build && pnpm test`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT
