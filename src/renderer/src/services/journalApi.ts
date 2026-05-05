import type { CategoryRecord, DailyJournalFile, TagRecord, TypeRecord } from '../types/journal'

/** preload에 노출되는 메서드 — 빠지면 예전 preload가 아직 메모리에 있는 경우가 많음 */
const API_METHODS = [
  'readTypes',
  'readCategories',
  'readTags',
  'createTag',
  'updateTag',
  'countTagUsage',
  'deleteTag',
  'readDaily',
  'saveDaily',
] as const

function getApi() {
  const { api } = window
  if (!api) {
    throw new Error(
      'preload API(window.api)가 없습니다. Electron으로 실행했는지 확인하세요. (`npm run dev`) 브라우저에서 Vite 주소만 열면 동작하지 않습니다. `out/`가 오래됐다면 삭제 후 다시 빌드·실행하세요.',
    )
  }
  const rec = api as Record<string, unknown>
  const missing = API_METHODS.filter((m) => typeof rec[m] !== 'function')
  if (missing.length > 0) {
    throw new Error(
      `preload가 예전 버전입니다(없음: ${missing.join(', ')}). Electron 창을 모두 닫고 터미널에서 Ctrl+C로 dev 서버를 끈 뒤 \`npm run dev\`로 다시 실행하세요. preload는 화면 새로고침만으로 갱신되지 않습니다.`,
    )
  }
  return api as NonNullable<typeof window.api>
}

export async function readTypes(): Promise<TypeRecord[]> {
  return getApi().readTypes()
}

export async function readCategories(): Promise<CategoryRecord[]> {
  return getApi().readCategories()
}

export async function readTags(): Promise<TagRecord[]> {
  return getApi().readTags()
}

export async function createTag(name: string): Promise<TagRecord> {
  return getApi().createTag(name)
}

export async function updateTag(tagId: string, name: string): Promise<TagRecord> {
  return getApi().updateTag(tagId, name)
}

export async function countTagUsage(tagId: string): Promise<number> {
  return getApi().countTagUsage(tagId)
}

export async function deleteTag(tagId: string, skipDailyIsoDate?: string): Promise<void> {
  return getApi().deleteTag(tagId, skipDailyIsoDate)
}

export async function loadDaily(isoDate: string): Promise<DailyJournalFile> {
  return getApi().readDaily(isoDate)
}

export async function saveDaily(file: DailyJournalFile): Promise<void> {
  return getApi().saveDaily(file)
}
