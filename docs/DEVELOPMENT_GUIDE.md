# Development Guide

## 아키텍처 개요

이 프로젝트는 **electron-vite**로 묶인 Electron 앱이다.

- **Main:** `src/main/index.ts` — 창 생성, IPC, Node `fs`로 `data/` 읽기·쓰기
- **Preload:** `src/preload/index.ts` — `contextBridge`로 렌더러에 안전한 API만 노출
- **Renderer:** `src/renderer/src/` — React UI만; **파일 시스템 직접 접근 금지**

### 올바른 데이터 흐름

```text
React (renderer)
  → preload에서 노출한 API (예: window.*)
  → ipcRenderer.invoke / send
  → main에서 ipcMain 핸들러
  → fs / path (프로젝트 루트 기준 `data/` 경로 결합)
  → JSON / JSONL 읽기·쓰기
```

렌더러에서 `fs`, `path`, `electron` 직접 import 하여 파일을 건드리면 안 된다.

---

## 디렉터리 구조 (요약)

```text
daily_recorder_for_engineers/
├── .cursor/rules/project.mdc    # Cursor 에이전트 규칙
├── docs/                         # 사람·AI 공통 참고 문서
├── data/
│   ├── types.jsonl
│   ├── categories.jsonl
│   ├── tags.jsonl
│   └── daily/YYYY-MM-DD_daily.json
├── public/                       # 정적 자산 (renderer 빌드에서 사용)
├── src/
│   ├── main/index.ts
│   ├── preload/index.ts
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── pages/           # DailyPage, VisualizePage 등
│           ├── components/
│           ├── types/journal.ts
│           └── services/        # preload API 호출 래퍼 (journalApi 등)
├── electron.vite.config.ts
└── package.json
```

빌드 산출물은 **`out/`**, 패키징 결과는 **`release/`** — Git에 포함하지 않는다.

---

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | electron-vite 개발 모드 |
| `npm run build` | `out/`에 main·preload·renderer 번들 |
| `npm run release` | 빌드 후 electron-builder (설치 패키지; 로컬 환경에 따라 추가 설정 필요할 수 있음) |

---

## Main에서 구현할 파일 작업 (체크리스트)

IPC 이름은 프로젝트에서 일관되게 정한다. 예시 역할:

| 역할 | 설명 |
|------|------|
| `readTypes` | `data/types.jsonl` 파싱 → 배열 |
| `readCategories` | `data/categories.jsonl` 파싱 |
| `readTags` | `data/tags.jsonl` 파싱 |
| `createTag` / `updateTag` / `deleteTag` | 태그 JSONL 갱신 |
| `readDaily` | `data/daily/{date}_daily.json` 읽기; 없으면 null 또는 빈 템플릿 |
| `saveDaily` | 일별 JSON 원자적 저장(임시 파일 후 rename 권장) |

정확한 채널 이름과 페이로드 타입은 구현 시 `preload`와 쌍을 맞춘다.

---

## UI 페이지 (MVP)

| 페이지 | 역할 |
|--------|------|
| **DailyPage** | 오늘(또는 선택일) 저널·로그 편집, 타입/카테고리/태그 선택, 저장, **일별 Todo 체크리스트(`todos`)** |
| **VisualizePage** | 차트·1:1 카드 등 시각화(카드에 **같은 날 `todos` 요약** 표시 가능) |

일별 Todo 데이터 모델·UI 범위는 [TODO_DESIGN.md](./TODO_DESIGN.md)를 본다.

설정 전용 **SettingsPage**는 태그 관리를 별 화면으로 빼고 싶을 때 추가할 수 있다. MVP에서는 Daily 흐름 안에서 태그 CRUD를 넣어도 된다.

---

## 컴포넌트 가이드

- 폼·목록·차트는 **작은 컴포넌트**로 분리한다.
- **파일 I/O나 IPC 호출**은 페이지/서비스 레이어(`services/journalApi.ts` 등)에 모으고, dumb UI는 props만 받는다.
- 차트 라이브러리 도입 시 시리즈·축 데이터만 넘기고, 원시 파일 내용은 main 쪽 집계 결과만 받는 식으로 유지한다.

---

## Cursor에서 작업 요청할 때

규칙과 스키마를 함께 참조시키면 된다.

```text
@docs/PROJECT_OVERVIEW.md @docs/DATA_SCHEMA.md @docs/DEVELOPMENT_GUIDE.md @.cursor/rules/project.mdc
를 기준으로 DailyPage MVP를 구현해줘.
renderer는 fs 금지, preload/main IPC로 data/ 접근.
```
