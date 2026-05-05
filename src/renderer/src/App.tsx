import { useState } from 'react'
import DailyPage from './pages/DailyPage'
import VisualizePage from './pages/VisualizePage'
import './App.css'

type PageId = 'daily' | 'visualize'

export default function App() {
  const [page, setPage] = useState<PageId>('daily')

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">성장 기록</h1>
        <nav className="app-nav" aria-label="주요 화면">
          <button type="button" className={page === 'daily' ? 'active' : ''} onClick={() => setPage('daily')}>
            Daily
          </button>
          <button
            type="button"
            className={page === 'visualize' ? 'active' : ''}
            onClick={() => setPage('visualize')}
          >
            Visualize
          </button>
        </nav>
      </header>
      <main className="app-main">{page === 'daily' ? <DailyPage /> : <VisualizePage />}</main>
    </div>
  )
}
