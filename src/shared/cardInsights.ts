/** 요약 카드용 보조 집계 — IPC 결과 타입 */

export interface CardInsightsResult {
  /**
   * `asOf` 날짜부터 거슬러 올라가며, **로그가 1건 이상인 날**만 연속으로 센다.
   * `asOf`에 로그가 없으면 0.
   */
  streak: number
  /**
   * `asOf`를 포함해 최근 35일(7×5), 오래된 날짜부터 `[0]`.
   */
  heatmap: { date: string; logCount: number }[]
}
