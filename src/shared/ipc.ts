/** IPC channel names — keep in sync across main, preload, renderer services */
export const IPC_CHANNELS = {
  READ_TYPES: 'journal:readTypes',
  READ_CATEGORIES: 'journal:readCategories',
  READ_TAGS: 'journal:readTags',
  CREATE_TAG: 'journal:createTag',
  UPDATE_TAG: 'journal:updateTag',
  COUNT_TAG_USAGE: 'journal:countTagUsage',
  DELETE_TAG: 'journal:deleteTag',
  READ_DAILY: 'journal:readDaily',
  SAVE_DAILY: 'journal:saveDaily',
  AGGREGATE_RANGE: 'journal:aggregateRange',
  CARD_INSIGHTS: 'journal:cardInsights',
  SAVE_PNG_DIALOG: 'journal:savePngDialog',
} as const
