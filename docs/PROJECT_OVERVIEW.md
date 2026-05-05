# Daily Recorder for Engineers

## 목적

**개인용·로컬 전용** 데스크톱 앱이다. DB 없이 **`data/` 아래 JSON·JSONL**만으로 매일의 개발 활동을 남기고, 유형(Type)·대분류(Category)·태그(Tag) 기준으로 성장을 돌아본다.

레포 디렉터리 이름은 `daily_recorder_for_engineers`이며, 제품 컨셉은 “파일 기반 성장 기록 일지”이다.

## 주요 목표

1. 매일 회고와 활동 로그를 한 파일에 구조적으로 저장
2. 카테고리·태그·타입으로 필터링·집계 가능한 데이터 유지
3. 시각화 페이지에서 오늘·기간별 성장을 한눈에 확인
4. **인스타그램 업로드용 1:1** 성장 요약 카드 생성
5. 추후 태그 네트워크·온톨로지 등 확장 가능한 형태 유지

## 핵심 개념

| 개념 | 역할 |
|------|------|
| **Type** | 활동의 성격(학습/설계/트러블슈팅 등). 로그당 **정확히 1개** |
| **Category** | 성장 영역(Java/Spring/Infrastructure 등). 로그당 **여러 개** 가능 |
| **Tag** | 세부 기술·주제(R2DBC, Viper 등). 로그당 **여러 개**, 사용자가 관리 |
| **Daily** | 하루 단위 파일 하나(`YYYY-MM-DD_daily.json`)에 일일 요약(`journal`) + 로그 배열(`logs`) |
| **Todo (일별)** | 같은 Daily 파일의 **`todos` 배열**로 그날 체크리스트 관리; 요약 카드에도 표시 가능 |

일별 Todo 필드·ID 규칙·UI 방향은 [TODO_DESIGN.md](./TODO_DESIGN.md), 저장 형식은 [DATA_SCHEMA.md](./DATA_SCHEMA.md)를 본다.

## MVP 범위와 제약

- **MVP에는 DB를 도입하지 않는다.** 로컬 파일만 사용한다.
- 카테고리는 MVP에서 UI로 추가/삭제하지 않을 수 있으나, **`categories.jsonl`을 직접 수정**해 확장하는 것은 허용한다.
- 태그는 사용자가 UI에서 자유롭게 추가·삭제한다(설계는 `docs/daily.md`와 동일).

## 관련 문서

| 문서 | 용도 |
|------|------|
| [DATA_SCHEMA.md](./DATA_SCHEMA.md) | 필드·파일 경로·예시 JSON |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Electron 레이어·IPC·구현 순서 |
| [TODO_DESIGN.md](./TODO_DESIGN.md) | 일별 Todo 체크리스트·카드 표시 설계 |
| [daily.md](./daily.md) | 초기 설계 메모(시각화 목업 등) |
