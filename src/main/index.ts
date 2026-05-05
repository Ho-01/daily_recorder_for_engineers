import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { IPC_CHANNELS } from '../shared/ipc'
import { nextLogId } from '../shared/logId'
import type { CategoryRecord, DailyJournalFile, LogEntry, TagRecord, TodoItem, TypeRecord } from '../shared/journal'
import type { CardInsightsResult } from '../shared/cardInsights'
import type { AggregateRangeResult, DayAggregateRow } from '../shared/visualization'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let tray: Tray | null = null

/** 렌더러가 마지막으로 요청한 캡처 창 콘텐츠 크기 — 드래그 중 OS가 창만 키우는 현상 방지 */
let captureLastContentSize = { width: 52, height: 52 }

/** 동일 날짜 파일에 대한 append 직렬화(메인·캡처 동시 저장 경합 완화) */
let appendMutex: Promise<void> = Promise.resolve()

function runAppendSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = appendMutex.then(() => fn())
  appendMutex = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

function resolveTrayIcon(): ReturnType<typeof nativeImage.createEmpty> {
  const candidates = [
    path.join(app.getAppPath(), 'public', 'vite.svg'),
    path.join(app.getAppPath(), 'public', 'electron-vite.svg'),
  ]
  for (const p of candidates) {
    if (fsSync.existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return img
    }
  }
  return nativeImage.createEmpty()
}

function destroyTray(): void {
  if (tray) {
    tray.removeAllListeners('click')
    tray.destroy()
    tray = null
  }
}

/** 메인이 숨겨진 빠른 캡처 세션에서 캡처 창이 안 보일 때: 트레이로 복구 */
function recoverOrFocusCaptureWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isVisible()) {
    if (captureWindow && !captureWindow.isDestroyed()) {
      if (captureWindow.isMinimized()) captureWindow.restore()
      captureWindow.show()
      captureWindow.focus()
    }
    return
  }

  buildTray()
  if (captureWindow && !captureWindow.isDestroyed()) {
    if (captureWindow.isMinimized()) captureWindow.restore()
    captureWindow.show()
    captureWindow.focus()
    const b = captureWindow.getBounds()
    const { x, y, width, height } = screen.getDisplayMatching(b).workArea
    const overlapX = b.x + b.width > x && b.x < x + width
    const overlapY = b.y + b.height > y && b.y < y + height
    if (!overlapX || !overlapY) {
      positionCaptureBottomRight(captureWindow)
    }
    return
  }

  ensureCaptureWindow()
}

function buildTray(): void {
  if (tray) return
  const icon = resolveTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('Daily Recorder — 빠른 캡처 (클릭: 캡처 창 다시 보이기)')
  const menu = Menu.buildFromTemplate([
    {
      label: '캡처 창 다시 보이기',
      click: () => {
        recoverOrFocusCaptureWindow()
      },
    },
    { type: 'separator' },
    {
      label: '메인 창 열기',
      click: () => {
        exitQuickCaptureFromMain()
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        destroyTray()
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
  if (process.platform !== 'darwin') {
    tray.on('click', () => {
      recoverOrFocusCaptureWindow()
    })
  }
}

function loadCaptureUrl(win: BrowserWindow): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL'].replace(/\/?$/, '')
    void win.loadURL(`${base}#/quick-capture`)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'quick-capture' })
  }
}

function positionCaptureBottomRight(win: BrowserWindow): void {
  const wa = screen.getPrimaryDisplay().workArea
  const b = win.getBounds()
  const margin = 16
  win.setPosition(wa.x + wa.width - b.width - margin, wa.y + wa.height - b.height - margin)
}

function ensureCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    if (captureWindow.isMinimized()) captureWindow.restore()
    captureWindow.show()
    captureWindow.focus()
    return
  }

  const win = new BrowserWindow({
    width: 52,
    height: 52,
    minWidth: 22,
    minHeight: 22,
    maxWidth: 520,
    maxHeight: 720,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    /** 접힘 시 네 모서리를 투명 처리해 ‘원 하나’만 보이게 함 */
    transparent: true,
    backgroundColor: '#00000000',
    /** 가장자리 드래그·화면 끝 스냅 등으로 창 크기가 바뀌면 UI가 함께 커지는 문제 방지 — 크기는 IPC만 */
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.setMenuBarVisibility(false)
  win.setAlwaysOnTop(true, 'floating')
  win.setResizable(false)
  captureWindow = win

  let captureResizeClamp = false
  win.on('resize', () => {
    if (captureResizeClamp || !captureWindow || captureWindow.isDestroyed()) return
    const [cw, ch] = captureWindow.getContentSize()
    const { width: tw, height: th } = captureLastContentSize
    if (Math.abs(cw - tw) <= 1 && Math.abs(ch - th) <= 1) return
    captureResizeClamp = true
    try {
      captureWindow.setContentSize(tw, th)
    } finally {
      captureResizeClamp = false
    }
  })

  loadCaptureUrl(win)

  win.once('ready-to-show', () => {
    positionCaptureBottomRight(win)
    win.show()
    win.focus()
  })

  win.on('closed', () => {
    captureWindow = null
    destroyTray()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function enterQuickCaptureFromMain(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.hide()
  buildTray()
  ensureCaptureWindow()
}

function exitQuickCaptureFromMain(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.close()
    return
  }
  destroyTray()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  }
}

/** 개발/빌드 산출물에 따라 preload 파일명이 `.cjs` 또는 `.mjs`일 수 있음 */
function preloadScriptPath(): string {
  const preloadDir = path.resolve(__dirname, '../preload')
  for (const name of ['index.cjs', 'index.mjs', 'index.js']) {
    const full = path.join(preloadDir, name)
    if (fsSync.existsSync(full)) return full
  }
  console.error('[main] Preload not found in', preloadDir)
  return path.join(preloadDir, 'index.cjs')
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function dataRoot(): string {
  return path.join(app.getAppPath(), 'data')
}

async function readJsonl<T>(relativePath: string): Promise<T[]> {
  const full = path.join(dataRoot(), relativePath)
  try {
    const raw = await fs.readFile(full, 'utf-8')
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T)
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code === 'ENOENT') return []
    throw err
  }
}

async function writeTagsJsonlAtomic(tags: TagRecord[]): Promise<void> {
  const full = path.join(dataRoot(), 'tags.jsonl')
  const dir = path.dirname(full)
  await fs.mkdir(dir, { recursive: true })
  const tmp = `${full}.${process.pid}.tmp`
  const body = tags.map((t) => JSON.stringify({ tagId: t.tagId, name: t.name })).join('\n')
  await fs.writeFile(tmp, body ? `${body}\n` : '', 'utf-8')
  await fs.rename(tmp, full)
}

function newUniqueTagId(existingIds: Set<string>): string {
  for (let i = 0; i < 24; i++) {
    const id = `tag_${randomBytes(6).toString('hex')}`
    if (!existingIds.has(id)) return id
  }
  throw new Error('createTag: could not allocate tag id')
}

function isTagRecord(value: unknown): value is TagRecord {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return typeof t.tagId === 'string' && typeof t.name === 'string'
}

function dailyFilePath(isoDate: string): string {
  return path.join(dataRoot(), 'daily', `${isoDate}_daily.json`)
}

function emptyDaily(isoDate: string): DailyJournalFile {
  return {
    date: isoDate,
    journal: '',
    logs: [],
    todos: [],
  }
}

function isTodoItem(value: unknown): value is TodoItem {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return typeof t.todoId === 'string' && typeof t.title === 'string' && typeof t.done === 'boolean'
}

/** 디스크 등: `todos` 생략 허용 */
function validateDailyJournalLoose(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.date !== 'string' || typeof v.journal !== 'string' || !Array.isArray(v.logs)) return false
  for (const log of v.logs) {
    if (!isLogEntry(log)) return false
  }
  if (v.todos !== undefined && (!Array.isArray(v.todos) || !v.todos.every(isTodoItem))) return false
  return true
}

/** 저장: `todos` 필수·유효 */
function validateDailyJournalForSave(value: unknown): value is DailyJournalFile {
  if (!validateDailyJournalLoose(value)) return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.todos) && v.todos.every(isTodoItem)
}

function normalizeDailyJournal(value: unknown, isoDate: string): DailyJournalFile | null {
  if (!validateDailyJournalLoose(value)) return null
  const v = value as Record<string, unknown>
  const todosRaw = v['todos']
  const todos =
    Array.isArray(todosRaw) && todosRaw.every(isTodoItem) ? (todosRaw as TodoItem[]) : []
  return {
    date: typeof v.date === 'string' ? v.date : isoDate,
    journal: typeof v.journal === 'string' ? v.journal : '',
    logs: v.logs as LogEntry[],
    todos,
  }
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== 'object') return false
  const l = value as Record<string, unknown>
  return (
    typeof l.logId === 'string' &&
    typeof l.type === 'string' &&
    typeof l.detail === 'string' &&
    Array.isArray(l.categoryIds) &&
    Array.isArray(l.tagIds) &&
    l.categoryIds.every((id) => typeof id === 'string') &&
    l.tagIds.every((id) => typeof id === 'string')
  )
}

async function dailyDir(): Promise<string> {
  const d = path.join(dataRoot(), 'daily')
  await fs.mkdir(d, { recursive: true })
  return d
}

async function listDailyJsonFiles(): Promise<Array<{ isoDate: string; filePath: string }>> {
  const dir = await dailyDir()
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code === 'ENOENT') return []
    throw err
  }
  const out: Array<{ isoDate: string; filePath: string }> = []
  for (const name of names) {
    const m = name.match(/^(\d{4}-\d{2}-\d{2})_daily\.json$/)
    if (m) {
      out.push({ isoDate: m[1], filePath: path.join(dir, name) })
    }
  }
  return out
}

/** 단일 일별 JSON 파일 읽기 — READ_DAILY 와 동일 규칙 */
async function loadDailyFromPath(filePath: string, isoDate: string): Promise<DailyJournalFile> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const trimmed = raw.trim()
    if (!trimmed) {
      return emptyDaily(isoDate)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch (e) {
      if (e instanceof SyntaxError) {
        console.warn(`[main] loadDailyFromPath: invalid JSON — ${filePath}`)
        return emptyDaily(isoDate)
      }
      throw e
    }
    const normalized = normalizeDailyJournal(parsed, isoDate)
    if (!normalized) {
      console.warn(`[main] loadDailyFromPath: invalid shape — ${filePath}`)
      return emptyDaily(isoDate)
    }
    if (normalized.date !== isoDate) {
      normalized.date = isoDate
    }
    return normalized
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code === 'ENOENT') {
      return emptyDaily(isoDate)
    }
    throw err
  }
}

async function writeDailyFileAtomic(daily: DailyJournalFile, targetPath: string): Promise<void> {
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = `${targetPath}.${process.pid}.tmp`
  const json = JSON.stringify(daily, null, 2)
  await fs.writeFile(tmp, json, 'utf-8')
  await fs.rename(tmp, targetPath)
}

async function countTagUsageOnDisk(tagId: string): Promise<number> {
  let n = 0
  for (const { filePath, isoDate } of await listDailyJsonFiles()) {
    const daily = await loadDailyFromPath(filePath, isoDate)
    for (const log of daily.logs) {
      if (log.tagIds.includes(tagId)) n++
    }
  }
  return n
}

async function aggregateDailyRange(from: string, to: string): Promise<AggregateRangeResult> {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw new Error('aggregateRange: invalid ISO date')
  }
  if (from > to) {
    throw new Error('aggregateRange: from must be <= to')
  }
  const days: DayAggregateRow[] = []
  for (const { isoDate, filePath } of await listDailyJsonFiles()) {
    if (isoDate < from || isoDate > to) continue
    const daily = await loadDailyFromPath(filePath, isoDate)
    const typeCounts: Record<string, number> = {}
    const categoryCounts: Record<string, number> = {}
    const tagCounts: Record<string, number> = {}
    for (const log of daily.logs) {
      typeCounts[log.type] = (typeCounts[log.type] ?? 0) + 1
      for (const c of log.categoryIds) {
        categoryCounts[c] = (categoryCounts[c] ?? 0) + 1
      }
      for (const t of log.tagIds) {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1
      }
    }
    days.push({
      date: isoDate,
      logCount: daily.logs.length,
      typeCounts,
      categoryCounts,
      tagCounts,
    })
  }
  days.sort((a, b) => a.date.localeCompare(b.date))
  return { days }
}

function addCalendarDaysIso(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split('-').map(Number)
  const y = parts[0]!
  const m = parts[1]!
  const d = parts[2]!
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function enumerateDatesInclusive(from: string, to: string): string[] {
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

/** 로그 1건 이상인 날만 연속 일수(streak), 카드용 최근 35일(7×5) 히트맵 */
async function computeCardInsights(asOf: string): Promise<CardInsightsResult> {
  if (!ISO_DATE.test(asOf)) {
    throw new Error('cardInsights: invalid ISO date')
  }
  const streakSearchDays = 800
  const heatmapDays = 35
  const wideFrom = addCalendarDaysIso(asOf, -streakSearchDays)
  const agg = await aggregateDailyRange(wideFrom, asOf)
  const counts = new Map<string, number>()
  for (const row of agg.days) {
    counts.set(row.date, row.logCount)
  }

  let streak = 0
  let d = asOf
  for (let i = 0; i < streakSearchDays + 1; i++) {
    if ((counts.get(d) ?? 0) === 0) break
    streak++
    d = addCalendarDaysIso(d, -1)
  }

  const heatmapFrom = addCalendarDaysIso(asOf, -(heatmapDays - 1))
  const heatmap = enumerateDatesInclusive(heatmapFrom, asOf).map((date) => ({
    date,
    logCount: counts.get(date) ?? 0,
  }))

  return { streak, heatmap }
}

async function stripTagFromDailyFilesOnDisk(tagId: string, skipIsoDate?: string): Promise<void> {
  for (const { filePath, isoDate } of await listDailyJsonFiles()) {
    if (skipIsoDate && isoDate === skipIsoDate) continue
    const daily = await loadDailyFromPath(filePath, isoDate)
    let changed = false
    const logs = daily.logs.map((log) => {
      if (!log.tagIds.includes(tagId)) return log
      changed = true
      return { ...log, tagIds: log.tagIds.filter((id) => id !== tagId) }
    })
    if (changed) {
      await writeDailyFileAtomic({ ...daily, logs }, filePath)
    }
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.READ_TYPES, async (): Promise<TypeRecord[]> => readJsonl<TypeRecord>('types.jsonl'))

  ipcMain.handle(IPC_CHANNELS.READ_CATEGORIES, async (): Promise<CategoryRecord[]> =>
    readJsonl<CategoryRecord>('categories.jsonl'),
  )

  ipcMain.handle(IPC_CHANNELS.READ_TAGS, async (): Promise<TagRecord[]> => readJsonl<TagRecord>('tags.jsonl'))

  ipcMain.handle(IPC_CHANNELS.CREATE_TAG, async (_event, payload: unknown): Promise<TagRecord> => {
    if (!payload || typeof payload !== 'object') throw new Error('createTag: invalid payload')
    const nameRaw = (payload as Record<string, unknown>)['name']
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
    if (!name) throw new Error('createTag: name is required')
    const tags = await readJsonl<TagRecord>('tags.jsonl')
    if (!tags.every(isTagRecord)) throw new Error('createTag: corrupt tags file')
    const ids = new Set(tags.map((t) => t.tagId))
    const tagId = newUniqueTagId(ids)
    const record: TagRecord = { tagId, name }
    tags.push(record)
    await writeTagsJsonlAtomic(tags)
    return record
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_TAG, async (_event, payload: unknown): Promise<TagRecord> => {
    if (!payload || typeof payload !== 'object') throw new Error('updateTag: invalid payload')
    const p = payload as Record<string, unknown>
    const tagId = p['tagId']
    const nameRaw = p['name']
    if (typeof tagId !== 'string' || !tagId.startsWith('tag_')) throw new Error('updateTag: invalid tagId')
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
    if (!name) throw new Error('updateTag: name is required')
    const tags = await readJsonl<TagRecord>('tags.jsonl')
    const idx = tags.findIndex((t) => t.tagId === tagId)
    if (idx === -1) throw new Error('updateTag: tag not found')
    tags[idx] = { tagId, name }
    await writeTagsJsonlAtomic(tags)
    return tags[idx]
  })

  ipcMain.handle(IPC_CHANNELS.COUNT_TAG_USAGE, async (_event, tagId: unknown): Promise<number> => {
    if (typeof tagId !== 'string' || !tagId.startsWith('tag_')) throw new Error('countTagUsage: invalid tagId')
    return countTagUsageOnDisk(tagId)
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_TAG, async (_event, payload: unknown): Promise<void> => {
    let tagId: string
    let skipIsoDate: string | undefined
    if (typeof payload === 'string') {
      tagId = payload
    } else if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>
      const tid = p['tagId']
      const skip = p['skipDailyIsoDate']
      if (typeof tid !== 'string' || !tid.startsWith('tag_')) throw new Error('deleteTag: invalid tagId')
      tagId = tid
      if (skip !== undefined) {
        if (typeof skip !== 'string' || !ISO_DATE.test(skip)) throw new Error('deleteTag: invalid skipDailyIsoDate')
        skipIsoDate = skip
      }
    } else {
      throw new Error('deleteTag: invalid payload')
    }

    const tags = await readJsonl<TagRecord>('tags.jsonl')
    const next = tags.filter((t) => t.tagId !== tagId)
    if (next.length === tags.length) throw new Error('deleteTag: tag not found')

    await stripTagFromDailyFilesOnDisk(tagId, skipIsoDate)
    await writeTagsJsonlAtomic(next)
  })

  ipcMain.handle(IPC_CHANNELS.READ_DAILY, async (_event, isoDate: unknown): Promise<DailyJournalFile> => {
    if (typeof isoDate !== 'string' || !ISO_DATE.test(isoDate)) {
      throw new Error('readDaily: invalid date (expected YYYY-MM-DD)')
    }
    const filePath = dailyFilePath(isoDate)
    return loadDailyFromPath(filePath, isoDate)
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_DAILY, async (_event, payload: unknown): Promise<void> => {
    if (!validateDailyJournalForSave(payload)) {
      throw new Error('saveDaily: invalid daily file shape (date, journal, logs, todos required)')
    }
    const { date } = payload
    if (!ISO_DATE.test(date)) {
      throw new Error('saveDaily: invalid date')
    }
    const target = dailyFilePath(date)
    await writeDailyFileAtomic(payload, target)
  })

  ipcMain.handle(
    IPC_CHANNELS.AGGREGATE_RANGE,
    async (_event, payload: unknown): Promise<AggregateRangeResult> => {
      if (!payload || typeof payload !== 'object') throw new Error('aggregateRange: invalid payload')
      const p = payload as Record<string, unknown>
      const from = p['from']
      const to = p['to']
      if (typeof from !== 'string' || typeof to !== 'string') throw new Error('aggregateRange: from/to')
      return aggregateDailyRange(from, to)
    },
  )

  ipcMain.handle(IPC_CHANNELS.CARD_INSIGHTS, async (_event, payload: unknown): Promise<CardInsightsResult> => {
    if (!payload || typeof payload !== 'object') throw new Error('cardInsights: invalid payload')
    const asOfRaw = (payload as Record<string, unknown>)['asOfDate']
    if (typeof asOfRaw !== 'string' || !ISO_DATE.test(asOfRaw)) throw new Error('cardInsights: asOfDate')
    return computeCardInsights(asOfRaw)
  })

  ipcMain.handle(
    IPC_CHANNELS.SAVE_PNG_DIALOG,
    async (
      _event,
      payload: unknown,
    ): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> => {
      if (!payload || typeof payload !== 'object') throw new Error('savePngDialog: invalid payload')
      const p = payload as Record<string, unknown>
      const defaultFilename = p['defaultFilename']
      const bytes = p['bytes']
      if (typeof defaultFilename !== 'string') throw new Error('savePngDialog: defaultFilename')
      if (!Array.isArray(bytes) || !bytes.every((b) => typeof b === 'number')) {
        throw new Error('savePngDialog: bytes must be number[]')
      }
      const dialogOpts = {
        defaultPath: defaultFilename,
        filters: [{ name: 'PNG 이미지', extensions: ['png'] }],
      }
      const parent =
        (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null) ??
        (captureWindow && !captureWindow.isDestroyed() ? captureWindow : null) ??
        BrowserWindow.getFocusedWindow()
      const { filePath, canceled } =
        parent && !parent.isDestroyed()
          ? await dialog.showSaveDialog(parent, dialogOpts)
          : await dialog.showSaveDialog(dialogOpts)
      if (canceled || !filePath) {
        return { ok: false, canceled: true }
      }
      await fs.writeFile(filePath, Uint8Array.from(bytes))
      return { ok: true, filePath }
    },
  )

  ipcMain.handle(IPC_CHANNELS.APPEND_LOG, async (_event, payload: unknown): Promise<{ ok: true; logId: string }> => {
    return runAppendSerialized(async () => {
      if (!payload || typeof payload !== 'object') throw new Error('appendLog: invalid payload')
      const p = payload as Record<string, unknown>
      const isoDate = p['isoDate']
      const detailRaw = p['detail']
      if (typeof isoDate !== 'string' || !ISO_DATE.test(isoDate)) {
        throw new Error('appendLog: isoDate (YYYY-MM-DD)')
      }
      const detail = typeof detailRaw === 'string' ? detailRaw.trim() : ''
      if (!detail) throw new Error('appendLog: detail is required')

      const types = await readJsonl<TypeRecord>('types.jsonl')
      let typeId: string | undefined
      const tid = p['typeId']
      if (typeof tid === 'string' && tid.length > 0 && types.some((t) => t.typeId === tid)) {
        typeId = tid
      }
      if (!typeId) typeId = types[0]?.typeId
      if (!typeId) throw new Error('appendLog: types.jsonl is empty')

      let categoryIds: string[] = []
      const cIds = p['categoryIds']
      if (Array.isArray(cIds) && cIds.every((x) => typeof x === 'string')) {
        categoryIds = cIds as string[]
      }

      let tagIds: string[] = []
      const tIds = p['tagIds']
      if (Array.isArray(tIds) && tIds.every((x) => typeof x === 'string')) {
        tagIds = tIds as string[]
      }

      const filePath = dailyFilePath(isoDate)
      const daily = await loadDailyFromPath(filePath, isoDate)
      const log: LogEntry = {
        logId: nextLogId(isoDate, daily.logs),
        type: typeId,
        categoryIds,
        tagIds,
        detail,
      }
      daily.logs.push(log)
      await writeDailyFileAtomic(daily, filePath)
      return { ok: true, logId: log.logId }
    })
  })

  ipcMain.handle(IPC_CHANNELS.CAPTURE_ENTER_QUICK, () => {
    enterQuickCaptureFromMain()
  })

  ipcMain.handle(IPC_CHANNELS.CAPTURE_EXIT_QUICK, () => {
    exitQuickCaptureFromMain()
  })

  ipcMain.handle(IPC_CHANNELS.CAPTURE_SET_CONTENT_SIZE, (_event, payload: unknown) => {
    if (!captureWindow || captureWindow.isDestroyed()) return
    if (!payload || typeof payload !== 'object') return
    const p = payload as Record<string, unknown>
    const w = p['width']
    const h = p['height']
    if (typeof w !== 'number' || typeof h !== 'number') return
    const width = Math.max(22, Math.min(520, Math.round(w)))
    const height = Math.max(22, Math.min(720, Math.round(h)))
    captureLastContentSize = { width, height }
    const b = captureWindow.getBounds()
    const right = b.x + b.width
    const bottom = b.y + b.height
    captureWindow.setContentSize(width, height)
    const nb = captureWindow.getBounds()
    captureWindow.setPosition(right - nb.width, bottom - nb.height)
  })

  ipcMain.handle(IPC_CHANNELS.CAPTURE_MOVE_BY, (_event, payload: unknown) => {
    if (!captureWindow || captureWindow.isDestroyed()) return
    if (!payload || typeof payload !== 'object') return
    const p = payload as Record<string, unknown>
    const dx = p['dx']
    const dy = p['dy']
    if (typeof dx !== 'number' || typeof dy !== 'number') return
    if (dx === 0 && dy === 0) return
    const b = captureWindow.getBounds()
    captureWindow.setPosition(Math.round(b.x + dx), Math.round(b.y + dy))
    const { width, height } = captureLastContentSize
    captureWindow.setContentSize(width, height)
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (tray) return
    app.quit()
    mainWindow = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
