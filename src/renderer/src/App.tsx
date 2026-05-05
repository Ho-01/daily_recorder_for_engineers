import { useState } from 'react'
import DailyPage from './pages/DailyPage'
import TagManagePage from './pages/TagManagePage'
import VisualizePage from './pages/VisualizePage'
import './App.css'

type PageId = 'daily' | 'tags' | 'visualize'

export default function App() {
  const [page, setPage] = useState<PageId>('daily')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-brand">
          <h1 className="app-title">Daily Recorder for Engineers</h1>
          <span className="app-version" aria-label={`앱 버전 ${import.meta.env.VITE_APP_VERSION}`}>
            v{import.meta.env.VITE_APP_VERSION}
          </span>
        </div>
        <nav className="app-nav" aria-label="주요 화면">
          <button type="button" className={page === 'daily' ? 'active' : ''} onClick={() => setPage('daily')}>
            Daily
          </button>
          <button type="button" className={page === 'tags' ? 'active' : ''} onClick={() => setPage('tags')}>
            태그 관리
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
      <main className="app-main">
        {page === 'daily' ? <DailyPage /> : page === 'tags' ? <TagManagePage /> : <VisualizePage />}
      </main>
    </div>
  )
}
