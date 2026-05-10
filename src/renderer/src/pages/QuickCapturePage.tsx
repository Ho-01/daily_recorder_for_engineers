import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as journalApi from '../services/journalApi'
import type { DailyJournalFile } from '../types/journal'
import { todayIso } from '../utils/date'
import { nextTodoId } from '../utils/todoId'
import '../App.css'

/** 창 정사각형(edge px) — 너무 크면 조정 */
const COLLAPSED = 35
const EXPANDED_W = 380
const EXPANDED_H_LOG = 300
/** 할 일 목록·추가 행 공간 */
const EXPANDED_H_TODOS = 430
/** 포인터 이동이 이 값(px) 이하면 클릭(펼치기), 초과 시 창 이동 */
const TAP_MOVE_THRESHOLD = 4

type CaptureTab = 'log' | 'todos'

export default function QuickCapturePage() {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<CaptureTab>('log')

  const [detail, setDetail] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [daily, setDaily] = useState<DailyJournalFile | null>(null)
  const dailyRef = useRef<DailyJournalFile | null>(null)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [todoError, setTodoError] = useState<string | null>(null)
  const [todoDraft, setTodoDraft] = useState('')

  const todoTitleSaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    dailyRef.current = daily
  }, [daily])

  const persistDailyNow = useCallback(() => {
    const d = dailyRef.current
    if (!d) return
    setTodoError(null)
    void journalApi.saveDaily(d).catch((e) => {
      setTodoError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    })
  }, [])

  useEffect(() => {
    return () => {
      if (todoTitleSaveTimerRef.current) {
        window.clearTimeout(todoTitleSaveTimerRef.current)
        todoTitleSaveTimerRef.current = null
      }
    }
  }, [])

  /** 탭 전환·접기 시 제목 편집 디바운스 플러시 */
  useEffect(() => {
    if (tab === 'todos' && expanded) return
    if (!todoTitleSaveTimerRef.current) return
    window.clearTimeout(todoTitleSaveTimerRef.current)
    todoTitleSaveTimerRef.current = null
    persistDailyNow()
  }, [tab, expanded, persistDailyNow])

  useLayoutEffect(() => {
    if (!expanded) {
      void journalApi.setCaptureContentSize(COLLAPSED, COLLAPSED)
      return
    }
    const h = tab === 'todos' ? EXPANDED_H_TODOS : EXPANDED_H_LOG
    void journalApi.setCaptureContentSize(EXPANDED_W, h)
  }, [expanded, tab])

  useEffect(() => {
    if (!expanded || tab !== 'todos') return
    let cancelled = false
    ;(async () => {
      setDailyLoading(true)
      setTodoError(null)
      try {
        const file = await journalApi.loadDaily(todayIso())
        if (!cancelled) {
          dailyRef.current = file
          setDaily(file)
        }
      } catch (e) {
        if (!cancelled) {
          setTodoError(e instanceof Error ? e.message : '일별 파일을 불러오지 못했습니다.')
          setDaily(null)
        }
      } finally {
        if (!cancelled) setDailyLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [expanded, tab])

  const mutateDaily = useCallback((recipe: (d: DailyJournalFile) => DailyJournalFile) => {
    const prev = dailyRef.current
    if (!prev) return
    const next = recipe(prev)
    dailyRef.current = next
    setDaily(next)
    setTodoError(null)
    void journalApi.saveDaily(next).catch((e) => {
      setTodoError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    })
  }, [])

  const addTodo = useCallback(() => {
    const title = todoDraft.trim()
    if (!title) return
    mutateDaily((d) => {
      const id = nextTodoId(d.date, d.todos)
      return { ...d, todos: [...d.todos, { todoId: id, title, done: false }] }
    })
    setTodoDraft('')
  }, [mutateDaily, todoDraft])

  const toggleTodo = useCallback(
    (index: number) => {
      mutateDaily((d) => ({
        ...d,
        todos: d.todos.map((t, i) => (i === index ? { ...t, done: !t.done } : t)),
      }))
    },
    [mutateDaily],
  )

  const changeTodoTitle = useCallback(
    (index: number, title: string) => {
      const prev = dailyRef.current
      if (!prev) return
      const next = {
        ...prev,
        todos: prev.todos.map((t, i) => (i === index ? { ...t, title } : t)),
      }
      dailyRef.current = next
      setDaily(next)
      setTodoError(null)
      if (todoTitleSaveTimerRef.current) window.clearTimeout(todoTitleSaveTimerRef.current)
      todoTitleSaveTimerRef.current = window.setTimeout(() => {
        todoTitleSaveTimerRef.current = null
        persistDailyNow()
      }, 480)
    },
    [persistDailyNow],
  )

  const removeTodo = useCallback(
    (index: number) => {
      mutateDaily((d) => ({
        ...d,
        todos: d.todos.filter((_, i) => i !== index),
      }))
    },
    [mutateDaily],
  )

  const moveTodo = useCallback(
    (index: number, direction: -1 | 1) => {
      mutateDaily((d) => {
        const next = index + direction
        if (next < 0 || next >= d.todos.length) return d
        const todos = d.todos.slice()
        const [row] = todos.splice(index, 1)
        todos.splice(next, 0, row)
        return { ...d, todos }
      })
    },
    [mutateDaily],
  )

  const handleSave = useCallback(async () => {
    const text = detail.trim()
    if (!text || saving) return
    setSaving(true)
    setError(null)
    try {
      await journalApi.appendLog({ isoDate: todayIso(), detail: text })
      setDetail('')
      setToast('저장됨')
      window.setTimeout(() => setToast(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [detail, saving])

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setExpanded(false)
        return
      }
      if (tab !== 'log') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSaveRef.current()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void handleSaveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [expanded, tab])

  const exitToMain = useCallback(() => {
    void journalApi.exitQuickCaptureMode()
  }, [])

  const collapsedDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: boolean
  } | null>(null)

  const onCollapsedPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    collapsedDragRef.current = {
      pointerId: e.pointerId,
      startX: e.screenX,
      startY: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
      moved: false,
    }
  }, [])

  const onCollapsedPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const s = collapsedDragRef.current
    if (!s || e.pointerId !== s.pointerId) return
    const dx = e.screenX - s.lastX
    const dy = e.screenY - s.lastY
    s.lastX = e.screenX
    s.lastY = e.screenY
    const total = Math.hypot(e.screenX - s.startX, e.screenY - s.startY)
    if (total > TAP_MOVE_THRESHOLD) s.moved = true
    if (s.moved && (dx !== 0 || dy !== 0)) {
      void journalApi.moveCaptureBy(dx, dy)
    }
  }, [])

  const endCollapsedPointer = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const s = collapsedDragRef.current
    if (!s || e.pointerId !== s.pointerId) return
    collapsedDragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    const tap = Math.hypot(e.screenX - s.startX, e.screenY - s.startY) <= TAP_MOVE_THRESHOLD
    if (!s.moved && tap) setExpanded(true)
  }, [])

  const iso = todayIso()
  const todos = daily?.todos ?? []
  const todoDone = todos.filter((x) => x.done).length

  return (
    <div className={`quick-capture-root${!expanded ? ' quick-capture-root--collapsed' : ''}`}>
      {!expanded ? (
        <button
          type="button"
          className="quick-capture-handle-btn"
          aria-expanded={false}
          aria-label="빠른 캡처 펼치기 · 드래그하면 창 이동"
          onPointerDown={onCollapsedPointerDown}
          onPointerMove={onCollapsedPointerMove}
          onPointerUp={endCollapsedPointer}
          onPointerCancel={endCollapsedPointer}
        >
          +
        </button>
      ) : (
        <div className="quick-capture-expanded">
          <div className="quick-capture-top quick-capture-drag">
            <button
              type="button"
              className="quick-capture-collapse-btn quick-capture-no-drag"
              aria-label="접기"
              onClick={() => setExpanded(false)}
            >
              −
            </button>
            <div className="quick-capture-tablist quick-capture-no-drag" role="tablist" aria-label="빠른 캡처 모드">
              <button
                type="button"
                role="tab"
                id="qc-tab-log"
                aria-selected={tab === 'log'}
                aria-controls="qc-panel-log"
                className={tab === 'log' ? 'is-active' : undefined}
                onClick={() => setTab('log')}
              >
                활동 로그
              </button>
              <button
                type="button"
                role="tab"
                id="qc-tab-todos"
                aria-selected={tab === 'todos'}
                aria-controls="qc-panel-todos"
                className={tab === 'todos' ? 'is-active' : undefined}
                onClick={() => setTab('todos')}
              >
                할 일
              </button>
            </div>
            <span className="quick-capture-date" aria-live="polite">
              {iso}
            </span>
          </div>

          {tab === 'log' ? (
            <div id="qc-panel-log" role="tabpanel" aria-labelledby="qc-tab-log" className="quick-capture-form quick-capture-no-drag">
              <label className="quick-capture-label" htmlFor="qc-detail">
                로그 내용
              </label>
              <textarea
                id="qc-detail"
                className="quick-capture-textarea"
                rows={5}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="내용 입력…"
                disabled={saving}
              />
              {error ? <p className="quick-capture-error">{error}</p> : null}
              {toast ? (
                <p className="quick-capture-toast" role="status">
                  {toast}
                </p>
              ) : null}

              <div className="quick-capture-actions">
                <button type="button" className="quick-capture-save" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button type="button" className="quick-capture-main" disabled={saving} onClick={exitToMain}>
                  메인으로
                </button>
              </div>
            </div>
          ) : (
            <div id="qc-panel-todos" role="tabpanel" aria-labelledby="qc-tab-todos" className="quick-capture-todos-panel quick-capture-no-drag">
              {dailyLoading ? (
                <p className="quick-capture-todos-status">할 일 불러오는 중…</p>
              ) : daily ? (
                <>
                  <div className="quick-capture-todos-head">
                    <span className="quick-capture-todos-title">오늘 할 일</span>
                    <span className="quick-capture-todos-count">
                      {todoDone}/{todos.length} 완료
                    </span>
                  </div>
                  <div className="quick-capture-todos-add">
                    <input
                      type="text"
                      className="quick-capture-todo-draft"
                      value={todoDraft}
                      onChange={(e) => setTodoDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTodo()
                        }
                      }}
                      placeholder="새 할 일…"
                      autoComplete="off"
                      aria-label="새 할 일"
                    />
                    <button type="button" className="quick-capture-todo-add-btn" onClick={addTodo} disabled={!todoDraft.trim()}>
                      추가
                    </button>
                  </div>
                  <div className="quick-capture-todos-scroll">
                    {todos.length === 0 ? (
                      <p className="quick-capture-todos-empty">할 일이 없습니다. 위에서 추가하세요.</p>
                    ) : (
                      <ul className="quick-capture-todos-list">
                        {todos.map((todo, index) => (
                          <li key={todo.todoId} className="quick-capture-todo-row">
                            <label className="quick-capture-todo-label">
                              <input
                                type="checkbox"
                                className="quick-capture-todo-check"
                                checked={todo.done}
                                onChange={() => toggleTodo(index)}
                                aria-label={`완료: ${todo.title || '항목'}`}
                              />
                              <input
                                type="text"
                                className="quick-capture-todo-title"
                                value={todo.title}
                                onChange={(e) => changeTodoTitle(index, e.target.value)}
                                aria-label={`할 일 ${index + 1}`}
                              />
                            </label>
                            <div className="quick-capture-todo-actions">
                              <button type="button" className="quick-capture-todo-move" title="위로" disabled={index === 0} onClick={() => moveTodo(index, -1)}>
                                ↑
                              </button>
                              <button
                                type="button"
                                className="quick-capture-todo-move"
                                title="아래로"
                                disabled={index >= todos.length - 1}
                                onClick={() => moveTodo(index, 1)}
                              >
                                ↓
                              </button>
                              <button type="button" className="quick-capture-todo-remove" onClick={() => removeTodo(index)}>
                                삭제
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {todoError ? (
                    <p className="quick-capture-error" role="alert">
                      {todoError}
                    </p>
                  ) : null}
                  <p className="quick-capture-todos-hint">변경 사항은 즉시 오늘 일별 파일에 저장됩니다.</p>
                </>
              ) : (
                <p className="quick-capture-error" role="alert">
                  {todoError ?? '데이터를 불러올 수 없습니다.'}
                </p>
              )}

              <div className="quick-capture-actions quick-capture-actions--solo">
                <button type="button" className="quick-capture-main" onClick={exitToMain}>
                  메인으로
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
