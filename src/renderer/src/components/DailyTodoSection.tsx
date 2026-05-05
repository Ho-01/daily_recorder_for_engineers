import { useCallback, useState } from 'react'
import type { TodoItem } from '../types/journal'

type Props = {
  todos: TodoItem[]
  disabled: boolean
  onAdd: (title: string) => void
  onToggle: (index: number) => void
  onChangeTitle: (index: number, title: string) => void
  onRemove: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
}

export default function DailyTodoSection({
  todos,
  disabled,
  onAdd,
  onToggle,
  onChangeTitle,
  onRemove,
  onMove,
}: Props) {
  const [draft, setDraft] = useState('')

  const submit = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    onAdd(t)
    setDraft('')
  }, [draft, onAdd])

  return (
    <section className="daily-todos-section" aria-label="오늘의 할 일">
      <div className="daily-todos-head">
        <h3 className="daily-todos-title">할 일</h3>
        <span className="muted daily-todos-count">
          {todos.filter((x) => x.done).length}/{todos.length} 완료
        </span>
      </div>

      <div className="daily-todos-add">
        <input
          type="text"
          className="field-control daily-todos-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="새 할 일을 입력하고 추가"
          disabled={disabled}
          autoComplete="off"
        />
        <button type="button" className="tag-row-btn" onClick={submit} disabled={disabled || !draft.trim()}>
          추가
        </button>
      </div>

      {todos.length === 0 ? (
        <p className="muted daily-todos-empty">할 일이 없습니다. 위에서 추가해 보세요.</p>
      ) : (
        <ul className="daily-todos-list">
          {todos.map((todo, index) => (
            <li key={todo.todoId} className="daily-todo-row">
              <label className="daily-todo-check-label">
                <input
                  type="checkbox"
                  className="daily-todo-checkbox"
                  checked={todo.done}
                  onChange={() => onToggle(index)}
                  disabled={disabled}
                />
                <input
                  type="text"
                  className="field-control daily-todo-title-input"
                  value={todo.title}
                  onChange={(e) => onChangeTitle(index, e.target.value)}
                  disabled={disabled}
                  aria-label={`할 일 ${index + 1}`}
                />
              </label>
              <div className="daily-todo-actions">
                <button
                  type="button"
                  className="daily-todo-move"
                  title="위로"
                  disabled={disabled || index === 0}
                  onClick={() => onMove(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="daily-todo-move"
                  title="아래로"
                  disabled={disabled || index >= todos.length - 1}
                  onClick={() => onMove(index, 1)}
                >
                  ↓
                </button>
                <button type="button" className="daily-todo-remove" disabled={disabled} onClick={() => onRemove(index)}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
