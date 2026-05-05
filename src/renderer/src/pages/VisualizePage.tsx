import html2canvas from 'html2canvas'
import { useCallback, useEffect, useRef, useState } from 'react'
import DailySummaryCard from '../components/DailySummaryCard'
import VisualizeCharts from '../components/VisualizeCharts'
import * as journalApi from '../services/journalApi'
import type { CardInsightsResult } from '../../../shared/cardInsights'
import type { AggregateRangeResult } from '../../../shared/visualization'
import type { CategoryRecord, DailyJournalFile, TagRecord, TypeRecord } from '../types/journal'
import { addCalendarDaysIso, todayIso } from '../utils/date'

type VisualSubTab = 'card' | 'charts'

export default function VisualizePage() {
  const cardCaptureRef = useRef<HTMLDivElement>(null)

  const [subTab, setSubTab] = useState<VisualSubTab>('card')

  const [selectedDate, setSelectedDate] = useState(() => todayIso())
  const [daily, setDaily] = useState<DailyJournalFile | null>(null)
  const [types, setTypes] = useState<TypeRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [chartFrom, setChartFrom] = useState(() => addCalendarDaysIso(todayIso(), -13))
  const [chartTo, setChartTo] = useState(() => todayIso())
  const [aggregate, setAggregate] = useState<AggregateRangeResult | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [pngBusy, setPngBusy] = useState(false)

  const [cardInsights, setCardInsights] = useState<CardInsightsResult | null>(null)
  const [cardInsightsPending, setCardInsightsPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      try {
        const [t, c, tagRows] = await Promise.all([
          journalApi.readTypes(),
          journalApi.readCategories(),
          journalApi.readTags(),
        ])
        if (!cancelled) {
          setTypes(t)
          setCategories(c)
          setTags(tagRows)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadDaily = useCallback(async (isoDate: string) => {
    setLoadingDaily(true)
    setError(null)
    try {
      const file = await journalApi.loadDaily(isoDate)
      setDaily(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDaily(null)
    } finally {
      setLoadingDaily(false)
    }
  }, [])

  useEffect(() => {
    void loadDaily(selectedDate)
  }, [selectedDate, loadDaily])

  useEffect(() => {
    if (loadingMeta || subTab !== 'card') return
    let cancelled = false
    ;(async () => {
      setCardInsightsPending(true)
      try {
        const res = await journalApi.cardInsights(selectedDate)
        if (!cancelled) setCardInsights(res)
      } catch {
        if (!cancelled) setCardInsights(null)
      } finally {
        if (!cancelled) setCardInsightsPending(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDate, subTab, loadingMeta])

  useEffect(() => {
    if (loadingMeta || subTab !== 'charts') return
    let from = chartFrom
    let to = chartTo
    if (from > to) {
      const s = from
      from = to
      to = s
    }
    let cancelled = false
    ;(async () => {
      setChartLoading(true)
      try {
        const res = await journalApi.aggregateRange(from, to)
        if (!cancelled) setAggregate(res)
      } catch {
        if (!cancelled) setAggregate(null)
      } finally {
        if (!cancelled) setChartLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chartFrom, chartTo, loadingMeta, subTab])

  const exportCardPng = async () => {
    const el = cardCaptureRef.current
    if (!el || !daily) return
    setPngBusy(true)
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: null,
        logging: false,
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) {
        window.alert('이미지를 만들 수 없습니다.')
        return
      }
      const ab = await blob.arrayBuffer()
      const bytes = Array.from(new Uint8Array(ab))
      const res = await journalApi.savePngDialog(`daily_${selectedDate}_card.png`, bytes)
      if (res.canceled) return
      if (res.ok && res.filePath) window.alert(`저장했습니다:\n${res.filePath}`)
      else window.alert('저장하지 못했습니다.')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPngBusy(false)
    }
  }

  const busy = loadingMeta || loadingDaily

  return (
    <section className="page visualize-page">
      <header className="visualize-page-header">
        <h2>시각화</h2>
        <p className="muted visualize-lead">
          <strong>요약 카드</strong>는 하루 스냅샷·PNG 저장용, <strong>기간 차트</strong>는 선택 구간 통계입니다. 아래 탭으로 전환합니다.
        </p>
      </header>

      <div className="visualize-sub-nav" role="tablist" aria-label="시각화 하위 화면">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'card'}
          id="visualize-tab-card"
          className={subTab === 'card' ? 'active' : ''}
          onClick={() => setSubTab('card')}
        >
          요약 카드
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'charts'}
          id="visualize-tab-charts"
          className={subTab === 'charts' ? 'active' : ''}
          onClick={() => setSubTab('charts')}
        >
          기간 차트
        </button>
      </div>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      {loadingMeta ? <p className="muted">목록 불러오는 중…</p> : null}

      {subTab === 'card' ? (
        <div
          className="visualize-tab-panel visualize-tab-panel-card"
          role="tabpanel"
          aria-labelledby="visualize-tab-card"
        >
          <div className="visualize-toolbar">
            <label className="field inline">
              <span className="field-label">카드 날짜</span>
              <input
                type="date"
                className="field-control"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <button type="button" className="tag-row-btn" onClick={() => setSelectedDate(todayIso())} disabled={busy}>
              오늘
            </button>
            <button
              type="button"
              className="btn-primary visualize-png-btn"
              disabled={busy || !daily || pngBusy}
              onClick={() => void exportCardPng()}
            >
              {pngBusy ? 'PNG 저장 중…' : '카드 PNG 저장'}
            </button>
          </div>

          {!busy && daily ? (
            <div className="visualize-card-wrap">
              <div ref={cardCaptureRef} className="visualize-card-capture">
                <DailySummaryCard
                  daily={daily}
                  types={types}
                  categories={categories}
                  tags={tags}
                  insights={cardInsights}
                  insightsPending={cardInsightsPending}
                />
              </div>
            </div>
          ) : !loadingMeta && loadingDaily ? (
            <p className="muted">일별 데이터 불러오는 중…</p>
          ) : null}
        </div>
      ) : (
        <div
          className="visualize-tab-panel visualize-tab-panel-charts"
          role="tabpanel"
          aria-labelledby="visualize-tab-charts"
        >
          <div className="visualize-chart-toolbar">
            <label className="field inline">
              <span className="field-label">시작</span>
              <input
                type="date"
                className="field-control"
                value={chartFrom}
                onChange={(e) => setChartFrom(e.target.value)}
                disabled={loadingMeta}
              />
            </label>
            <label className="field inline">
              <span className="field-label">종료</span>
              <input
                type="date"
                className="field-control"
                value={chartTo}
                onChange={(e) => setChartTo(e.target.value)}
                disabled={loadingMeta}
              />
            </label>
            <button
              type="button"
              className="tag-row-btn"
              disabled={loadingMeta}
              onClick={() => {
                const t = todayIso()
                setChartTo(t)
                setChartFrom(addCalendarDaysIso(t, -13))
              }}
            >
              최근 14일
            </button>
          </div>

          <VisualizeCharts
            aggregate={aggregate}
            loading={chartLoading || loadingMeta}
            types={types}
            categories={categories}
            tags={tags}
            rangeFrom={chartFrom}
            rangeTo={chartTo}
          />
        </div>
      )}
    </section>
  )
}
