/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** package.json version — electron.vite.config.ts 에서 주입 */
  readonly VITE_APP_VERSION: string
}

import type { CategoryRecord, DailyJournalFile, TagRecord, TypeRecord } from '../../shared/journal'

interface JournalApi {
  readTypes(): Promise<TypeRecord[]>
  readCategories(): Promise<CategoryRecord[]>
  readTags(): Promise<TagRecord[]>
  createTag(name: string): Promise<TagRecord>
  updateTag(tagId: string, name: string): Promise<TagRecord>
  countTagUsage(tagId: string): Promise<number>
  deleteTag(tagId: string, skipDailyIsoDate?: string): Promise<void>
  readDaily(isoDate: string): Promise<DailyJournalFile>
  saveDaily(file: DailyJournalFile): Promise<void>
}

interface Window {
  /** Preload에서 주입. 브라우저 전용 미리보기 등에서는 없을 수 있음 */
  api?: JournalApi
}
