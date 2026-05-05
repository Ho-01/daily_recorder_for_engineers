import type { AggregateRangeResult, DayAggregateRow } from '../../../shared/visualization'
import type { CategoryRecord, TagRecord, TypeRecord } from '../types/journal'
import ActivityCalendarHeatmap from './ActivityCalendarHeatmap'
import { enumerateDatesInclusive, mondayFirstWeekdayIndex } from '../utils/date'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PIE_COLORS = ['#646cff', '#4eba98', '#e8a838', '#e07070', '#9b7ed9', '#5ab0d4', '#c97aab', '#8bc34a']

type Props = {
  aggregate: AggregateRangeResult | null
  loading: boolean
  types: TypeRecord[]
  categories: CategoryRecord[]
  tags: TagRecord[]
  /** 차트 기간 (히트맹·요일 집계용). 서로 뒤바뀌어도 된다. */
  rangeFrom: string
  rangeTo: string
}

function mergeCounts(days: DayAggregateRow[], field: 'typeCounts' | 'categoryCounts' | 'tagCounts'): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of days) {
    const src = d[field]
    for (const [id, n] of Object.entries(src)) {
      out[id] = (out[id] ?? 0) + n
    }
  }
  return out
}

function topEntries(rec: Record<string, number>, limit: number): { id: string; value: number }[] {
  return Object.entries(rec)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))
    .slice(0, limit)
}

function shortLabel(iso: string): string {
  return iso.slice(5)
}

export default function VisualizeCharts({ aggregate, loading, types, categories, tags, rangeFrom, rangeTo }: Props) {
  if (loading) {
    return <p className="muted visualize-chart-loading">차트 데이터 불러오는 중…</p>
  }

  if (!aggregate || aggregate.days.length === 0) {
    return <p className="muted visualize-chart-empty">선택한 기간에 저장된 일별 파일이 없습니다.</p>
  }

  const days = aggregate.days
  let periodFrom = rangeFrom
  let periodTo = rangeTo
  if (periodFrom > periodTo) {
    const s = periodFrom
    periodFrom = periodTo
    periodTo = s
  }

  const dayLogMap = new Map(days.map((d) => [d.date, d.logCount]))
  const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]
  for (const iso of enumerateDatesInclusive(periodFrom, periodTo)) {
    const n = dayLogMap.get(iso) ?? 0
    weekdayTotals[mondayFirstWeekdayIndex(iso)] += n
  }
  const logsByWeekday = weekdayLabels.map((name, i) => ({ name, logs: weekdayTotals[i] ?? 0 }))

  const logsByDay = days.map((d) => ({
    date: d.date,
    label: shortLabel(d.date),
    logs: d.logCount,
  }))

  const typeTotals = mergeCounts(days, 'typeCounts')
  const typePie = topEntries(typeTotals, 12).map((row) => ({
    name: types.find((t) => t.typeId === row.id)?.name ?? row.id,
    value: row.value,
  }))

  const catTotals = mergeCounts(days, 'categoryCounts')
  const catBar = topEntries(catTotals, 8).map((row) => ({
    name: categories.find((c) => c.categoryId === row.id)?.name ?? row.id,
    value: row.value,
  }))

  const tagTotals = mergeCounts(days, 'tagCounts')
  const tagBar = topEntries(tagTotals, 10).map((row) => ({
    name: tags.find((t) => t.tagId === row.id)?.name ?? row.id,
    value: row.value,
  }))

  return (
    <div className="visualize-charts">
      <h3 className="visualize-charts-heading">기간 통계</h3>

      <div className="visualize-chart-block">
        <h4 className="visualize-chart-title">일별 로그 수</h4>
        <div className="visualize-chart-tall">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={logsByDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.25)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number) => [`${v}건`, '로그']}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { date?: string } | undefined
                  return row?.date ?? ''
                }}
              />
              <Bar dataKey="logs" fill="#646cff" radius={[4, 4, 0, 0]} name="로그" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="visualize-chart-block">
        <h4 className="visualize-chart-title">활동 히트맵 (날짜 그리드)</h4>
        <p className="muted visualize-chart-hint">선택 기간 안 각 날짜의 로그 수를 색으로 표시합니다. 로그에 시각 필드가 없어 요일×시간 격자는 두지 않았습니다.</p>
        <ActivityCalendarHeatmap rangeFrom={periodFrom} rangeTo={periodTo} days={days} />
      </div>

      <div className="visualize-chart-block">
        <h4 className="visualize-chart-title">요일별 로그 수</h4>
        <div className="visualize-chart-short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={logsByWeekday} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.25)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [`${v}건`, '로그']} />
              <Bar dataKey="logs" fill="#9b7ed9" radius={[4, 4, 0, 0]} name="로그" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="visualize-chart-row2">
        <div className="visualize-chart-block visualize-chart-half">
          <h4 className="visualize-chart-title">유형 (기간 합계)</h4>
          <div className="visualize-chart-pie">
            {typePie.length === 0 ? (
              <p className="muted visualize-chart-na">기간 안에 유형이 있는 로그가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    label={false}
                  >
                    {typePie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}건`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="visualize-chart-block visualize-chart-half">
          <h4 className="visualize-chart-title">카테고리 상위</h4>
          <div className="visualize-chart-mid">
            {catBar.length === 0 ? (
              <p className="muted visualize-chart-na">카테고리 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={catBar} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.25)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v}회`, '']} />
                  <Bar dataKey="value" fill="#4eba98" radius={[0, 4, 4, 0]} name="횟수" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="visualize-chart-block">
        <h4 className="visualize-chart-title">태그 상위</h4>
        <div className="visualize-chart-mid">
          {tagBar.length === 0 ? (
            <p className="muted visualize-chart-na">태그 없음</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={tagBar} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.25)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v}회`, '']} />
                <Bar dataKey="value" fill="#e8a838" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
