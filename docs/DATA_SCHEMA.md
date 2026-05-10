# Data Schema

이 문서는 **디스크에 저장되는 형식**의 기준이다. 코드의 타입(`src/renderer/src/types/journal.ts` 등)과 다르면 이 문서와 타입을 함께 고친다.

---

## Type

**파일:** `data/types.jsonl`  
**한 줄에 JSON 하나.** 로그당 타입은 **정확히 하나**이며, 일별 로그의 `type` 필드 값은 아래 **`typeId` 문자열과 동일**해야 한다.

```json
{"typeId":"learning","name":"학습"}
{"typeId":"development","name":"구현/개발"}
{"typeId":"design","name":"설계"}
{"typeId":"troubleshooting","name":"문제 해결"}
{"typeId":"refactoring","name":"리팩토링"}
{"typeId":"documentation","name":"문서화"}
{"typeId":"communication","name":"커뮤니케이션"}
```

---

## Category

**파일:** `data/categories.jsonl`  
**반고정 목록.** MVP에서는 UI에서 추가/삭제하지 않을 수 있지만, 파일을 직접 편집해 확장할 수 있다.

현재 저장소 예시:

```json
{"categoryId":"cat_java","name":"Java"}
{"categoryId":"cat_spring","name":"Spring"}
{"categoryId":"cat_persistence","name":"Persistence"}
{"categoryId":"cat_infrastructure","name":"Infrastructure"}
{"categoryId":"cat_ai_llm","name":"AI / LLM"}
{"categoryId":"cat_troubleshooting","name":"Troubleshooting"}
{"categoryId":"cat_architecture_documentation","name":"Architecture & Documentation"}
{"categoryId":"cat_code_quality","name":"Code Quality"}
{"categoryId":"cat_communication","name":"Communication"}
```

---

## Tag

**파일:** `data/tags.jsonl`  
**사용자 관리.** 한 줄에 JSON 하나.

```json
{"tagId":"tag_r2dbc","name":"R2DBC"}
{"tagId":"tag_spring_integration","name":"Spring Integration"}
```

---

## Daily file

**경로:** `data/daily/YYYY-MM-DD_daily.json`  
**파일명 예:** `2026-05-05_daily.json`

### 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | string | ISO 날짜 `YYYY-MM-DD`, 파일명과 일치 권장 |
| `journal` | string | 그날 한 줄 요약·회고 |
| `logs` | array | 해당 날짜의 활동 로그 목록 |
| `todos` | array | 그날의 Todo 체크리스트(`TodoItem`). 생략 시 로더가 `[]`로 보간 |

### Todo item (`todos[]`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `todoId` | string | **그 일 파일 안에서만** 유일. 권장: `todo_YYYYMMDD_###` |
| `title` | string | 항목 한 줄 제목 |
| `done` | boolean | 완료 여부 |

순서는 **배열 순서**가 기준이다.

자세한 제품·UI 범위는 [features/2026-05-05_TODO_DESIGN.md](./features/2026-05-05_TODO_DESIGN.md)를 본다.

### Log entry

| 필드 | 타입 | 설명 |
|------|------|------|
| `logId` | string | **그 일 파일 안에서만** 유일. 권장: `log_YYYYMMDD_001` 형식 |
| `type` | string | `types.jsonl`의 `typeId` 값 중 하나 |
| `categoryIds` | string[] | `categories.jsonl`의 `categoryId` 참조 |
| `tagIds` | string[] | `tags.jsonl`의 `tagId` 참조 |
| `detail` | string | 상세 설명 |

일별 JSON에는 **이름이 아니라 ID만** 넣는다 (`categoryIds`, `tagIds`). 표시용 이름은 jsonl에서 조회한다.

### 예시

```json
{
  "date": "2026-05-04",
  "journal": "오늘 Sentinel Agent 설정 구조를 정리했고, Viper 도입 가능성을 검토했다.",
  "logs": [
    {
      "logId": "log_20260504_001",
      "type": "design",
      "categoryIds": ["cat_infrastructure", "cat_architecture_documentation"],
      "tagIds": ["tag_viper", "tag_yaml"],
      "detail": "Go Agent의 config 디렉토리 구조를 Viper 기반으로 단순화하는 방향을 정리했다."
    }
  ],
  "todos": [
    { "todoId": "todo_20260504_001", "title": "설계 메모 보강", "done": false }
  ]
}
```

---

## 규칙 요약

- 일별 파일의 `logs[].type`은 **하나**만 (types 목록과 일치).
- `categoryIds`, `tagIds`는 배열; 빈 배열 허용 여부는 제품 정책으로 정하되, 필드 이름은 **`categories` / `tags`가 아니라 ID 배열**을 쓴다.
- `logId`는 **해당 일 파일 내에서 유일**해야 한다.
- `todoId`는 **해당 일 파일 내에서 유일**해야 한다.
