import { useEffect, useState } from 'react'
import * as journalApi from '../services/journalApi'
import type { TagRecord } from '../types/journal'
import { confirmAndDeleteTag } from '../utils/tagActions'

type Props = {
  tags: TagRecord[]
  onTagsChange: (tags: TagRecord[]) => void
  /** 설정 시 해당 날짜의 daily 파일만 디스크에서 건너뜀(Daily 편집 화면과 함께 쓸 때) */
  skipDailyIsoDate?: string
  /** 태그 삭제 후 현재 메모리상 일별 로그에서 제거(Daily 페이지에서만 의미 있음) */
  onTagRemovedProjectWide?: (tagId: string) => void
  disabled?: boolean
}

export default function TagManagerSection({
  tags,
  onTagsChange,
  skipDailyIsoDate,
  onTagRemovedProjectWide,
  disabled,
}: Props) {
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const refresh = async () => {
    const next = await journalApi.readTags()
    onTagsChange(next)
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setLocalError(null)
    try {
      await journalApi.createTag(name)
      setNewName('')
      await refresh()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="tag-manager" aria-label="태그 목록 편집">
      <p className="muted tag-manager-hint">표시 이름만 수정합니다. 삭제는 모든 일별 로그에서 해당 태그를 제거합니다.</p>

      {localError ? (
        <p className="error-banner tag-manager-error" role="alert">
          {localError}
        </p>
      ) : null}

      <div className="tag-manager-add">
        <input
          type="text"
          className="field-control tag-manager-input"
          placeholder="새 태그 이름"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={disabled || busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate()
          }}
        />
        <button type="button" className="btn-primary" onClick={() => void handleCreate()} disabled={disabled || busy}>
          추가
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="muted">등록된 태그가 없습니다. 위에서 추가해 보세요.</p>
      ) : (
        <ul className="tag-manager-list">
          {tags.map((t) => (
            <TagEditRow
              key={t.tagId}
              tag={t}
              disabled={Boolean(disabled || busy)}
              onBusy={setBusy}
              onError={setLocalError}
              onRefresh={refresh}
              skipDailyIsoDate={skipDailyIsoDate}
              onTagRemovedProjectWide={onTagRemovedProjectWide ?? (() => {})}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function TagEditRow({
  tag,
  disabled,
  onBusy,
  onError,
  onRefresh,
  skipDailyIsoDate,
  onTagRemovedProjectWide,
}: {
  tag: TagRecord
  disabled: boolean
  onBusy: (v: boolean) => void
  onError: (s: string | null) => void
  onRefresh: () => Promise<void>
  skipDailyIsoDate?: string
  onTagRemovedProjectWide: (tagId: string) => void
}) {
  const [name, setName] = useState(tag.name)

  useEffect(() => {
    setName(tag.name)
  }, [tag.tagId, tag.name])

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed === tag.name) return
    onBusy(true)
    onError(null)
    try {
      await journalApi.updateTag(tag.tagId, trimmed)
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      onBusy(false)
    }
  }

  const remove = async () => {
    onBusy(true)
    onError(null)
    try {
      const ok = await confirmAndDeleteTag(tag.tagId, tag.name, skipDailyIsoDate)
      if (!ok) return
      onTagRemovedProjectWide(tag.tagId)
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      onBusy(false)
    }
  }

  return (
    <li className="tag-manager-row">
      <code className="tag-id">{tag.tagId}</code>
      <input
        type="text"
        className="field-control tag-manager-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
        }}
      />
      <button type="button" className="tag-row-btn" onClick={() => void save()} disabled={disabled}>
        저장
      </button>
      <button type="button" className="tag-row-btn danger" onClick={() => void remove()} disabled={disabled}>
        삭제
      </button>
    </li>
  )
}
