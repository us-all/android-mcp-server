# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-05-01

### Added

- **`analyze-app` aggregation tool** — package info + memory usage in a single call. Replaces 2-3 round-trips.

## [1.5.0] - 2026-05-01

### Added

- **MCP Resources (`android://` URI scheme)** — `android://devices` (list), `android://device/{serial}` (detail).

## [1.4.2] - 2026-05-01

### Added

- `pnpm token-stats` script + CI regression guard with `TOKEN_BUDGET=11000`.

## [1.4.1] - 2026-05-01

### Added

- **`extractFields` auto-apply** via `wrapToolHandler`.

## [1.4.0] - 2026-05-01

### Added

- **Token efficiency standard** (cross-repo with openmetadata-mcp v1.3.0, datadog-mcp v1.9.0, google-drive-mcp v1.5.0, mlflow-mcp v1.3.0, unifi-mcp v1.2.0):
  - `ANDROID_TOOLS` / `ANDROID_DISABLE` env vars: 9 categories (device, apps, ui, logcat, emulator, files, system, debug, shell).
  - `search-tools` meta-tool.
  - `extractFields` helper.
- `tests/tool-registry.test.ts` (4 cases).

### Changed

- Total tools: 72 → 73.

## [1.3.2] - 2026-05-01

### Fixed

- npm publish workflow Node 22 → 24 to avoid `promise-retry` MODULE_NOT_FOUND on `npm install -g npm@latest`.

## [1.3.1] - 2026-05-01

### Security

- Pin transitive `hono >=4.12.14` via `pnpm.overrides` to address [GHSA-458j-xx4x-4375](https://github.com/advisories/GHSA-458j-xx4x-4375).

## [1.3.0] - 2026-03-28

### Added

- v1.3.0: Annotated screenshot, element tap by index, `doctor` environment diagnostics.
- Total tools: 69 → 72.

## [1.2.0] - 2026-03-28

### Added

- 17 tools: emulator AVD lifecycle (start/stop/snapshot), debug helpers (memory, GPU, CPU), enhanced UI tools.
- Total tools: 52 → 69.

## [1.1.0] - 2026-03-28

### Added

- 17 tools: app management v2, UI hierarchy compact mode, system settings, broadcast intents, deep link testing.
- Total tools: 35 → 52.

## [1.0.0] - 2026-03-28

### Added

- Initial release with **35 tools** for ADB-based Android device management.
- Categories: device, apps, ui, logcat, emulator, files, system, debug, shell.
- 2-tier security gating: `ANDROID_MCP_ALLOW_WRITE` and `ANDROID_MCP_ALLOW_SHELL`.
- Pure ADB (no Appium/uiautomator2 dependency).
- TypeScript + official MCP SDK.
