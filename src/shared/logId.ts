import type { LogEntry } from './journal'

/** Next `log_YYYYMMDD_###` id unique within the same daily file. */
export function nextLogId(isoDate: string, logs: LogEntry[]): string {
  const compact = isoDate.replace(/-/g, '')
  const prefix = `log_${compact}_`
  let max = 0
  const re = new RegExp(`^${prefix}(\\d{3})$`)
  for (const log of logs) {
    const m = log.logId.match(re)
    if (m) max = Math.max(max, Number.parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}
