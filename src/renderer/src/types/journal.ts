/** `types.jsonl` / 시각화 분류 — 로그당 하나 */
export type JournalType =
  | 'learning'
  | 'development'
  | 'design'
  | 'troubleshooting'
  | 'refactoring'
  | 'documentation'
  | 'communication'

export interface CategoryRecord {
  categoryId: string
  name: string
}

export interface TagRecord {
  tagId: string
  name: string
}

export interface LogEntry {
  logId: string
  type: JournalType
  categoryIds: string[]
  tagIds: string[]
  detail: string
}

/** `data/daily/YYYY-MM-DD_daily.json` */
export interface DailyJournalFile {
  date: string
  journal: string
  logs: LogEntry[]
}
