/**
 * 빠른 캡처 창 — 콘텐츠 크기·Electron 경계의 단일 기준.
 * 숫자를 바꿀 때는 여기만 수정하고, 아래 소비처가 같은 값을 쓰는지 확인한다.
 *
 * - `QuickCapturePage.tsx` → `setCaptureContentSize`
 * - `main/index.ts` → `BrowserWindow` 초기 크기·min/max, IPC `CAPTURE_SET_CONTENT_SIZE` clamp
 * - `App.css` (quick-capture) → `--qc-collapsed-px` 주석과 동일 값 유지
 */
export const QUICK_CAPTURE_LAYOUT = {
  /** 접힘: 정사각 핸들 한 변(px) */
  collapsedEdgePx: 35,
  /** 펼침 콘텐츠(px): 좌 입력 / 우 할 일 1:1, 높이는 헤더·두 열·버튼 줄 */
  expandedContentWidth: 760,
  expandedContentHeight: 340,
  minContentEdge: 22,
  maxContentWidth: 900,
  maxContentHeight: 720,
} as const
