# Roadmap

## v1.0.0 (Released)
- 35 tools across 8 categories
- Device, Apps, UI Automation, Logcat, Emulator, Files, System, Shell

## v1.1.0 (Released)
- **17 new tools** → 52 total
- App data clear, permission grant/revoke
- Current activity detection, broadcast intents, URL open
- Drag-and-drop, screen recording (start/pull)
- Settings read, display size/density override
- Keep screen on, port forwarding (forward/reverse/list/remove)

## v1.2.0 (Released)
- **17 new tools** → 69 total
- [x] WiFi/mobile data toggle
- [x] Notification panel open
- [x] Device lock/unlock
- [x] Double-tap gesture
- [x] Bugreport generation
- [x] App installed check (boolean)
- [x] Emulator snapshot save/delete
- [x] Screen orientation get/set
- [x] Settings list (dump all settings in namespace)
- [x] Intent/deep-link discovery per package
- [x] Performance profiling (meminfo, gfxinfo, cpuinfo)

## Current (v1.13.x)
- 76 tools across 9 filterable categories plus always-on meta discovery
- Node.js 22+ / pnpm 10 / `@modelcontextprotocol/sdk` 1.29+

## v2.0.0 (Future)

### Build integration
- [ ] Gradle build (debug/release APK)
- [ ] Run unit tests (local JVM)
- [ ] Run instrumented tests (`am instrument`)
- [ ] List Gradle modules/variants/tasks

### More tools
- [ ] Clipboard read/write
- [ ] Scroll-to-element (scroll until target visible)
- [ ] Pinch/zoom gesture
- [ ] Screenshot compression (JPEG option for token savings)
- [ ] GPS location mocking
- [ ] AVD creation/provisioning
- [ ] Environment health check (`doctor` command)
- [ ] Content provider query (`content query/insert/update/delete`)
- [ ] Background app (send to background for N seconds)

### Advanced features
- [ ] Progressive disclosure (summaries first, details on demand)
- [ ] WebView context switching (native ↔ web)
- [ ] Multi-touch gestures (raw motion events)
- [ ] AI-powered element finding (natural language)
- [ ] Test code generation
- [ ] System trace (`atrace`) capture
- [ ] Method profiling (`am profile`)
- [ ] Heap dump (`am dumpheap`)

## Feature sources
- ADB official documentation
- [mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp) — cross-platform, accessibility-first
- [appium/appium-mcp](https://github.com/appium/appium-mcp) — test automation, AI element finding
- [thecombatwombat/replicant-mcp](https://github.com/thecombatwombat/replicant-mcp) — developer workflow, Gradle
- [minhalvp/android-mcp-server](https://github.com/minhalvp/android-mcp-server) — intent discovery
