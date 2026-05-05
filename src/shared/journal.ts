/** Persisted shapes — align with docs/DATA_SCHEMA.md */

export interface TypeRecord {
  typeId: string
  name: string
}

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
  /** equals `typeId` from types.jsonl */
  type: string
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
