import { ipcRenderer, contextBridge } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { CategoryRecord, DailyJournalFile, TagRecord, TypeRecord } from '../shared/journal'
import type { CardInsightsResult } from '../shared/cardInsights'
import type { AggregateRangeResult } from '../shared/visualization'

const api = {
  readTypes(): Promise<TypeRecord[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.READ_TYPES)
  },
  readCategories(): Promise<CategoryRecord[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.READ_CATEGORIES)
  },
  readTags(): Promise<TagRecord[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.READ_TAGS)
  },
  createTag(name: string): Promise<TagRecord> {
    return ipcRenderer.invoke(IPC_CHANNELS.CREATE_TAG, { name })
  },
  updateTag(tagId: string, name: string): Promise<TagRecord> {
    return ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TAG, { tagId, name })
  },
  countTagUsage(tagId: string): Promise<number> {
    return ipcRenderer.invoke(IPC_CHANNELS.COUNT_TAG_USAGE, tagId)
  },
  deleteTag(tagId: string, skipDailyIsoDate?: string): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_TAG, { tagId, skipDailyIsoDate })
  },
  readDaily(isoDate: string): Promise<DailyJournalFile> {
    return ipcRenderer.invoke(IPC_CHANNELS.READ_DAILY, isoDate)
  },
  saveDaily(file: DailyJournalFile): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_DAILY, file)
  },
  aggregateRange(from: string, to: string): Promise<AggregateRangeResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.AGGREGATE_RANGE, { from, to })
  },
  cardInsights(asOfDate: string): Promise<CardInsightsResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.CARD_INSIGHTS, { asOfDate })
  },
  savePngDialog(
    defaultFilename: string,
    bytes: number[],
  ): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_PNG_DIALOG, { defaultFilename, bytes })
  },
}

contextBridge.exposeInMainWorld('api', api)
