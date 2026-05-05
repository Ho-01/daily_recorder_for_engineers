import { ipcRenderer, contextBridge } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { CategoryRecord, DailyJournalFile, TagRecord, TypeRecord } from '../shared/journal'

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
}

contextBridge.exposeInMainWorld('api', api)
