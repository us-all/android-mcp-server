# Roadmap

## v1.0.0 (Released)
- 35 tools across 8 categories
- Device, Apps, UI Automation, Logcat, Emulator, Files, System, Shell

## v1.1.0 (Current)
- **17 new tools** → 52 total
- App data clear, permission grant/revoke
- Current activity detection, broadcast intents, URL open
- Drag-and-drop, screen recording (start/pull)
- Settings read, display size/density override
- Keep screen on, port forwarding (forward/reverse/list/remove)

## v1.2.0 (Planned)

### Tier 1 remaining
- [ ] WiFi/mobile data toggle (`svc wifi/data enable/disable`)
- [ ] Notification panel open/close (`cmd statusbar`)
- [ ] Device lock/unlock
- [ ] Double-tap gesture
- [ ] Bugreport generation (`adb bugreport`)
- [ ] App installed check (boolean)
- [ ] Emulator snapshot save/delete
- [ ] Clipboard read/write
- [ ] Screen orientation get/set
- [ ] Settings list (dump all settings in namespace)

### Tier 2
- [ ] Scroll-to-element (scroll until target visible)
- [ ] Pinch/zoom gesture
- [ ] Performance profiling (meminfo, gfxinfo, cpuinfo dedicated tools)
- [ ] Screenshot compression (JPEG option for token savings)
- [ ] GPS location mocking
- [ ] AVD creation/provisioning
- [ ] Environment health check (`doctor` command)
- [ ] Intent/deep-link discovery per package
- [ ] Content provider query (`content query/insert/update/delete`)
- [ ] Background app (send to background for N seconds)

## v2.0.0 (Future)

### Build integration
- [ ] Gradle build (debug/release APK)
- [ ] Run unit tests (local JVM)
- [ ] Run instrumented tests (`am instrument`)
- [ ] List Gradle modules/variants/tasks

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
