## 개인용 파일기반, 시각화 성장기록일지 로컬 앱

### 타입 [Type]
- types.jsonl
- 고정 목록, enum으로 관리
- 시각화용 분류. 로그당 반드시 1개만을 가진다

``` json
learning (학습)
development (구현/개발)
design (설계)
troubleshooting (문제 해결)
refactoring (리팩토링)
documentation (문서화)
communication (커뮤니케이션)
```

### 대분류 [Category]
- categories.jsonl

- 종류
```
Java
Spring
Persistence
Infrastructure
AI / LLM
Troubleshooting
Architecture & Documentation
Code Quality
Communication
```

- 관리
``` json
{
    "categoryId": "cat_java",
    "name": "Java"
},
{...},
{...} ....
```

### 태그 [Tag]
- tags.jsonl

- 관리
``` json
{
  "tagId": "tag_r2dbc",
  "name": "R2DBC"
},
{...},
{...} ....
```

### 매일 기록
- 매일 기록 시 json파일 하나씩 생김 : "2026-05-04_daily.json

```
{
  "date": "2026-05-04",
  "journal": "오늘 Sentinel Agent 설정 구조를 정리했고, Viper 도입 가능성을 검토했다.",
  "logs": [
    {
        "logId": "log_14141411",
        "type": "learning",
        "categoryIds": ["cat_spring", "cat_java"],
        "tagIds": ["tag_spring_integration", "tag_sinks"],
        "detail": "상세 내용, 한 문단정도의 크기가 될 수도 있음"
    },
    {
        "logId": "log_14141412",
        "type": "troubleshooting",
        "categoryIds": ["cat_persistence", "cat_infrastructure"],
        "tagIds": ["tag_r2dbc", "tag_postgres"],
        "detail": "상세 내용, 한 문단정도의 크기가 될 수도 있음"
    }
    {
        "logId": "log_14141413",
        "type": "design",
        "categoryIds": ["cat_infrastructure", "cat_architecture_and_documentation"],
        "tagIds": ["tag_viper", "tag_yaml", "tag_env_config", "tag_config_loader"]
        "detail": "Go Agent의 config 디렉토리 구조를 Viper 기반으로 단순화하는 방향을 정리했다."
    },
    {
        "logId": "log_14141414",
        "type": "learning",
        "categoryIds": ["cat_java", "cat_spring"],
        "tagIds": ["tag_sinks", "tag_spring_integration"],
        "detail": "Sinks와 Spring Integration의 이벤트 흐름 차이를 학습했다."
    }
  ]
}
```

### 사용
- 카테고리는 UI에서 추가, 삭제는 불가하지만, jsonl 파일을 직접 수정해서 추가할 수는 있다. 고정값 방식으로 사용하되, 기록 앱 발전시켜나가면서 확장 가능성은 열어둔 상태
- 태그는 사용자가 UI에서 자유롭게 추가, 삭제 가능하다
- 데일리 로그 기록 시, 카테고리와 태그는 여러 개를 달아줄 수 있다
- 매일매일 오늘의 데일리 로그 기록을 기반으로, 시각화 페이지에서 확인 가능하도록 한다.
    - 목적1 : 개발자 성장 인스타그램 업로드용 시각화 (1:1 사이즈의 시각화)
    - 목적2 : 사용자가 오늘의 성장을 시각적으로 한눈에 확인 가능

### 시각화 UI
시각화는 이렇게 가면 좋음
인스타그램용 1:1 화면:
```
오늘의 성장 요약
2026.05.04

가장 많이 다룬 영역
Infrastructure 45%
Architecture 30%
Spring 25%

오늘의 태그
Viper / YAML / Config Loader / R2DBC

오늘의 한 줄
“설정 구조를 단순화하며 Go Agent의 제품화 가능성을 점검했다.”
```

앱 내부 시각화:
- 카테고리별 누적 막대 차트
- 날짜별 활동 히트맵
- 태그 네트워크 그래프
- 최근 7일 성장 요약
- 레이더 차트