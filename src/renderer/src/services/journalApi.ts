import type { DailyJournalFile } from '../types/journal'

/** 파일 기반 저장소 접근 — 추후 IPC와 main 프로세스에서 구현 */
export async function loadDaily(isoDate: string): Promise<DailyJournalFile | null> {
  void isoDate
  return null
}

export async function saveDaily(file: DailyJournalFile): Promise<void> {
  void file
  throw new Error('journalApi.saveDaily is not implemented')
}
