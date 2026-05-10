import type { AggregateRangeResult } from '../../../shared/visualization'
import type { CategoryRecord, TagRecord, TypeRecord } from '../types/journal'
import { enumerateDatesInclusive, formatWeekRangeShortKo } from '../utils/date'

type Props = {
  weekMonday: string
  weekSunday: string
  aggregate: AggregateRangeResult | null
  loading: boolean
  /** 집계 IPC 실패 시에만 설정 (일별 로드는 별도로 성공했을 수 있음) */
  aggregateError: string | null
  journalSnippets: Array<{ date: string; text: string }>
  types: TypeRecord[]
  categories: CategoryRecord[]
  tags: TagRecord[]
}

const TOP_N = 8

const WEEK_DOW_KO = ['월', '화', '수', '목', '금', '토', '일'] as const

function tagLabel(tags: TagRecord[], tagId: string): string {
  return tags.find((t) => t.tagId === tagId)?.name ?? tagId
}

function categoryLabel(categories: CategoryRecord[], categoryId: string): string {
  return categories.find((c) => c.categoryId === categoryId)?.name ?? categoryId
}

function formatDayMonthKo(iso: string): string {
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  return `${m}/${d}`
}

function rollupWeek(
  aggregate: AggregateRangeResult | null,
  from: string,
  to: string,
): {
  totalLogs: number
  daysWithLogs: number
  typeCounts: Record<string, number>
  categoryCounts: Record<string, number>
  tagCounts: Record<string, number>
} {
  const byDate = new Map((aggregate?.days ?? []).map((d) => [d.date, d]))
  let totalLogs = 0
  let daysWithLogs = 0
  const typeCounts: Record<string, number> = {}
  const categoryCounts: Record<string, number> = {}
  const tagCounts: Record<string, number> = {}

  for (const iso of enumerateDatesInclusive(from, to)) {
    const row = byDate.get(iso)
    const lc = row?.logCount ?? 0
    totalLogs += lc
    if (lc > 0) daysWithLogs++
    if (!row) continue
    for (const [k, v] of Object.entries(row.typeCounts)) {
      typeCounts[k] = (typeCounts[k] ?? 0) + v
    }
    for (const [k, v] of Object.entries(row.categoryCounts)) {
      categoryCounts[k] = (categoryCounts[k] ?? 0) + v
    }
    for (const [k, v] of Object.entries(row.tagCounts)) {
      tagCounts[k] = (tagCounts[k] ?? 0) + v
    }
  }

  return { totalLogs, daysWithLogs, typeCounts, categoryCounts, tagCounts }
}

function buildWeekHeatCells(
  aggregate: AggregateRangeResult | null,
  weekMonday: string,
  weekSunday: string,
): Array<{ date: string; dow: string; logCount: number }> {
  const map = new Map((aggregate?.days ?? []).map((d) => [d.date, d.logCount]))
  return enumerateDatesInclusive(weekMonday, weekSunday).map((iso, i) => ({
    date: iso,
    dow: WEEK_DOW_KO[i] ?? '?',
    logCount: map.get(iso) ?? 0,
  }))
}

function longestStreakInWeek(logCounts: number[]): number {
  let best = 0
  let cur = 0
  for (const n of logCounts) {
    if (n > 0) {
      cur++
      if (cur > best) best = cur
    } else {
      cur = 0
    }
  }
  return best
}

function topFromRecord(
  counts: Record<string, number>,
  limit: number,
): Array<{ id: string; n: number }> {
  return Object.entries(counts)
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id))
    .slice(0, limit)
}

/** 건수 최대, 동률 시 typeId 문자순 */
function topTypeId(typeCounts: Record<string, number>): string | null {
  const entries = Object.entries(typeCounts).filter(([, n]) => n > 0)
  if (entries.length === 0) return null
  let bestN = 0
  for (const [, n] of entries) {
    if (n > bestN) bestN = n
  }
  const atMax = entries.filter(([, n]) => n === bestN).map(([id]) => id)
  atMax.sort((a, b) => a.localeCompare(b))
  return atMax[0] ?? null
}

export default function WeeklySummaryCard({
  weekMonday,
  weekSunday,
  aggregate,
  loading,
  aggregateError,
  journalSnippets,
  types,
  categories,
  tags,
}: Props) {
  const rolled = rollupWeek(aggregate, weekMonday, weekSunday)
  const { totalLogs, daysWithLogs, typeCounts, categoryCounts, tagCounts } = rolled
  const categoryTop = topFromRecord(categoryCounts, TOP_N)
  const tagTop = topFromRecord(tagCounts, TOP_N)
  const dominantTypeId = topTypeId(typeCounts)
  const dominantTypeName =
    dominantTypeId != null ? types.find((t) => t.typeId === dominantTypeId)?.name ?? dominantTypeId : null

  const rangeLabel = formatWeekRangeShortKo(weekMonday, weekSunday)
  const heatCells = buildWeekHeatCells(aggregate, weekMonday, weekSunday)
  const heatMax = Math.max(1, ...heatCells.map((c) => c.logCount))
  const weekStreak = longestStreakInWeek(heatCells.map((c) => c.logCount))

  const showEmptyCopy =
    !loading && totalLogs === 0 && journalSnippets.length === 0 && !aggregateError

  return (
    <article className="summary-card summary-card--weekly" aria-label={`주간 요약 카드 ${rangeLabel}`}>
      <header className="summary-card-zone summary-card-zone--brand">
        <div className="summary-card-brand-row">
          <p className="summary-card-date summary-card-date--week">{rangeLabel}</p>
          <div className="summary-card-brand-product">
            <span className="summary-card-brand-title">Daily Recorder for Engineers</span>
            <span className="summary-card-brand-version" aria-label={`앱 버전 ${import.meta.env.VITE_APP_VERSION}`}>
              v{import.meta.env.VITE_APP_VERSION}
            </span>
          </div>
        </div>
        <p className="summary-card-week-sub">Weekly snapshot</p>
      </header>

      <div className="summary-card-mid summary-card-mid--weekly">
        {aggregateError ? (
          <p className="weekly-summary-aggregate-error" role="alert" title={aggregateError}>
            주간 집계를 불러오지 못했습니다. 차트·히트맵은 비어 있을 수 있습니다.
          </p>
        ) : null}

        {loading ? (
          <p className="summary-card-muted weekly-summary-loading">주간 데이터 불러오는 중…</p>
        ) : showEmptyCopy ? (
          <p className="summary-card-placeholder weekly-summary-empty">이번 주 기록이 없습니다.</p>
        ) : totalLogs > 0 ? (
          <div className="weekly-summary-stats" aria-label="주간 요약 지표">
            <p className="weekly-summary-stats-line">
              이번 주 활동 <strong>{totalLogs}</strong>건 · 기록 <strong>{daysWithLogs}</strong>일
              {dominantTypeName ? (
                <>
                  {' '}
                  · 많이 한 유형 <strong>{dominantTypeName}</strong>
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <p className="summary-card-muted weekly-summary-soft">
            {aggregateError
              ? '집계에 실패했습니다. 유형·태그는 비어 있을 수 있습니다.'
              : '이번 주 활동 로그는 없습니다. 한 줄 요약만 아래에 보일 수 있습니다.'}
          </p>
        )}

        {!loading ? (
          <div
            className="weekly-heat-row"
            role="img"
            aria-label="이번 주 월요일부터 일요일까지 날짜별 로그 건수"
          >
            {heatCells.map((c) => {
              const t = c.logCount / heatMax
              const bg =
                c.logCount === 0
                  ? 'rgba(127, 127, 127, 0.12)'
                  : `rgba(100, 108, 255, ${0.14 + t * 0.62})`
              return (
                <div key={c.date} className="weekly-heat-cell-wrap">
                  <span className="weekly-heat-dow">{c.dow}</span>
                  <span
                    className="weekly-heat-cell"
                    style={{ backgroundColor: bg }}
                    title={`${c.date}: 로그 ${c.logCount}건`}
                  />
                  <span className="weekly-heat-n">{c.logCount > 0 ? c.logCount : '·'}</span>
                </div>
              )
            })}
          </div>
        ) : null}

        {!loading && weekStreak >= 2 && totalLogs > 0 ? (
          <p className="weekly-summary-streak-line" title="월~일 순서로 로그가 있는 날을 연속으로 셉니다">
            이번 주 연속 기록 <strong>{weekStreak}</strong>일
          </p>
        ) : null}

        {!loading && journalSnippets.length > 0 ? (
          <ul className="weekly-journal-snips" aria-label="한 줄 요약 스니펫">
            {journalSnippets.map(({ date, text }) => (
              <li key={date} className="weekly-journal-snip">
                <span className="weekly-journal-snip-date">{formatDayMonthKo(date)}</span>
                <span className="weekly-journal-snip-text">{text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <section
        className="summary-card-zone summary-card-zone--meta summary-card-meta-stack summary-card-type-category"
        aria-label="유형별 로그 수"
      >
        <p className="summary-card-log-count-line">유형별 (이번 주)</p>

        {types.length > 0 ? (
          <ul className="summary-card-type-chips summary-card-type-chips--all" aria-label="유형별 로그 수">
            {types.map((row) => {
              const n = typeCounts[row.typeId] ?? 0
              const empty = n === 0
              return (
                <li
                  key={row.typeId}
                  className={`summary-chip summary-chip-type${empty ? ' summary-chip-type--empty' : ''}`}
                >
                  {empty ? row.name : (
                    <>
                      {row.name} ×{n}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <footer
        className={`summary-card-zone summary-card-zone--tags summary-card-footer-tags summary-card-footer-tags-stack${categoryTop.length === 0 && tagTop.length === 0 ? ' summary-card-footer-tags--empty' : ''}`}
        aria-label="카테고리와 태그"
      >
        {categoryTop.length > 0 ? (
          <ul className="summary-card-category-chips summary-card-footer-chip-row" aria-label="카테고리">
            {categoryTop.map(({ id: categoryId, n }) => (
              <li key={categoryId} className="summary-chip summary-chip-category summary-chip-footer-compact">
                {categoryLabel(categories, categoryId)}
                {n > 1 ? <span className="summary-chip-count">{n}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {tagTop.length > 0 ? (
          <ul className="summary-card-tag-chips summary-card-footer-chip-row" aria-label="태그">
            {tagTop.map(({ id: tagId, n }) => (
              <li key={tagId} className="summary-chip summary-chip-tag summary-chip-tag-compact">
                {tagLabel(tags, tagId)}
                {n > 1 ? <span className="summary-chip-count">{n}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </footer>
    </article>
  )
}
