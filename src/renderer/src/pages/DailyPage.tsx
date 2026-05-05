import { useCallback, useEffect, useMemo, useState } from 'react'
import LogEntryCard from '../components/LogEntryCard'
import * as journalApi from '../services/journalApi'
import type { CategoryRecord, DailyJournalFile, LogEntry, TagRecord, TypeRecord } from '../types/journal'
import { nextLogId } from '../utils/logId'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DailyPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [daily, setDaily] = useState<DailyJournalFile | null>(null)
  const [types, setTypes] = useState<TypeRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      setError(null)
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

  const loadDailyForDate = useCallback(async (isoDate: string) => {
    setLoadingDaily(true)
    setError(null)
    try {
      const file = await journalApi.loadDaily(isoDate)
      setDaily(file)
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDaily(null)
    } finally {
      setLoadingDaily(false)
    }
  }, [])

  useEffect(() => {
    void loadDailyForDate(selectedDate)
  }, [selectedDate, loadDailyForDate])

  const defaultTypeId = useMemo(() => types[0]?.typeId ?? '', [types])

  const handleDateChange = (next: string) => {
    if (dirty) {
      const ok = window.confirm('저장하지 않은 변경이 있습니다. 날짜를 바꿀까요?')
      if (!ok) return
    }
    setSelectedDate(next)
  }

  const updateJournalText = (journal: string) => {
    setDaily((prev) => (prev ? { ...prev, journal } : prev))
    setDirty(true)
  }

  const addLog = () => {
    setDaily((prev) => {
      if (!prev) return prev
      const id = nextLogId(prev.date, prev.logs)
      const entry: LogEntry = {
        logId: id,
        type: defaultTypeId || prev.logs[0]?.type || 'learning',
        categoryIds: [],
        tagIds: [],
        detail: '',
      }
      setDirty(true)
      return { ...prev, logs: [...prev.logs, entry] }
    })
  }

  const updateLog = (index: number, next: LogEntry) => {
    setDaily((prev) => {
      if (!prev) return prev
      const logs = prev.logs.slice()
      logs[index] = next
      setDirty(true)
      return { ...prev, logs }
    })
  }

  const removeLog = (index: number) => {
    setDaily((prev) => {
      if (!prev) return prev
      const logs = prev.logs.filter((_, i) => i !== index)
      setDirty(true)
      return { ...prev, logs }
    })
  }

  const refreshTags = useCallback(async () => {
    setTags(await journalApi.readTags())
  }, [])

  const stripTagFromAllLogsInDaily = useCallback((tagId: string) => {
    setDaily((prev) =>
      prev
        ? {
            ...prev,
            logs: prev.logs.map((l) => ({
              ...l,
              tagIds: l.tagIds.filter((id) => id !== tagId),
            })),
          }
        : null,
    )
    setDirty(true)
  }, [])

  const handleSave = async () => {
    if (!daily) return
    setSaving(true)
    setError(null)
    try {
      await journalApi.saveDaily(daily)
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const busy = loadingMeta || loadingDaily

  return (
    <section className="page daily-page">
      <header className="daily-header">
        <h2>오늘의 기록</h2>
        <div className="daily-toolbar">
          <label className="field inline">
            <span className="field-label">날짜</span>
            <input
              type="date"
              className="field-control"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={busy || saving || !daily}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </header>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      {loadingMeta ? <p className="muted">목록 불러오는 중…</p> : null}

      {!loadingMeta && !error && types.length === 0 ? (
        <p className="muted">유형 목록이 비어 있습니다. data/types.jsonl 을 확인해 주세요.</p>
      ) : null}

      {busy && !loadingMeta ? <p className="muted">일별 기록 불러오는 중…</p> : null}

      {!busy && daily ? (
        <>
          <label className="field">
            <span className="field-label">그날 한 줄</span>
            <textarea
              className="field-control journal-body"
              rows={3}
              value={daily.journal}
              onChange={(e) => updateJournalText(e.target.value)}
              placeholder="하루를 한 문장으로 요약해 보세요."
            />
          </label>

          <div className="logs-section">
            <div className="logs-section-head">
              <h3 className="logs-title">활동 로그</h3>
              <button type="button" onClick={addLog} disabled={types.length === 0}>
                로그 추가
              </button>
            </div>

            {daily.logs.length === 0 ? (
              <p className="muted">아직 로그가 없습니다. &quot;로그 추가&quot;로 항목을 만드세요.</p>
            ) : (
              <ul className="log-list">
                {daily.logs.map((log, index) => (
                  <li key={log.logId}>
                    <LogEntryCard
                      log={log}
                      types={types}
                      categories={categories}
                      tags={tags}
                      selectedDateIso={selectedDate}
                      onTagsRefresh={refreshTags}
                      onTagRemovedProjectWide={stripTagFromAllLogsInDaily}
                      onChange={(next) => updateLog(index, next)}
                      onRemove={() => removeLog(index)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      {dirty ? <p className="muted footnote">저장되지 않은 변경이 있습니다.</p> : null}
    </section>
  )
}
