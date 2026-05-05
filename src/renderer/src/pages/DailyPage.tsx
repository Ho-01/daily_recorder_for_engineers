import { useCallback, useEffect, useMemo, useState } from 'react'
import DailyTodoSection from '../components/DailyTodoSection'
import LogEntryCard from '../components/LogEntryCard'
import * as journalApi from '../services/journalApi'
import type { CategoryRecord, DailyJournalFile, LogEntry, TagRecord, TodoItem, TypeRecord } from '../types/journal'
import { todayIso } from '../utils/date'
import { nextLogId } from '../utils/logId'
import { nextTodoId } from '../utils/todoId'

type LogSortMode = 'originalDesc' | 'original' | 'typeAsc' | 'typeDesc' | 'detailAsc' | 'detailDesc'

export default function DailyPage() {
  const [selectedDate, setSelectedDate] = useState(() => todayIso())
  const [daily, setDaily] = useState<DailyJournalFile | null>(null)
  const [types, setTypes] = useState<TypeRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const [logSearch, setLogSearch] = useState('')
  const [filterTypeId, setFilterTypeId] = useState<string>('')
  const [filterTagId, setFilterTagId] = useState<string>('')
  const [sortMode, setSortMode] = useState<LogSortMode>('originalDesc')

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

  const typeLabel = useCallback(
    (typeId: string) => types.find((t) => t.typeId === typeId)?.name ?? typeId,
    [types],
  )

  const displayedLogs = useMemo(() => {
    if (!daily) return [] as { log: LogEntry; index: number }[]
    const q = logSearch.trim().toLowerCase()
    let rows = daily.logs.map((log, index) => ({ log, index }))
    if (filterTypeId) rows = rows.filter(({ log }) => log.type === filterTypeId)
    if (filterTagId) rows = rows.filter(({ log }) => log.tagIds.includes(filterTagId))
    if (q) {
      rows = rows.filter(
        ({ log }) =>
          log.detail.toLowerCase().includes(q) || log.logId.toLowerCase().includes(q),
      )
    }
    const cmp = (a: { log: LogEntry; index: number }, b: { log: LogEntry; index: number }) => {
      switch (sortMode) {
        case 'originalDesc':
          return b.index - a.index
        case 'original':
          return a.index - b.index
        case 'typeAsc': {
          const c = typeLabel(a.log.type).localeCompare(typeLabel(b.log.type), 'ko')
          return c !== 0 ? c : a.index - b.index
        }
        case 'typeDesc': {
          const c = typeLabel(b.log.type).localeCompare(typeLabel(a.log.type), 'ko')
          return c !== 0 ? c : a.index - b.index
        }
        case 'detailAsc': {
          const c = a.log.detail.trim().localeCompare(b.log.detail.trim(), 'ko')
          return c !== 0 ? c : a.index - b.index
        }
        case 'detailDesc': {
          const c = b.log.detail.trim().localeCompare(a.log.detail.trim(), 'ko')
          return c !== 0 ? c : a.index - b.index
        }
        default:
          return a.index - b.index
      }
    }
    rows.sort(cmp)
    return rows
  }, [daily, filterTagId, filterTypeId, logSearch, sortMode, typeLabel])

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

  const addTodo = (title: string) => {
    setDaily((prev) => {
      if (!prev) return prev
      const id = nextTodoId(prev.date, prev.todos)
      const item: TodoItem = { todoId: id, title, done: false }
      setDirty(true)
      return { ...prev, todos: [...prev.todos, item] }
    })
  }

  const toggleTodo = (index: number) => {
    setDaily((prev) => {
      if (!prev) return prev
      const todos = prev.todos.map((t, i) => (i === index ? { ...t, done: !t.done } : t))
      setDirty(true)
      return { ...prev, todos }
    })
  }

  const changeTodoTitle = (index: number, title: string) => {
    setDaily((prev) => {
      if (!prev) return prev
      const todos = prev.todos.map((t, i) => (i === index ? { ...t, title } : t))
      setDirty(true)
      return { ...prev, todos }
    })
  }

  const removeTodo = (index: number) => {
    setDaily((prev) => {
      if (!prev) return prev
      const todos = prev.todos.filter((_, i) => i !== index)
      setDirty(true)
      return { ...prev, todos }
    })
  }

  const moveTodo = (index: number, direction: -1 | 1) => {
    setDaily((prev) => {
      if (!prev) return prev
      const next = index + direction
      if (next < 0 || next >= prev.todos.length) return prev
      const todos = prev.todos.slice()
      const [row] = todos.splice(index, 1)
      todos.splice(next, 0, row)
      setDirty(true)
      return { ...prev, todos }
    })
  }

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

          <DailyTodoSection
            todos={daily.todos}
            disabled={busy}
            onAdd={addTodo}
            onToggle={toggleTodo}
            onChangeTitle={changeTodoTitle}
            onRemove={removeTodo}
            onMove={moveTodo}
          />

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
              <>
                <div className="logs-filter-bar">
                  <label className="field logs-filter-search">
                    <span className="field-label">상세·ID 검색</span>
                    <input
                      type="search"
                      className="field-control"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="상세 텍스트 또는 logId"
                      autoComplete="off"
                    />
                  </label>
                  <label className="field inline">
                    <span className="field-label">유형</span>
                    <select
                      className="field-control"
                      value={filterTypeId}
                      onChange={(e) => setFilterTypeId(e.target.value)}
                    >
                      <option value="">전체</option>
                      {types.map((t) => (
                        <option key={t.typeId} value={t.typeId}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field inline">
                    <span className="field-label">태그</span>
                    <select
                      className="field-control"
                      value={filterTagId}
                      onChange={(e) => setFilterTagId(e.target.value)}
                    >
                      <option value="">전체</option>
                      {tags.map((t) => (
                        <option key={t.tagId} value={t.tagId}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field inline">
                    <span className="field-label">정렬</span>
                    <select
                      className="field-control"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as LogSortMode)}
                    >
                      <option value="originalDesc">추가 순서 (역순)</option>
                      <option value="original">추가 순서</option>
                      <option value="typeAsc">유형 (가나다)</option>
                      <option value="typeDesc">유형 (역순)</option>
                      <option value="detailAsc">상세 (가나다)</option>
                      <option value="detailDesc">상세 (역순)</option>
                    </select>
                  </label>
                  <p className="muted logs-filter-count" aria-live="polite">
                    표시 {displayedLogs.length} / {daily.logs.length}건
                  </p>
                </div>

                {displayedLogs.length === 0 ? (
                  <p className="muted">조건에 맞는 로그가 없습니다. 필터를 바꿔 보세요.</p>
                ) : (
                  <ul className="log-list">
                    {displayedLogs.map(({ log, index }) => (
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
              </>
            )}
          </div>
        </>
      ) : null}

      {dirty ? <p className="muted footnote">저장되지 않은 변경이 있습니다.</p> : null}
    </section>
  )
}
