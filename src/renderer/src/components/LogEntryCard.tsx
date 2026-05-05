import { useId, useState } from 'react'
import type { CategoryRecord, LogEntry, TagRecord, TypeRecord } from '../types/journal'
import LogTagsField from './LogTagsField'

type Props = {
  log: LogEntry
  types: TypeRecord[]
  categories: CategoryRecord[]
  tags: TagRecord[]
  selectedDateIso: string
  onTagsRefresh: () => Promise<void>
  onTagRemovedProjectWide: (tagId: string) => void
  onChange: (next: LogEntry) => void
  onRemove: () => void
}

function detailPreview(detail: string): string {
  const t = detail.trim()
  if (!t) return '상세 없음'
  const line = t.split(/\r?\n/)[0] ?? ''
  return line.length > 100 ? `${line.slice(0, 100)}…` : line
}

export default function LogEntryCard({
  log,
  types,
  categories,
  tags,
  selectedDateIso,
  onTagsRefresh,
  onTagRemovedProjectWide,
  onChange,
  onRemove,
}: Props) {
  const bodyId = useId()
  const [expanded, setExpanded] = useState(false)

  const typeName = types.find((t) => t.typeId === log.type)?.name ?? log.type

  const toggleCategory = (id: string, checked: boolean) => {
    const set = new Set(log.categoryIds)
    if (checked) set.add(id)
    else set.delete(id)
    onChange({ ...log, categoryIds: [...set] })
  }

  return (
    <article className={`log-card ${expanded ? 'log-card-open' : 'log-card-shut'}`}>
      <header className="log-card-header">
        <button
          type="button"
          className="log-card-toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="log-card-chevron" aria-hidden>
            ▸
          </span>
          <span className="log-card-summary-stack">
            <span className="log-card-summary-line1">
              <span className="log-card-id">{log.logId}</span>
              <span className="log-card-summary-type">{typeName}</span>
            </span>
            {!expanded ? <span className="log-card-summary-preview">{detailPreview(log.detail)}</span> : null}
          </span>
        </button>
        <button type="button" className="log-card-remove" onClick={onRemove}>
          삭제
        </button>
      </header>

      <div id={bodyId} className="log-card-body" hidden={!expanded}>
        <label className="field">
          <span className="field-label">유형</span>
          <select
            className="field-control"
            value={log.type}
            onChange={(e) => onChange({ ...log, type: e.target.value })}
          >
            {types.map((t) => (
              <option key={t.typeId} value={t.typeId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">상세</span>
          <textarea
            className="field-control log-detail"
            rows={4}
            value={log.detail}
            onChange={(e) => onChange({ ...log, detail: e.target.value })}
            placeholder="무엇을 했는지, 배운 점은 무엇인지 적어보세요."
          />
        </label>

        <fieldset className="multi-field">
          <legend className="field-label">카테고리</legend>
          <div className="checkbox-grid">
            {categories.map((c) => (
              <label key={c.categoryId} className="check-row">
                <input
                  type="checkbox"
                  checked={log.categoryIds.includes(c.categoryId)}
                  onChange={(e) => toggleCategory(c.categoryId, e.target.checked)}
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <LogTagsField
          log={log}
          tags={tags}
          onChange={onChange}
          skipDailyIsoDate={selectedDateIso}
          onTagsRefresh={onTagsRefresh}
          onTagRemovedProjectWide={onTagRemovedProjectWide}
        />
      </div>
    </article>
  )
}
