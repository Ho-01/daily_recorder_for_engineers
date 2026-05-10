/** 로컬 기준 오늘 YYYY-MM-DD */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 예: 2026년 5월 5일 화요일 */
/** 같은 달력 일 기준으로 더하기 (타임존 로컬) */
export function addCalendarDaysIso(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (y === undefined || m === undefined || d === undefined) return isoDate
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** `from`·`to` 포함. `from > to` 이면 순서를 바꿔 반환한다. */
export function enumerateDatesInclusive(from: string, to: string): string[] {
  let a = from
  let b = to
  if (a > b) {
    const s = a
    a = b
    b = s
  }
  const out: string[] = []
  let cur = a
  for (let i = 0; i < 4000 && cur <= b; i++) {
    out.push(cur)
    cur = addCalendarDaysIso(cur, 1)
  }
  return out
}

/** 월요일=0 … 일요일=6 (한국 달력 관례) */
export function mondayFirstWeekdayIndex(isoDate: string): number {
  const parts = isoDate.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (y === undefined || m === undefined || d === undefined) return 0
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return 0
  const sun = dt.getDay()
  return sun === 0 ? 6 : sun - 1
}

export function formatDateLongKo(isoDate: string): string {
  const parts = isoDate.split('-').map(Number)
  const y = parts[0]
  const mo = parts[1]
  const day = parts[2]
  if (y === undefined || mo === undefined || day === undefined) return isoDate
  const dt = new Date(y, mo - 1, day)
  if (Number.isNaN(dt.getTime())) return isoDate
  return dt.toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

/** 해당 날짜가 속한 주의 월요일(로컬, 월요일 시작 주). */
export function startOfIsoWeekMonday(isoDate: string): string {
  const back = mondayFirstWeekdayIndex(isoDate)
  return addCalendarDaysIso(isoDate, -back)
}

/** 월요일 기준 같은 주 일요일. */
export function endOfIsoWeekSunday(mondayIso: string): string {
  return addCalendarDaysIso(mondayIso, 6)
}

/** 사용자 표시용: `2026년 5월 5일 ~ 5월 11일` (연도 넘어가면 양쪽 연도 표기). */
export function formatWeekRangeShortKo(mondayIso: string, sundayIso: string): string {
  const y1 = mondayIso.slice(0, 4)
  const y2 = sundayIso.slice(0, 4)
  const m1 = Number(mondayIso.slice(5, 7))
  const d1 = Number(mondayIso.slice(8, 10))
  const m2 = Number(sundayIso.slice(5, 7))
  const d2 = Number(sundayIso.slice(8, 10))
  if (y1 === y2) {
    return `${y1}년 ${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`
  }
  return `${y1}년 ${m1}월 ${d1}일 ~ ${y2}년 ${m2}월 ${d2}일`
}
