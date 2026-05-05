import { useState } from 'react'
import type { LogEntry, TagRecord } from '../types/journal'
import * as journalApi from '../services/journalApi'
import { confirmAndDeleteTag } from '../utils/tagActions'

type Props = {
  log: LogEntry
  tags: TagRecord[]
  onChange: (next: LogEntry) => void
  skipDailyIsoDate: string
  onTagsRefresh: () => Promise<void>
  /** 디스크 반영 후 현재 일별 상태에서 해당 tagId 를 모든 로그에서 제거 */
  onTagRemovedProjectWide: (tagId: string) => void
}

export default function LogTagsField({
  log,
  tags,
  onChange,
  skipDailyIsoDate,
  onTagsRefresh,
  onTagRemovedProjectWide,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const toggleId = (id: string, checked: boolean) => {
    const set = new Set(log.tagIds)
    if (checked) set.add(id)
    else set.delete(id)
    onChange({ ...log, tagIds: [...set] })
  }

  const handleDeleteTag = async (t: TagRecord) => {
    if (busy) return
    setBusy(true)
    try {
      const ok = await confirmAndDeleteTag(t.tagId, t.name, skipDailyIsoDate)
      if (!ok) return
      onTagRemovedProjectWide(t.tagId)
      await onTagsRefresh()
    } finally {
      setBusy(false)
    }
  }

  const submitNew = async () => {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    setCreateErr(null)
    try {
      const created = await journalApi.createTag(name)
      await onTagsRefresh()
      const nextIds = [...new Set([...log.tagIds, created.tagId])]
      onChange({ ...log, tagIds: nextIds })
      setNewName('')
      setAdding(false)
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className="multi-field tag-pick-field">
      <legend className="field-label">태그</legend>
      {createErr ? (
        <p className="error-banner tag-pick-error" role="alert">
          {createErr}
        </p>
      ) : null}
      <div className="tag-pick-list">
        {tags.map((t) => (
          <div key={t.tagId} className="tag-pick-row">
            <label className="tag-pick-check">
              <input
                type="checkbox"
                checked={log.tagIds.includes(t.tagId)}
                onChange={(e) => toggleId(t.tagId, e.target.checked)}
                disabled={busy}
              />
              <span>{t.name}</span>
            </label>
            <button
              type="button"
              className="tag-pick-remove"
              title={`「${t.name}」 태그 삭제`}
              aria-label={`「${t.name}」 태그 삭제`}
              disabled={busy}
              onClick={() => void handleDeleteTag(t)}
            >
              ×
            </button>
          </div>
        ))}

        {!adding ? (
          <button
            type="button"
            className="tag-pick-add"
            disabled={busy}
            onClick={() => {
              setCreateErr(null)
              setAdding(true)
            }}
          >
            + 태그 추가
          </button>
        ) : (
          <div className="tag-pick-new">
            <input
              type="text"
              className="field-control tag-pick-new-input"
              placeholder="새 태그 이름"
              value={newName}
              disabled={busy}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitNew()
                if (e.key === 'Escape') {
                  setAdding(false)
                  setNewName('')
                }
              }}
              autoFocus
            />
            <button type="button" className="tag-row-btn" disabled={busy} onClick={() => void submitNew()}>
              추가
            </button>
            <button
              type="button"
              className="tag-row-btn"
              disabled={busy}
              onClick={() => {
                setAdding(false)
                setNewName('')
              }}
            >
              취소
            </button>
          </div>
        )}
      </div>
    </fieldset>
  )
}
