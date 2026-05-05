import * as journalApi from '../services/journalApi'

/** 확인 후 전역 삭제. skipDailyIsoDate 가 있으면 해당 날짜 daily 파일만 디스크에서 건너뜀. 없으면 모든 일별 파일에서 제거. */
export async function confirmAndDeleteTag(
  tagId: string,
  displayName: string,
  skipDailyIsoDate?: string,
): Promise<boolean> {
  const n = await journalApi.countTagUsage(tagId)
  const msg =
    n > 0
      ? `이 태그「${displayName}」는 총 ${n}개의 로그에서 사용 중입니다.\n\n삭제하면 모든 일별 기록 파일에서 해당 태그가 로그에서 제거됩니다.\n계속할까요?`
      : `태그「${displayName}」을(를) 완전히 삭제할까요?`
  if (!window.confirm(msg)) return false
  await journalApi.deleteTag(tagId, skipDailyIsoDate)
  return true
}
