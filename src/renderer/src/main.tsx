import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import QuickCapturePage from './pages/QuickCapturePage'
import './index.css'

function isQuickCaptureRoute(): boolean {
  const raw = window.location.hash.replace(/^#/, '')
  return raw === '/quick-capture' || raw === 'quick-capture'
}

if (isQuickCaptureRoute()) {
  document.documentElement.classList.add('quick-capture-html')
  document.body.classList.add('quick-capture-body')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isQuickCaptureRoute() ? <QuickCapturePage /> : <App />}
  </React.StrictMode>,
)
