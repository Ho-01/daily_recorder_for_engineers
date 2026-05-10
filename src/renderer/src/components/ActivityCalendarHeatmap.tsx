import type { DayAggregateRow } from '../../../shared/visualization'
import { enumerateDatesInclusive, mondayFirstWeekdayIndex } from '../utils/date'

type Props = {
  rangeFrom: string
  rangeTo: string
  days: DayAggregateRow[]
}

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function buildCountMap(rows: DayAggregateRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    m.set(r.date, r.logCount)
  }
  return m
}

/** 월요일 시작 주 단위 그리드. null은 범위 밖 패딩 칸. */
function buildWeekRows(rangeDates: string[]): (string | null)[][] {
  if (rangeDates.length === 0) return []
  const first = rangeDates[0]!
  const leading = mondayFirstWeekdayIndex(first)
  const cells: (string | null)[] = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (const d of rangeDates) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}

export default function ActivityCalendarHeatmap({ rangeFrom, rangeTo, days }: Props) {
  let from = rangeFrom
  let to = rangeTo
  if (from > to) {
    const s = from
    from = to
    to = s
  }

  const countMap = buildCountMap(days)
  const rangeDates = enumerateDatesInclusive(from, to)
  const maxCount = Math.max(1, ...rangeDates.map((d) => countMap.get(d) ?? 0))
  const weekRows = buildWeekRows(rangeDates)

  return (
    <div className="activity-heatmap">
      <div className="activity-heatmap-legend" aria-hidden="true">
        <span className="muted activity-heatmap-legend-label">적음</span>
        <span className="activity-heatmap-scale" />
        <span className="muted activity-heatmap-legend-label">많음</span>
      </div>
      <div className="activity-heatmap-grid-wrap">
        <div className="activity-heatmap-weekdays" role="row">
          {WEEK_LABELS.map((label) => (
            <span key={label} className="activity-heatmap-wd">
              {label}
            </span>
          ))}
        </div>
        {weekRows.map((week, wi) => (
          <div key={wi} className="activity-heatmap-week" role="row">
            {week.map((iso, di) => {
              if (!iso) {
                return <span key={`empty-${wi}-${di}`} className="heat-cell heat-cell-pad" aria-hidden="true" />
              }
              const n = countMap.get(iso) ?? 0
              const t = n / maxCount
              /* DESIGN.md — ink (#181a20) 기준 히트 농도 */
              const bg = `rgba(24, 26, 32, ${0.06 + t * 0.52})`
              return (
                <span
                  key={iso}
                  className="heat-cell"
                  style={{ backgroundColor: bg }}
                  title={`${iso}: 로그 ${n}건`}
                >
                  <span className="heat-cell-day">{iso.slice(8)}</span>
                  {n > 0 ? <span className="heat-cell-n">{n}</span> : null}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
