import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CardInsightsResult } from '../../../shared/cardInsights'
import type { CategoryRecord, DailyJournalFile, LogEntry, TagRecord, TypeRecord } from '../types/journal'
import { formatDateLongKo } from '../utils/date'

type Props = {
  daily: DailyJournalFile
  types: TypeRecord[]
  categories: CategoryRecord[]
  tags: TagRecord[]
  insights: CardInsightsResult | null
  insightsPending: boolean
}

function isoYearMonth(iso: string): string {
  return iso.slice(0, 7)
}

/** 카드 날짜(`daily.date`)와 같은 달이면 true — 히트맵 칸 색 구분용 */
function isSameMonthAsCard(cellIso: string, cardIso: string): boolean {
  return isoYearMonth(cellIso) === isoYearMonth(cardIso)
}

function tagLabel(tags: TagRecord[], tagId: string): string {
  return tags.find((t) => t.tagId === tagId)?.name ?? tagId
}

function categoryLabel(categories: CategoryRecord[], categoryId: string): string {
  return categories.find((c) => c.categoryId === categoryId)?.name ?? categoryId
}

function countTypes(logs: LogEntry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const log of logs) {
    m.set(log.type, (m.get(log.type) ?? 0) + 1)
  }
  return m
}

function topCategoriesByFrequency(logs: LogEntry[], limit: number): Array<{ categoryId: string; n: number }> {
  const freq = new Map<string, number>()
  for (const log of logs) {
    for (const id of log.categoryIds) {
      freq.set(id, (freq.get(id) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .map(([categoryId, n]) => ({ categoryId, n }))
    .sort((a, b) => b.n - a.n || a.categoryId.localeCompare(b.categoryId))
    .slice(0, limit)
}

function topTagsByFrequency(logs: LogEntry[], limit: number): Array<{ tagId: string; n: number }> {
  const freq = new Map<string, number>()
  for (const log of logs) {
    for (const id of log.tagIds) {
      freq.set(id, (freq.get(id) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .map(([tagId, n]) => ({ tagId, n }))
    .sort((a, b) => b.n - a.n || a.tagId.localeCompare(b.tagId))
    .slice(0, limit)
}

type MonthLegendItem = { ym: string; label: string; inCardMonth: boolean }

function buildMonthLegend(heatmap: { date: string }[], cardDate: string, cardYear: number): MonthLegendItem[] {
  const map = new Map<string, boolean>()
  for (const c of heatmap) {
    const ym = isoYearMonth(c.date)
    if (!map.has(ym)) {
      map.set(ym, isSameMonthAsCard(c.date, cardDate))
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, inCardMonth]) => {
      const y = Number(ym.slice(0, 4))
      const m = Number(ym.slice(5, 7))
      const label = y !== cardYear ? `${y}년 ${m}월` : `${m}월`
      return { ym, label, inCardMonth }
    })
}

/**
 * 그리드 영역(App.css): brand → mid(스페이서·한 줄·할 일|히트맵·스페이서) → meta → tags
 */
export default function DailySummaryCard({
  daily,
  types,
  categories,
  tags,
  insights,
  insightsPending,
}: Props) {
  const typeMap = countTypes(daily.logs)
  const categoryTop = topCategoriesByFrequency(daily.logs, 10)
  const tagTop = topTagsByFrequency(daily.logs, 10)

  const journalText = daily.journal.trim()
  const logCount = daily.logs.length
  const todos = useMemo(() => daily.todos ?? [], [daily])
  const todoDoneCount = todos.filter((t) => t.done).length

  const todoListWrapRef = useRef<HTMLDivElement>(null)
  const todoListRef = useRef<HTMLUListElement>(null)
  const [todoListClipped, setTodoListClipped] = useState(false)

  const measureTodoClip = useCallback(() => {
    const wrap = todoListWrapRef.current
    const list = todoListRef.current
    const n = daily.todos?.length ?? 0
    if (!wrap || !list || n === 0) {
      setTodoListClipped(false)
      return
    }
    setTodoListClipped(list.scrollHeight > wrap.clientHeight + 0.5)
  }, [daily])

  useLayoutEffect(() => {
    measureTodoClip()
    const wrap = todoListWrapRef.current
    if (!wrap || (daily.todos?.length ?? 0) === 0) return
    const ro = new ResizeObserver(() => {
      measureTodoClip()
    })
    ro.observe(wrap)
    return () => {
      ro.disconnect()
    }
  }, [daily, measureTodoClip])

  const heatmapCells = insights?.heatmap ?? []
  const heatmapMax = Math.max(1, ...heatmapCells.map((c) => c.logCount))
  const cardYear = Number(daily.date.slice(0, 4))

  const monthLegend = useMemo(() => {
    const hm = insights?.heatmap
    if (!hm?.length) return []
    return buildMonthLegend(hm, daily.date, cardYear)
  }, [insights, daily.date, cardYear])

  return (
    <article className="summary-card" aria-label="일별 요약 카드">
      <header className="summary-card-zone summary-card-zone--brand">
        <div className="summary-card-brand-row">
          <p className="summary-card-date">{formatDateLongKo(daily.date)}</p>
          <div className="summary-card-brand-product">
            <span className="summary-card-brand-title">Daily Recorder for Engineers</span>
            <span className="summary-card-brand-version" aria-label={`앱 버전 ${import.meta.env.VITE_APP_VERSION}`}>
              v{import.meta.env.VITE_APP_VERSION}
            </span>
          </div>
        </div>
      </header>

      <div className="summary-card-mid">
        <div className="summary-card-mid-spacer summary-card-mid-spacer--top" aria-hidden="true" />
        <blockquote className="summary-card-zone summary-card-zone--journal summary-card-quote">
          {journalText ? (
            journalText
          ) : (
            <span className="summary-card-placeholder">오늘의 한 줄 요약이 비어 있습니다.</span>
          )}
        </blockquote>
        <div className="summary-card-split">
      <section className="summary-card-zone summary-card-zone--todos" aria-label="할 일">
        {todos.length > 0 ? (
          <>
            <p className="summary-card-todo-head">
              할 일 목록 :  <strong>{todoDoneCount}</strong>/{todos.length} 완료
            </p>
            <div ref={todoListWrapRef} className="summary-card-todo-list-wrap">
              <ul ref={todoListRef} className="summary-card-todo-list">
                {todos.map((t) => (
                  <li
                    key={t.todoId}
                    className={`summary-card-todo-line${t.done ? ' summary-card-todo-line--done' : ''}`}
                  >
                    {t.title.trim() || '제목 없음'}
                  </li>
                ))}
              </ul>
            </div>
            {todoListClipped ? (
              <p className="summary-card-todo-overflow-hint" title="아래에 더 있음">
                ……
              </p>
            ) : null}
          </>
        ) : (
          <p className="summary-card-muted summary-card-todo-empty">할 일 없음</p>
        )}
      </section>

      <aside className="summary-card-zone summary-card-zone--heatmap" aria-label="연속 일수와 최근 활동 히트맵">
        <div className="summary-card-heatmap-head">
          {insightsPending ? (
            <p className="summary-card-streak-text summary-card-streak-text--pending">연속 기록 불러오는 중…</p>
          ) : insights ? (
            <p className="summary-card-streak-text" title="카드 날짜부터 거슬러 올라가며, 로그가 1건 이상인 연속 일수">
              연속 기록 <strong>{insights.streak}</strong>일
            </p>
          ) : (
            <p className="summary-card-streak-text summary-card-streak-text--na" title="통계를 불러오지 못했습니다">
              연속 기록 —
            </p>
          )}
          <span className="summary-card-heatmap-label">최근 35일</span>
        </div>

        {insightsPending ? (
          <p className="summary-card-muted summary-card-insights-msg">히트맵 불러오는 중…</p>
        ) : insights && insights.heatmap.length > 0 ? (
          <>
            <div
              className="summary-card-heatmap-grid summary-card-heatmap-grid--35"
              role="img"
              aria-label="최근 35일, 날짜별 로그 수를 색으로 표시합니다. 카드 날짜와 다른 달은 더 차분한 색입니다."
            >
              {insights.heatmap.map((cell) => {
                const inCardMonth = isSameMonthAsCard(cell.date, daily.date)
                const t = cell.logCount / heatmapMax
                const bg = inCardMonth
                  ? `rgba(100, 108, 255, ${0.12 + t * 0.68})`
                  : `rgba(94, 118, 142, ${0.18 + t * 0.42})`
                return (
                  <span
                    key={cell.date}
                    className={`summary-heat-cell${inCardMonth ? '' : ' summary-heat-cell--other-month'}`}
                    style={{ backgroundColor: bg }}
                    title={`${cell.date}: 로그 ${cell.logCount}건${inCardMonth ? '' : ' (다른 달)'}`}
                  />
                )
              })}
            </div>
            {monthLegend.length > 0 ? (
              <div className="summary-card-heatmap-legend" aria-label="히트맵 달 범례">
                {monthLegend.map(({ ym, label, inCardMonth }) => (
                  <span key={ym} className="summary-card-heatmap-legend-item">
                    <span
                      className={`summary-card-heatmap-legend-swatch${inCardMonth ? '' : ' summary-card-heatmap-legend-swatch--muted'}`}
                      style={{
                        backgroundColor: inCardMonth ? 'rgba(100, 108, 255, 0.52)' : 'rgba(94, 118, 142, 0.48)',
                      }}
                    />
                    <span className="summary-card-heatmap-legend-month">{label}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : !insights ? (
          <p className="summary-card-muted summary-card-insights-msg">히트맵을 불러오지 못했습니다.</p>
        ) : null}
      </aside>
        </div>
        <div className="summary-card-mid-spacer summary-card-mid-spacer--bottom" aria-hidden="true" />
      </div>

      <section
        className="summary-card-zone summary-card-zone--meta summary-card-meta-stack summary-card-type-category"
        aria-label="활동 로그·유형"
      >
        <p className="summary-card-log-count-line">
          오늘의 활동 :  <strong>{logCount}</strong>건
        </p>

        {types.length > 0 ? (
          <ul className="summary-card-type-chips summary-card-type-chips--all" aria-label="유형별 로그 수 (목록 순서)">
            {types.map((row) => {
              const n = typeMap.get(row.typeId) ?? 0
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

        {logCount === 0 ? (
          <p className="summary-card-muted">이 날짜에는 활동 로그가 없습니다.</p>
        ) : null}
      </section>

      <footer
        className={`summary-card-zone summary-card-zone--tags summary-card-footer-tags summary-card-footer-tags-stack${categoryTop.length === 0 && tagTop.length === 0 ? ' summary-card-footer-tags--empty' : ''}`}
        aria-label="카테고리와 태그"
      >
        {categoryTop.length > 0 ? (
          <ul className="summary-card-category-chips summary-card-footer-chip-row" aria-label="카테고리">
            {categoryTop.map(({ categoryId, n }) => (
              <li key={categoryId} className="summary-chip summary-chip-category summary-chip-footer-compact">
                {categoryLabel(categories, categoryId)}
                {n > 1 ? <span className="summary-chip-count">{n}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {tagTop.length > 0 ? (
          <ul className="summary-card-tag-chips summary-card-footer-chip-row" aria-label="태그">
            {tagTop.map(({ tagId, n }) => (
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
