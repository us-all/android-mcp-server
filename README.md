# Android MCP Server

> **The Android diagnostic & forensic MCP — when an app crashes, leaks memory, drains battery, or behaves unexpectedly, this is what you point at the device.**
>
> 75 tools across logcat / dumpsys / package internals / system properties / processes. 5 MCP Prompts (crash-investigation, memory-leak-detection, permission-audit, app-startup-profile, ui-element-locator) and a `device-health` aggregation. Pure ADB, no Appium / uiautomator2 dependency. 2-tier security (write + shell gates).

[![npm](https://img.shields.io/npm/v/@us-all/android-mcp)](https://www.npmjs.com/package/@us-all/android-mcp)
[![downloads](https://img.shields.io/npm/dm/@us-all/android-mcp)](https://www.npmjs.com/package/@us-all/android-mcp)
[![tools](https://img.shields.io/badge/tools-75-blue)](#tools)
[![@us-all standard](https://img.shields.io/badge/built%20to-%40us--all%20MCP%20standard-blue)](https://github.com/us-all/mcp-toolkit/blob/main/STANDARD.md)

## What it does that others don't

- **Diagnostic depth** — logcat search/crash extraction, `dumpsys` (mem/gfx/cpu), getprop, processes, package internals, app intents, port forwards. Cross-platform competitors hide this surface.
- **MCP Prompts** (5) — `crash-investigation`, `memory-leak-detection`, `ui-element-locator`, `app-startup-profile`, `permission-audit`. Workflow templates the model invokes directly.
- **Aggregation tools** — `device-health` (battery + memory + cpu + network in one call), `analyze-app` (package info + memory + activities).
- **2-tier security** — `ANDROID_MCP_ALLOW_WRITE` (gates installs/taps/pushes) and `ANDROID_MCP_ALLOW_SHELL` (gates arbitrary `adb shell`) are separate flags. Distinct trust levels.
- **Pure ADB** — no Appium, no uiautomator2, no Python bridge. Just the official Android Debug Bridge wrapped over `child_process`.
- **Token-efficient by design** — 56 schema-trim sweep, `ANDROID_TOOLS`/`ANDROID_DISABLE` 9 categories, `search-tools` meta.

## Try this — 5 prompts

Connect the server to Claude Desktop or Claude Code, then paste any of these:

1. **Crash investigation** — *"My app `com.us-all.api` keeps crashing on this Pixel 6 emulator. Pull the last crash log, the offending stack frames, and any recent permission changes."*
2. **Memory leak detection** — *"Trace memory growth for `com.us-all.api` over the last 5 minutes. Show heap deltas, GC pressure, and the largest allocators."*
3. **Battery drain attribution** — *"What's draining battery on this device? Top 5 consumers, duration of each, and current battery health."*
4. **Permission audit** — *"Audit installed 3rd-party apps for dangerous permissions (location/camera/contacts/microphone). Flag any app that hasn't been used in the last 30 days but holds these."*
5. **App startup profile** — *"Profile the cold-start of `com.us-all.api` — measure activity launch time, identify the slowest fragment init, and suggest where to add tracing."*

## When to use this vs mobile-next/mobile-mcp

[`mobile-next/mobile-mcp`](https://github.com/mobile-next/mobile-mcp) (4.7K★) is the cross-platform action-oriented MCP. Different problem space:

| | mobile-mcp | `@us-all/android-mcp` (this) |
|--|---|---|
| Platform | iOS + Android (cross-platform) | Android only (specialist) |
| Posture | Action-oriented ("drive the app via NL") | Diagnostic ("tell me why it broke") |
| UI surface | Accessibility-tree-first, action loops | UI hierarchy + screenshots + diagnostic dumps |
| Diagnostic depth | minimal | logcat / dumpsys / getprop / processes / crashes |
| Aggregations | — | `device-health`, `analyze-app` |
| MCP Prompts | — | 5 (diagnostic-themed) |
| Security gates | basic | 2-tier (write + shell separate) |
| Distribution | broad (12+ IDE buttons) | npm + Docker |

**Use both — they're complementary.** mobile-mcp drives the device through your QA flows; this MCP tells you why it broke when something does. Especially:
- mobile-mcp finds the bug via UI exploration → this MCP captures the crash log + heap dump.
- mobile-mcp can't tell you why startup is slow → this MCP gives you `dumpsys gfxinfo` + activity launch timing.
- mobile-mcp can't reproduce a permission denial → this MCP shows the exact `dumpsys package` permission state and recent grants.

## Install

### Claude Desktop

```json
{
  "mcpServers": {
    "android": {
      "command": "npx",
      "args": ["-y", "@us-all/android-mcp"],
      "env": {
        "ANDROID_MCP_ALLOW_WRITE": "true"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add android -s user \
  -e ANDROID_MCP_ALLOW_WRITE=true \
  -e ANDROID_MCP_ALLOW_SHELL=true \
  -- npx -y @us-all/android-mcp
```

### Docker

```bash
docker run --rm \
  --device /dev/bus/usb \
  -e ANDROID_MCP_ALLOW_WRITE=true \
  ghcr.io/us-all/android-mcp-server:latest
```

### Build from source

```bash
git clone https://github.com/us-all/android-mcp-server.git
cd android-mcp-server && pnpm install && pnpm build
node dist/index.js
```

### Prerequisites

- ADB installed and on `PATH` (or set `ADB_PATH`)
- Android device or emulator with USB debugging enabled
- For multi-device setups: `ANDROID_SERIAL=<serial>` to target a specific one

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANDROID_HOME` | ❌ | auto-detect | Android SDK path |
| `ADB_PATH` | ❌ | `adb` (PATH) | Path to ADB binary |
| `ANDROID_SERIAL` | ❌ | auto (single device) | Target device serial |
| `ANDROID_MCP_ALLOW_WRITE` | ❌ | `false` | Enable write operations (install, tap, push) |
| `ANDROID_MCP_ALLOW_SHELL` | ❌ | `false` | Enable arbitrary `adb shell` execution |
| `ANDROID_TOOLS` | ❌ | — | Comma-sep allowlist of categories. Biggest token saver. |
| `ANDROID_DISABLE` | ❌ | — | Comma-sep denylist. Ignored when `ANDROID_TOOLS` is set. |

**Categories** (9): `device`, `apps`, `ui`, `logcat`, `emulator`, `files`, `system`, `debug`, `shell` (always-gated by `ANDROID_MCP_ALLOW_SHELL`), plus always-on `meta`.

### Token efficiency

| Scenario | Tools | Schema tokens | vs default |
|----------|------:|--------------:|-----------:|
| default (all categories) | 75 | 9,200 | — |
| typical (`ANDROID_TOOLS=device,ui,apps,logcat`) | 37 | 5,000 | −46% |
| narrow (`ANDROID_TOOLS=device,ui`) | 19 | **2,500** | **−73%** |

Plus `search-tools` meta-tool (always enabled) for runtime tool discovery.

### Read-only mode (default)

By default, only read operations are permitted. Write operations (`tap`, `install-app`, `push-file`, etc.) return an error unless `ANDROID_MCP_ALLOW_WRITE=true`. Shell command execution requires a **separate** `ANDROID_MCP_ALLOW_SHELL=true` for additional security — even with write enabled, raw shell stays blocked unless this is explicitly set.

## MCP Prompts (5)

Workflow templates available via MCP `prompts/list`:

- `crash-investigation` — pull crash logs + stack frames + recent permission changes for a target package.
- `memory-leak-detection` — track heap delta over a window; cluster by allocator.
- `ui-element-locator` — find a UI element by visual + accessibility hints; return tap coordinates.
- `app-startup-profile` — cold-start profile: activity launch + fragment init + first frame.
- `permission-audit` — flag dangerous permissions held by under-used 3rd-party apps.

## MCP Resources

URI-based read-only entities:

- `android://devices` — connected devices
- `android://device/{serial}` — device details (model/brand/version/display)
- `android://app/{packageName}/activities` — activities exposed by a package (exported/launchable flags)
- `android://device/{serial}/processes` — running processes

## Tools (75)

9 categories. Use `search-tools` to discover at runtime; full list collapsed below.

| Category | Tools |
|----------|------:|
| System (battery / network / settings / display / orientation / port-fwd / wifi / mobile-data) | 19 |
| Apps (install / launch / permissions / intents / data clear) | 14 |
| UI (tap / swipe / screenshot / hierarchy / annotated tap-by-index / screen recording) | 13 |
| Emulator (AVD start/stop, snapshot mgmt) | 7 |
| Device (list / info / properties / wireless connect) | 5 |
| Debug (bugreport / mem / gfx / cpu / doctor) | 5 |
| Logcat (capture / filter / clear / crash extract) | 4 |
| Files (list / pull / push / delete) | 4 |
| Shell (gated `execute-shell`) | 1 |
| Aggregations (`device-health`, `analyze-app`) | 2 |
| Meta (`search-tools`) | 1 |

<details>
<summary>Full tool list</summary>

### Device (5)
`list-devices`, `get-device-info`, `get-device-properties`, `connect-device`, `disconnect-device`

### Apps (14)
`list-packages`, `get-package-info`, `install-app`, `uninstall-app`, `launch-app`, `stop-app`, `clear-app-data`, `grant-permission`, `revoke-permission`, `open-url`, `send-broadcast`, `get-current-activity`, `is-app-installed`, `get-app-intents`

### UI Automation (13)
`take-screenshot`, `dump-ui-hierarchy`, `tap`, `long-press`, `swipe`, `input-text`, `press-key`, `drag-and-drop`, `start-screen-recording`, `pull-screen-recording`, `double-tap`, `take-annotated-screenshot`, `tap-element`

### Logcat (4)
`get-logcat`, `clear-logcat`, `search-logcat`, `get-crash-logs`

### Emulator (7)
`list-avds`, `start-emulator`, `stop-emulator`, `list-snapshots`, `load-snapshot`, `save-snapshot`, `delete-snapshot`

### Files (4)
`list-files`, `pull-file`, `push-file`, `delete-file`

### System (19)
`get-battery-info`, `get-network-info`, `change-setting`, `get-setting`, `set-display-size`, `set-display-density`, `keep-screen-on`, `port-forward`, `reverse-forward`, `list-forwards`, `remove-forward`, `toggle-wifi`, `toggle-mobile-data`, `open-notification`, `lock-device`, `unlock-device`, `get-orientation`, `set-orientation`, `list-settings`

### Debug (5)
`bugreport`, `get-mem-info`, `get-gfx-info`, `get-cpu-info`, `doctor`

### Shell (1)
`execute-shell` — gated by `ANDROID_MCP_ALLOW_SHELL`

### Aggregations
`device-health` — battery + memory + cpu + network in one call (~7KB response, 4 sub-systems with caveats).
`analyze-app` — package info + memory + activities aggregation.

### Meta
`search-tools` — query other tools by keyword; always enabled.

</details>

## Architecture

```
Claude → MCP stdio → src/index.ts
                      ├── adb.ts (execFile wrapper)
                      ├── tools/utils.ts (wrapToolHandler, shellEscape, validation)
                      └── tools/{device,apps,ui,logcat,emulator,files,system,debug,shell,aggregations}.ts
                                  ↓
                          ADB CLI (USB / TCP-IP / Emulator)
                                  ↓
                          Android Device
```

Built on [`@us-all/mcp-toolkit`](https://github.com/us-all/mcp-toolkit):
- `extractFields` — token-efficient response projections (skipped for ADB flat-array endpoints)
- `aggregate(fetchers, caveats)` — fan-out helper for `device-health` / `analyze-app`
- `createWrapToolHandler` — `WriteBlockedError`/`ShellBlockedError` passthrough + structured ADB errors (`{code, stderr}`)
- `wrapImageToolHandler` (Android-only) — base64 PNG sanitization
- `search-tools` meta-tool

## Security

- **Read-only by default.** Writes blocked without `ANDROID_MCP_ALLOW_WRITE=true`.
- **Shell gating separate.** `execute-shell` blocked without `ANDROID_MCP_ALLOW_SHELL=true` even with write enabled — distinct trust levels.
- **Shell injection safe.** `shellEscape` for single-quote-based escape; input validation via zod regex whitelists for setting keys, package names, permissions, components, broadcast actions/extras.
- **Path-traversal blocked.** Device paths require absolute + no `..` + no shell metachars.
- **Error sanitization.** API keys, tokens, passwords redacted from all error outputs.

## Tech stack

Node.js 20+ • TypeScript strict ESM • pnpm • `@modelcontextprotocol/sdk` 1.27+ • zod v4 • fast-xml-parser • vitest (fork pool isolation).

## License

[MIT](./LICENSE)
