# Test Fixtures

## mcp-test-app.apk

Pre-built test app for validating MCP server tools. **Not included in the npm package.**

### Features

- **Tap button** — updates status text, verifiable via UI hierarchy
- **Counter button** — incremental counter, tests repeated tap
- **Checkbox / Toggle** — tests check state changes
- **Text input** — tests input-text tool
- **Camera permission request** — tests grant-permission / revoke-permission
- **Deep link** (`mcptest://open?page=...`) — tests open-url with custom scheme
- **Broadcast sender** — tests send-broadcast
- **Crash button** — triggers intentional NPE for get-crash-logs testing
- **Scrollable items** — tests swipe/scroll gestures

### Package Info

- Package: `com.mcp.testapp`
- Activity: `.MainActivity`
- Min SDK: 24
- Target SDK: 35

### Build from source

```bash
cd fixtures/test-app
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../mcp-test-app.apk
```

### MCP test example

```javascript
// Install
await call("install-app", { apkPath: "fixtures/mcp-test-app.apk" });

// Launch
await call("launch-app", { packageName: "com.mcp.testapp", activity: ".MainActivity" });

// Deep link
await call("open-url", { url: "mcptest://open?page=test" });

// Uninstall
await call("uninstall-app", { packageName: "com.mcp.testapp" });
```
