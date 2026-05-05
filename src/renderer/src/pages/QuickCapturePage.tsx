import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as journalApi from '../services/journalApi'
import { todayIso } from '../utils/date'
import '../App.css'

/** 창 정사각형(edge px) — 너무 크면 조정 */
const COLLAPSED = 35
const EXPANDED_W = 380
const EXPANDED_H = 300
/** 포인터 이동이 이 값(px) 이하면 클릭(펼치기), 초과 시 창 이동 */
const TAP_MOVE_THRESHOLD = 4

export default function QuickCapturePage() {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useLayoutEffect(() => {
    void journalApi.setCaptureContentSize(expanded ? EXPANDED_W : COLLAPSED, expanded ? EXPANDED_H : COLLAPSED)
  }, [expanded])

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
  }, [expanded])

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
            <span className="quick-capture-heading"></span>
            <span className="quick-capture-date" aria-live="polite">
              {todayIso()}
            </span>
          </div>

          <div className="quick-capture-form quick-capture-no-drag">
            <label className="quick-capture-label" htmlFor="qc-detail">
              
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
            {toast ? <p className="quick-capture-toast" role="status">{toast}</p> : null}

            <div className="quick-capture-actions">
              <button type="button" className="quick-capture-save" disabled={saving} onClick={() => void handleSave()}>
                {saving ? '저장 중…' : '저장'}
              </button>
              <button type="button" className="quick-capture-main" disabled={saving} onClick={exitToMain}>
                메인으로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
