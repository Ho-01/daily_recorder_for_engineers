import type { TodoItem } from '../types/journal'

/** Next `todo_YYYYMMDD_###` id unique within the same daily file. */
export function nextTodoId(isoDate: string, todos: TodoItem[]): string {
  const compact = isoDate.replace(/-/g, '')
  const prefix = `todo_${compact}_`
  let max = 0
  const re = new RegExp(`^${prefix}(\\d{3})$`)
  for (const t of todos) {
    const m = t.todoId.match(re)
    if (m) max = Math.max(max, Number.parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}
