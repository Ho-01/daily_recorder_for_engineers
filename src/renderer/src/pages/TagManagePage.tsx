import { useEffect, useState } from 'react'
import TagManagerSection from '../components/TagManagerSection'
import * as journalApi from '../services/journalApi'
import type { TagRecord } from '../types/journal'

export default function TagManagePage() {
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await journalApi.readTags()
        if (!cancelled) setTags(rows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="page tag-manage-page">
      <h2>태그 관리</h2>
      <p className="muted tag-manage-lead">목록은 data/tags.jsonl 과 동기화됩니다. 삭제 시 모든 일별 파일에서 해당 태그 참조가 제거됩니다.</p>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <TagManagerSection
          tags={tags}
          onTagsChange={setTags}
          onTagRemovedProjectWide={() => {}}
        />
      )}
    </section>
  )
}
