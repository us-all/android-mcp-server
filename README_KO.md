# Android MCP Server

ADB 기반 Android 디바이스 관리, UI 자동화, logcat 디버깅, 에뮬레이터 제어 등을 제공하는 [Model Context Protocol](https://modelcontextprotocol.io/) 서버입니다.

[English](./README.md)

## 왜 이 서버인가?

| 기능 | 기존 Android MCP | 이 서버 |
|------|-----------------|---------|
| UI 자동화 (탭, 스와이프, 스크린샷) | ✓ | ✓ |
| UI 계층 구조 (접근성 트리) | ✓ | ✓ (토큰 절약 compact 모드) |
| Logcat 필터링 & 크래시 로그 추출 | — | ✓ |
| 에뮬레이터 라이프사이클 (AVD 시작/중지/스냅샷) | — | ✓ |
| 파일 관리 (push/pull) | — | ✓ |
| 시스템 정보 (배터리, 네트워크, 설정) | — | ✓ |
| 앱 데이터 초기화 & 권한 관리 | — | ✓ |
| 화면 녹화 (시작/가져오기) | — | ✓ |
| 포트 포워딩 (forward/reverse) | — | ✓ |
| 디스플레이 크기/밀도 변경 | — | ✓ |
| 브로드캐스트 인텐트 & 딥링크 테스트 | — | ✓ |
| 2단계 보안 (쓰기 + 셸 게이팅) | — | ✓ |
| 순수 ADB (Appium/uiautomator2 불필요) | — | ✓ |
| TypeScript + 공식 MCP SDK | — | ✓ |

## 빠른 시작

### 1. npx (권장)

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

### 3. 소스에서 빌드

```bash
git clone https://github.com/us-all/android-mcp-server.git
cd android-mcp-server
pnpm install
pnpm run build
pnpm start
```

## 설정

### 환경 변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `ANDROID_HOME` | No | 자동 탐지 | Android SDK 경로 |
| `ADB_PATH` | No | `adb` (PATH) | ADB 바이너리 경로 |
| `ANDROID_SERIAL` | No | 자동 (단일 기기) | 대상 디바이스 시리얼 번호 |
| `ANDROID_MCP_ALLOW_WRITE` | No | `false` | 쓰기 작업 허용 (설치, 탭, 파일 전송 등) |
| `ANDROID_MCP_ALLOW_SHELL` | No | `false` | 임의 셸 명령 실행 허용 |

### 읽기 전용 모드 (기본)

기본적으로 읽기 작업만 허용됩니다. 쓰기 작업(`tap`, `install-app`, `push-file` 등)은 `ANDROID_MCP_ALLOW_WRITE=true` 설정 없이는 오류를 반환합니다. 셸 명령 실행은 추가 보안을 위해 별도의 `ANDROID_MCP_ALLOW_SHELL=true` 플래그가 필요합니다.

### Claude Desktop

Claude Desktop 설정에 추가:

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

프로젝트의 `.mcp.json`에 추가:

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

## 도구 (69)

### 디바이스 (5)

| 도구 | 설명 | R/W |
|------|------|-----|
| `list-devices` | 연결된 디바이스 및 에뮬레이터 목록 조회 | R |
| `get-device-info` | 디바이스 모델, 브랜드, Android 버전, SDK, 디스플레이 정보 | R |
| `get-device-properties` | getprop 시스템 속성 조회 (접두사 필터 가능) | R |
| `connect-device` | TCP/IP (무선 ADB) 디바이스 연결 | W |
| `disconnect-device` | TCP/IP 디바이스 연결 해제 | W |

### 앱 관리 (14)

| 도구 | 설명 | R/W |
|------|------|-----|
| `list-packages` | 설치된 패키지 목록 (이름, 타입별 필터: all/system/3rd-party) | R |
| `get-package-info` | 패키지 버전, SDK 타겟, 설치 시간, 권한 정보 | R |
| `install-app` | APK 파일 설치 | W |
| `uninstall-app` | 앱 삭제 (데이터 유지 옵션) | W |
| `launch-app` | 패키지명으로 앱 실행 (특정 액티비티 지정 가능) | W |
| `stop-app` | 앱 강제 종료 | W |
| `clear-app-data` | 앱 데이터/캐시 전체 초기화 (테스트 격리) | W |
| `grant-permission` | 런타임 권한 부여 (예: CAMERA) | W |
| `revoke-permission` | 런타임 권한 해제 | W |
| `open-url` | 디바이스에서 URL 열기 (http/https/딥링크) | W |
| `send-broadcast` | 브로드캐스트 인텐트 전송 (옵션 extras 지원) | W |
| `get-current-activity` | 현재 표시 중인 액티비티 및 윈도우 포커스 확인 | R |
| `is-app-installed` | 앱 설치 여부 확인 (boolean) | R |
| `get-app-intents` | 앱의 인텐트 액션 및 딥링크 탐색 | R |

### UI 자동화 (11)

| 도구 | 설명 | R/W |
|------|------|-----|
| `take-screenshot` | 화면 스크린샷 캡처 (PNG, base64 반환) | R |
| `dump-ui-hierarchy` | 접근성 트리 덤프 — compact 모드는 인터랙티브 요소만 중심 좌표와 함께 반환 | R |
| `tap` | (x, y) 좌표 탭 | W |
| `long-press` | (x, y) 좌표 롱프레스 (지속 시간 설정 가능) | W |
| `swipe` | (x1,y1)에서 (x2,y2)로 스와이프 제스처 | W |
| `input-text` | 텍스트 입력 (특수 문자 이스케이프) | W |
| `press-key` | 키 이벤트: BACK, HOME, ENTER, VOLUME_UP 등 | W |
| `drag-and-drop` | 한 지점에서 다른 지점으로 드래그 (리스트 정렬 등) | W |
| `start-screen-recording` | 디바이스 화면 녹화 시작 (최대 180초) | W |
| `pull-screen-recording` | 녹화된 영상을 로컬로 가져오기 | R |
| `double-tap` | 화면 좌표에 더블 탭 | W |

### Logcat (4)

| 도구 | 설명 | R/W |
|------|------|-----|
| `get-logcat` | 태그 및 우선순위 필터로 최근 로그 조회 (V/D/I/W/E/F) | R |
| `clear-logcat` | logcat 버퍼 초기화 | W |
| `search-logcat` | 텍스트 패턴으로 로그 검색 (대소문자 구분 옵션) | R |
| `get-crash-logs` | 크래시/Fatal 로그 추출 (패키지별 필터 가능) | R |

### 에뮬레이터 (7)

| 도구 | 설명 | R/W |
|------|------|-----|
| `list-avds` | 사용 가능한 Android Virtual Device 목록 | R |
| `start-emulator` | AVD 실행 (헤드리스 모드, 데이터 초기화 지원) | W |
| `stop-emulator` | 실행 중인 에뮬레이터 종료 | W |
| `list-snapshots` | 에뮬레이터 스냅샷 목록 | R |
| `load-snapshot` | 에뮬레이터 스냅샷 로드 | W |
| `save-snapshot` | 현재 에뮬레이터 상태를 스냅샷으로 저장 | W |
| `delete-snapshot` | 에뮬레이터 스냅샷 삭제 | W |

### 파일 (4)

| 도구 | 설명 | R/W |
|------|------|-----|
| `list-files` | 디바이스 파일 목록 (재귀 옵션) | R |
| `pull-file` | 디바이스에서 로컬로 파일 다운로드 | R |
| `push-file` | 로컬 파일을 디바이스로 업로드 | W |
| `delete-file` | 디바이스 파일/디렉토리 삭제 | W |

### 시스템 (19)

| 도구 | 설명 | R/W |
|------|------|-----|
| `get-battery-info` | 배터리 잔량, 충전 상태, 온도, 건강 상태 | R |
| `get-network-info` | WiFi 상태, IP 주소, 연결 정보 | R |
| `change-setting` | 시스템/보안/글로벌 설정 변경 | W |
| `get-setting` | 시스템 설정 값 읽기 (system/secure/global) | R |
| `set-display-size` | 디스플레이 해상도 변경 (반응형 테스트) | W |
| `set-display-density` | 디스플레이 밀도(DPI) 변경 | W |
| `keep-screen-on` | 충전 중 화면 꺼짐 방지 | W |
| `port-forward` | 호스트 포트를 디바이스 포트로 포워딩 (adb forward) | W |
| `reverse-forward` | 디바이스 포트를 호스트 포트로 역포워딩 (adb reverse) | W |
| `list-forwards` | 활성 포트 포워드/리버스 목록 | R |
| `remove-forward` | 특정 또는 전체 포트 포워드 제거 | W |
| `toggle-wifi` | WiFi 활성화/비활성화 | W |
| `toggle-mobile-data` | 모바일 데이터 활성화/비활성화 | W |
| `open-notification` | 알림/상태 바 패널 열기 | W |
| `lock-device` | 디바이스 화면 잠금 | W |
| `unlock-device` | 디바이스 깨우기 및 잠금 해제 (PIN 옵션) | W |
| `get-orientation` | 화면 방향 및 자동 회전 설정 확인 | R |
| `set-orientation` | 화면 방향 설정: portrait, landscape, auto | W |
| `list-settings` | 네임스페이스의 전체 설정 목록 | R |

### 디버그 (4)

| 도구 | 설명 | R/W |
|------|------|-----|
| `bugreport` | Android 버그리포트 zip 생성 (최대 2분) | R |
| `get-mem-info` | 메모리 사용량: 앱별 PSS/힙 또는 시스템 요약 | R |
| `get-gfx-info` | GPU 렌더링: 프레임 수, 버벅임 비율, 지연 백분위 | R |
| `get-cpu-info` | CPU 사용량 및 상위 프로세스 | R |

### 셸 (1)

| 도구 | 설명 | R/W |
|------|------|-----|
| `execute-shell` | 임의 ADB 셸 명령 실행 (`ANDROID_MCP_ALLOW_SHELL` 필요) | W |

## 아키텍처

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
│  │ ADB 경로│  │  device.ts  ── 5 tools           │   │
│  │ 시리얼  │  │  apps.ts    ── 14 tools          │   │
│  │ 권한    │  │  ui.ts      ── 11 tools          │   │
│  └─────────┘  │  logcat.ts  ── 4 tools           │   │
│               │  emulator.ts── 7 tools           │   │
│  ┌─────────┐  │  files.ts   ── 4 tools           │   │
│  │ adb.ts  │  │  system.ts  ── 19 tools          │   │
│  │ 래퍼    │  │  debug.ts   ── 4 tools           │   │
│  │         │  │  shell.ts   ── 1 tool            │   │
│  └─────────┘  │  utils.ts   ── 에러 핸들링       │   │
│               └──────────────────────────────────┘   │
└─────────────────────┬────────────────────────────────┘
                      │ child_process (execFile)
                      ▼
┌──────────────────────────────────────────────────────┐
│              ADB (Android Debug Bridge)              │
│                                                      │
│         USB / TCP-IP / 에뮬레이터 연결               │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
               Android 디바이스
```

## 기술 스택

- **런타임:** Node.js 20+
- **언어:** TypeScript 5.x (strict mode, ESM)
- **MCP SDK:** @modelcontextprotocol/sdk 1.27+
- **검증:** zod 4.x
- **XML 파서:** fast-xml-parser (UI 계층 구조 파싱)
- **Android:** ADB via child_process (Appium, uiautomator2 불필요)
- **테스트:** vitest (fork pool 격리)
- **패키지 매니저:** pnpm

## 보안

- **기본 읽기 전용** — 모든 쓰기 작업은 `ANDROID_MCP_ALLOW_WRITE=true` 없이 차단
- **셸 게이팅** — 임의 셸 명령은 별도 `ANDROID_MCP_ALLOW_SHELL=true` 필요
- **에러 살균** — API 키, 토큰, 비밀번호가 모든 에러 출력에서 제거
- **입력 검증** — 모든 파라미터를 zod 스키마로 실행 전 검증
- **명시적 대상** — 전역 상태 변경 없이 시리얼로 명시적 디바이스 지정

## 개발

```bash
pnpm install          # 의존성 설치
pnpm run dev          # 감시 모드 (tsc --watch)
pnpm run build        # TypeScript 컴파일 → dist/
pnpm test             # 단위 테스트 실행
pnpm start            # MCP 서버 실행
```

## 기여

개발 가이드라인은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참조하세요.

## 라이선스

MIT
