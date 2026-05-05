# 일별 Todo 체크리스트 설계

## 목적

- **Daily 탭**에서 그날 할 일을 체크리스트로 추가·삭제·완료 토글·순서 조정(구현 범위는 MVP에서 정의).
- **같은 데이터**를 **1:1 요약 카드**에도 표시해, 하루의 “할 일 달성”이 카드에서도 읽힌다.
- **저장 위치**는 기존과 같이 **일별 JSON 한 파일**에만 둔다(별도 DB·별도 파일 없음).

---

## 데이터 모델

### 위치

- **파일:** `data/daily/YYYY-MM-DD_daily.json` (기존 Daily와 동일)
- **필드명:** `todos` (복수형, 배열)

### 항목 타입: `TodoItem`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `todoId` | string | 예 | **해당 일 파일 안에서만** 유일. 권장: `todo_YYYYMMDD_###` (`###`는 그 날 파일 내 일련번호). |
| `title` | string | 예 | 체크리스트에 보이는 한 줄 텍스트(공백만인 문자열은 UI에서 막거나 저장 전 트림 정책으로 처리). |
| `done` | boolean | 예 | 완료 여부 |

### 일별 파일 (`DailyJournalFile`)

- `todos`: **`TodoItem[]`**
- **구 파일 호환:** 과거에 `todos` 키가 없던 JSON은 로드 시 **`todos: []`로 보간**한다.

### 순서

- **표시·저장 순서**는 **배열 순서**가 기준이다(첫 번째 항목이 리스트 맨 위).
- 명시적 `order` 필드는 두지 않는다(MVP). 필요 시 후속 버전에서 추가 가능.

### 예시

```json
{
  "date": "2026-05-05",
  "journal": "문서 정리와 리팩토링 마무리.",
  "logs": [],
  "todos": [
    { "todoId": "todo_20260505_001", "title": "IPC 에러 핸들링 보강", "done": false },
    { "todoId": "todo_20260505_002", "title": "요약 카드 PNG 확인", "done": true }
  ]
}
```

---

## IPC·저장

- **새 채널 불필요.** 기존 `readDaily` / `saveDaily` 페이로드에 `todos`가 포함되면 된다.
- Main은 `DailyJournalFile` 검증 시 `todos`가 없으면 허용하고, 응답 전 **`todos`를 정규화**한다.

---

## UI 범위 (구현 시 참고)

### Daily 탭

- 섹션 제목 예: **오늘의 할 일** / **Todo**
- 항목 추가(텍스트 입력 + 추가 버튼), 체크 토글, 삭제.
- 순서: MVP에는 **위/아래 이동 버튼** 또는 **드래그** 중 하나로 정의(설계 단계에서는 “배열 순서 유지”만 고정).
- 일별 저장 흐름은 기존 **저장** 버튼과 동일하게 `saveDaily` 호출.

### 1:1 요약 카드 (`DailySummaryCard`)

- 해당 일 `todos`가 있으면 구역을 하나 두고:
  - 완료 수 / 전체 수 요약(예: `2/5`) 또는
  - 제목 줄여서 체크 상태와 함께 리스트(공간에 맞게 줄 수 제한).
- `todos`가 빈 배열이면 카드에서 해당 블록 숨김 또는 “할 일 없음” 한 줄은 **제품 정책으로 선택**.

---

## 비목표 (이번 설계에서 다루지 않음)

- 마감일·반복·우선순위 필드
- 프로젝트 간 공유·동기화
- 다른 날짜로 할 일 이관

---

## 구현 체크리스트 (코드 작업 시)

1. `src/shared/journal.ts` — `TodoItem`, `DailyJournalFile.todos`
2. `docs/DATA_SCHEMA.md` — 동일 내용 반영(이 문서와 단일 진실 유지)
3. Main — `emptyDaily`에 `todos: []`, 로드 시 누락 보간, `saveDaily` 검증
4. Renderer — DailyPage UI, 카드 컴포넌트, ID 생성 유틸(`todo_YYYYMMDD_###`)

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [DATA_SCHEMA.md](./DATA_SCHEMA.md) | 필드 표·예시 JSON |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | IPC·페이지 역할 |
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | 제품 범위 요약 |
