# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 컨텍스트입니다.

## 프로젝트 개요

`@us-all/android-mcp` — ADB 기반 Android 디바이스 관리 MCP 서버. **75 도구**로 디바이스/앱/UI/logcat/에뮬레이터/파일/시스템/디버그 영역 커버. Pure ADB (Appium / uiautomator2 의존성 없음).

- **타겟**: Android 디바이스 또는 에뮬레이터 (`adb` 필요)
- **런타임**: Node 20+, stdio transport, TypeScript strict
- **포지셔닝**: Android-only specialist. 크로스플랫폼은 [mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp)
- **표준**: [@us-all MCP Standard](https://github.com/us-all/mcp-toolkit/blob/main/STANDARD.md) 준수

## 디렉토리

```
src/
├── index.ts            # MCP 서버 + tool() 헬퍼 + 카테고리별 등록
├── config.ts           # ENV 로딩 (ANDROID_TOOLS / ANDROID_DISABLE 토글)
├── adb.ts              # execFile 기반 ADB wrapper
├── tool-registry.ts    # CATEGORIES + @us-all/mcp-toolkit
├── resources.ts        # MCP Resources (android:// URI)
└── tools/
    ├── utils.ts        # wrapToolHandler, shellEscape, validation helpers
    ├── extract-fields.ts   # toolkit re-export
    ├── device.ts apps.ts ui.ts logcat.ts emulator.ts
    ├── files.ts system.ts debug.ts shell.ts
    └── aggregations.ts # analyze-app
fixtures/test-app/      # Android Gradle 테스트 앱 (스모크용)
```

## Build & Run

```bash
pnpm install
pnpm build              # tsc → dist/
pnpm test               # vitest unit tests
pnpm smoke              # 실 디바이스 대상 스모크 (ADB 필요)
pnpm token-stats        # tools/list 토큰 측정
```

## 카테고리 (10)

`ANDROID_TOOLS=device,ui,apps,logcat` 같이 ENV로 일부만 로드.

| 카테고리 | 포함 도구 |
|---------|----------|
| `device` | list-devices, get-device-info |
| `apps` | install, uninstall, list, clear, permissions, analyze-app |
| `ui` | tap, swipe, screenshot, dump-hierarchy, find, scroll, annotated-screenshot |
| `logcat` | logcat capture, filter, crash extraction |
| `emulator` | AVD start/stop/snapshot |
| `files` | push, pull, exists, ls |
| `system` | settings, network, battery, display, locale, broadcast |
| `debug` | dumpsys, getprop, processes, doctor, mem/gfx/cpu info |
| `shell` | raw shell exec (별도 `ANDROID_MCP_ALLOW_SHELL` 게이트) |
| `meta` | search-tools (항상 활성) |

## MCP Resources (android://)

| URI | 설명 |
|-----|------|
| `android://devices` | 연결된 모든 디바이스 |
| `android://device/{serial}` | 디바이스 상세 (model/brand/version/display) |
| `android://app/{packageName}/activities` | 앱이 노출하는 액티비티 목록 (exported/launchable 플래그) |
| `android://device/{serial}/processes` | 디바이스 실행 중 프로세스 목록 |

## 설계 원칙

- **2-tier security gating**: 쓰기는 `ANDROID_MCP_ALLOW_WRITE=true`, shell exec는 `ANDROID_MCP_ALLOW_SHELL=true` 별도. 의도적 분리.
- **Pure ADB**: Appium/scrcpy/uiautomator2 같은 외부 자동화 프레임워크 의존성 0. ADB CLI만 사용.
- **shell 인자 escaping**: `shellEscape` 헬퍼로 single-quote 기반 안전 escape. injection 방지.
- **input validation**: setting key/value, package name, permission, component, action, broadcast extras 등 정규식 화이트리스트.
- **device path traversal 방지**: 절대 경로 강제 + `..` 차단 + shell metachar 차단.

## 최근 변경사항

- **v1.14.3** (2026-06-19): `take-screenshot` 이미지 변환 백엔드를 **jimp → sharp(0.35.1, libvips 8.18)** 교체. JPEG/PNG 인코딩·resize가 libvips 네이티브로 수행되어 더 빠르고 압축률이 좋음(스크린샷 base64 payload 절감). 도구 스키마·동작 동일(`format`/`quality`/`maxWidth`, png+no-resize fast-path 보존, `withoutEnlargement`로 no-upscale 유지). `jimp` dep 제거. **네이티브 dep 관리**: `pnpm.supportedArchitectures`(linux/darwin × x64/arm64 × glibc/musl)로 lockfile에 전 플랫폼 prebuilt 바이너리 기록 → Docker(`node:22-alpine`, musl) `--frozen-lockfile` 빌드가 `@img/sharp-linuxmusl-x64` 해석 가능. CI에 **`sharp-musl-smoke` 잡 추가**(Alpine 컨테이너에서 sharp 로드 + 스크린샷 테스트) — 발행 전 musl 검증 게이트. 94/94 test (darwin-arm64 로컬 검증, musl은 CI). 라이브 디바이스 미연결로 실 screencap 검증은 보류(transform 경로는 fixture PNG로 커버).
- **v1.13.5** (2026-05-17): 보안 — `pnpm.overrides`에 `fast-xml-builder ^1.1.7` 추가 (GHSA-5wm8-gmm8-39j9, high/CVSS 6.1: attribute injection bypass via quote characters). `fast-xml-parser ^5.7.x`의 transitive. 5/15 wave 미커버 신규 alert로 직접 패치. 코드 변경 0줄, 90/90 test.
- **v1.13.4** (2026-05-15): 보안 — `pnpm.overrides`에 fast-uri ^3.1.2 / hono ^4.12.18 / ip-address ^10.1.1 추가 (CVE-2026 transitive). 기존 vite/@hono/node-server overrides 보존. toolkit ^1.2.2 → ^1.2.3.
- **v1.13.3** (2026-05-15): `@us-all/mcp-toolkit ^1.2.2` 핀 업데이트 — 자동 cascade. 코드 변경 0줄.
- **v1.13.1** (2026-05-06): MCP Server Registry 발행 — `mcpName: "io.github.us-all/android"` 추가 + 루트 `server.json` (npm 패키지 + stdio transport + 7개 환경변수 메타데이터, ANDROID_MCP_ALLOW_SHELL/ALLOW_WRITE 게이트 명시). 코드 변경 0줄.
- **v1.13.0** (2026-05-05): 신규 `ui-snapshot-a11y` 도구 + 2개 워크플로우 Prompt(`anr-investigation`, `battery-drain-investigation`) 추가. `ui-snapshot-a11y`는 UIAutomator dump 기반 a11y 감사: 인터랙티브 element 중 label 없음(text & content-desc 둘 다 없음), ImageView/ImageButton에 content-desc 없음, touch target < `minTouchTargetDp`(default 48dp, Material/iOS 가이드라인) 자동 식별. labeledRatePct 계산, finding 카테고리별 카운트 + duplicate content-desc(TalkBack 혼란 원인) 별도 노출. screen density는 `wm density`로 자동 px→dp 변환. `anr-investigation` Prompt: `/data/anr/anr_*` 트레이스 + 차단 thread/락/binder/disk-on-main 휴리스틱 분류. `battery-drain-investigation` Prompt: `dumpsys batterystats|deviceidle|jobscheduler|netstats` 다중 슬라이스 → 카테고리(wakelock/jobs/network/location/foreground) 분류 + 구체적 remediation. 도구 75→76, prompts 5→7.
- **v1.12.1** (2026-05-05): `@us-all/mcp-toolkit ^1.2.1` 핀 업데이트 — 자동 cascade. 코드 변경 0줄.
- **v1.12.0** (2026-05-05): Apps SDK UI 카드 — `device-health` 도구 결과를 `_meta["openai/outputTemplate"]` 통해 ChatGPT/Apps SDK 클라이언트에서 카드로 렌더 (배터리 %, RAM 사용량, Wi-Fi 상태 + battery/memory/cpu/network 4개 sub-system grid). 새 리소스 `ui://widget/device-health.html` (`text/html+skybridge`). Claude 클라이언트는 `_meta` 무시 — non-breaking. 빌드 시 `src/ui/*.html`을 `dist/ui/`로 자동 복사.
- **v1.11.0** (2026-05-05): `startMcpServer` 채택 — toolkit v1.2.0의 런타임 헬퍼로 stdio 부트스트랩을 1줄로 교체. `MCP_TRANSPORT=http`로 Streamable HTTP transport 옵트인 가능 (기본 stdio). Bearer 인증, `/health` 엔드포인트. 기존 stdio 사용자 영향 0.
- **v1.10.4** (2026-05-05): `@us-all/mcp-toolkit ^1.2.0` 핀 업데이트 — 자동 cascade. 코드 변경 0줄.
- **v1.10.3** (2026-05-03): `serverInfo.version`이 `"1.3.0"`에 박혀있던 것을 `package.json`에서 런타임 로드. initialize handshake에서 보고하는 server version이 실제 패키지 버전과 일치.
- **v1.10.2** (2026-05-03): `@us-all/mcp-toolkit ^1.1.0` 채택 + `aggregate()` 헬퍼로 두 어그리게이션 도구(`analyze-app`, `device-health`) 마이그레이션. aggregations.ts 96→80 lines (-16). `analyze-app`은 이전엔 caveats 노출 없었음 — 추가됨. caveats 라벨 텍스트 통일 (예: `battery: ${msg}` → `battery failed: ${msg}`).
- **v1.10.1** (2026-05-03): `@us-all/mcp-toolkit ^1.0.0` 핀 업데이트. toolkit API freeze (semver 1.x 보장 시작) — 코드 변경 0줄, 72/72 테스트 통과.
- **v1.10.0** (2026-05-02): `device-health` 어그리게이션 도구 — battery + memory + cpu + network 1 call로 통합 (~7KB 응답, 4 sub-systems).
- **v1.9.0** (2026-05-02): Wave 3 Resources — `android://device/{serial}/processes`, `android://app/{packageName}/activities` 추가.
- **v1.8.0** (2026-05-02): MCP Prompts 5개 — `crash-investigation`, `memory-leak-detection`, `ui-element-locator`, `app-startup-profile`, `permission-audit`.
- **v1.7.3** (2026-05-02): Wave 1 — 56개 스키마 `.describe()` trim (54x serial 파라미터 통합). C(default extractFields)는 ADB flat-array 응답에 안 맞아 skip.
- **v1.7.2** (2026-05-02): 트랜시티브 의존성 보안 패치 — `fast-xml-parser ^5.7.0`(GHSA-gh4j-gqv2-49f6), `pnpm.overrides`로 `vite ^8.0.5`(GHSA-v2wj-q39q-566r·GHSA-p9ff-h696-f583 high) + `@hono/node-server >=1.19.13`(GHSA-92pp-h63x-v22m). 코드 변경 0줄.
- **v1.7.1** (2026-05-02): `@us-all/mcp-toolkit ^0.2.0` 채택 — 로컬 `sanitize` / `wrapToolHandler` (text) 본문 제거, `createWrapToolHandler` factory로 위임. `errorExtractors`(WriteBlockedError·ShellBlockedError → passthrough, ADB error `{code,stderr}` → structured)만 명시. `wrapImageToolHandler`는 Android 전용이라 로컬 유지.
- **v1.7.0** (2026-05-01): `@us-all/mcp-toolkit ^0.1.0` 마이그레이션 — tool-registry/extract-fields toolkit 위임. ~177 lines 절감.
- **v1.6.1**: 추가 MCP Resources (`android://app/{packageName}`).
- **v1.6.0**: `analyze-app` 어그리게이션 도구 (package info + memory).
- **v1.5.0**: MCP Resources (android:// URI) — devices, device.
- **v1.4.2**: `pnpm token-stats` + CI TOKEN_BUDGET=11000 (apt-get install android-tools-adb 추가).
- **v1.4.1**: `extractFields` auto-apply via wrapToolHandler.
- **v1.4.0**: 토큰 효율 표준 (ANDROID_TOOLS / ANDROID_DISABLE 9 카테고리 + search-tools).
- **v1.3.2**: CI publish workflow Node 22→24 (npm `promise-retry` 회피).
- **v1.3.1**: hono >=4.12.14 보안 패치.

## 알려진 이슈

- **사용량 정체**: 33일 정체 후 v1.4.x 이후 회복. 다운로드 14/주 (2026-04 기준) — 6개월 후 재평가.
- **mobile-next/mobile-mcp(1.6k★) 경쟁**: 크로스플랫폼이 차별화. 본 패키지는 Android deep + 보안 게이팅으로 niche.
- **iOS 미지원 (의도적)**: ADB-only 설계 철학. iOS는 별도 mobile-mcp 사용 권장.

## 개선 로드맵

- [x] 토큰 효율 표준 (ANDROID_TOOLS + search-tools + extractFields)
- [x] MCP Resources (android:// URI)
- [x] Aggregation 도구 (analyze-app)
- [x] @us-all/mcp-toolkit 마이그레이션
- [ ] AI element finding (자연어 → 좌표) — annotated screenshot + LLM hint 조합
- [ ] Gradle/계측 테스트 통합 (`./gradlew assembleDebug`, `am instrument`)
- [ ] 누락된 흔한 액션: clipboard read/write, GPS mock, pinch/zoom
- [ ] fixtures/test-app의 Gradle 산출물 .gitignore 처리 (저장소 비대 해소)

## 표준 가이드

`@us-all` MCP 작성 표준은 [mcp-toolkit/STANDARD.md](https://github.com/us-all/mcp-toolkit/blob/main/STANDARD.md)에 있음.
