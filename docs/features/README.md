# 기능별 추가 기획 (features)

이 디렉터리에는 **MVP 이후 덧붙인 기능**이나 **큰 단위로 설계를 고정한 확장**을 **날짜 접두어(`YYYY-MM-DD_`) + 제목** 파일로 둔다. 파일 탐색기·Git에서 **시간순 정렬**이 되도록 한다.

## 목록 (오래된 것 → 최근)

| 접두 날짜 | 문서 | 한 줄 설명 |
|-----------|------|------------|
| 2026-05-05 | [2026-05-05_QUICK_CAPTURE_DESIGN.md](./2026-05-05_QUICK_CAPTURE_DESIGN.md) | 빠른 캡처(인박스) 모드·플로팅 창·IPC |
| 2026-05-05 | [2026-05-05_TODO_DESIGN.md](./2026-05-05_TODO_DESIGN.md) | 일별 Todo 체크리스트·카드 표시·IPC 범위 |
| 2026-05-10 | [2026-05-10_WEEKLY_SUMMARY_CARD_DESIGN.md](./2026-05-10_WEEKLY_SUMMARY_CARD_DESIGN.md) | 시각화 탭 주간 1:1 요약 카드 |

## 규칙

- **접두 날짜**: 문서를 **처음 추가한 날**(기획 고정 시점). 이후 내용을 많이 고쳐도 파일명은 바꾸지 않는다.
- **코어 스키마·IPC 목록**처럼 저장소 전체의 단일 진실은 상위 `docs/`의 [DATA_SCHEMA.md](../DATA_SCHEMA.md), [DEVELOPMENT_GUIDE.md](../DEVELOPMENT_GUIDE.md) 등을 따른다. 여기 문서는 기능 단위 상세 설계에 집중한다.
- 루트에 남겨 둔 **짧은 포인터**(예: [QUICK_CAPTURE_DESIGN.md](../QUICK_CAPTURE_DESIGN.md), [TODO_DESIGN.md](../TODO_DESIGN.md))는 북마크 호환용이다.
