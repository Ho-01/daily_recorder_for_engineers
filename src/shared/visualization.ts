/** 기간 집계 IPC 페이로드 — docs와 함께 유지 */

export interface DayAggregateRow {
  date: string
  logCount: number
  /** typeId -> 해당 일 로그 수 */
  typeCounts: Record<string, number>
  categoryCounts: Record<string, number>
  tagCounts: Record<string, number>
}

export interface AggregateRangeResult {
  days: DayAggregateRow[]
}
