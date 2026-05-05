import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { IPC_CHANNELS } from '../shared/ipc'
import type { CategoryRecord, DailyJournalFile, LogEntry, TagRecord, TypeRecord } from '../shared/journal'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

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
  }
}

function isDailyJournalFile(value: unknown): value is DailyJournalFile {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.date !== 'string' || typeof v.journal !== 'string' || !Array.isArray(v.logs)) return false
  for (const log of v.logs) {
    if (!isLogEntry(log)) return false
  }
  return true
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
    if (!isDailyJournalFile(parsed)) {
      console.warn(`[main] loadDailyFromPath: invalid shape — ${filePath}`)
      return emptyDaily(isoDate)
    }
    if (parsed.date !== isoDate) {
      parsed.date = isoDate
    }
    return parsed
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
    if (!isDailyJournalFile(payload)) {
      throw new Error('saveDaily: invalid daily file shape')
    }
    const { date } = payload
    if (!ISO_DATE.test(date)) {
      throw new Error('saveDaily: invalid date')
    }
    const target = dailyFilePath(date)
    await writeDailyFileAtomic(payload, target)
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
