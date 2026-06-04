import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getProfileStatus } from './api/client'
import { copy } from './i18n'
import TopNav from './components/nav/TopNav'
import Button from './components/ui/Button'
import SetupPage from './pages/SetupPage'
import HomePage from './pages/HomePage'
import WorkspacePage from './pages/WorkspacePage'
import TemplatesPage from './pages/TemplatesPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import PracticePage from './pages/PracticePage'
import DiagnosisReviewPage from './pages/DiagnosisReviewPage'

type InitState = 'loading' | 'setup_needed' | 'ready' | 'backend_down'

const c = copy.app

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <TopNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}

export default function App() {
  const [init, setInit] = useState<InitState>('loading')

  useEffect(() => {
    getProfileStatus()
      .then(({ is_setup_complete }) =>
        setInit(is_setup_complete ? 'ready' : 'setup_needed'),
      )
      .catch(() => setInit('backend_down'))
  }, [])

  if (init === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-ghost">{c.loading}</p>
        </div>
      </div>
    )
  }

  if (init === 'backend_down') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
        <div className="bg-surface rounded-panel shadow-panel border border-line p-8 max-w-md w-full text-center">
          <div className="text-3xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-ink mb-2">{c.backendDown.title}</h2>
          <p className="text-sm text-dim mb-5">{c.backendDown.desc}</p>
          <div className="bg-muted rounded-card p-4 text-left text-xs font-mono text-dim space-y-1 mb-5">
            {c.backendDown.cmds.map((line, i) => (
              <p key={i} className={line.startsWith('#') ? 'text-ghost' : ''}>{line}</p>
            ))}
          </div>
          <Button variant="primary" onClick={() => window.location.reload()}>
            {c.backendDown.retry}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/setup"
          element={
            init === 'ready'
              ? <Navigate to="/" replace />
              : <SetupPage onComplete={() => setInit('ready')} />
          }
        />

        {init === 'setup_needed' ? (
          <Route path="*" element={<Navigate to="/setup" replace />} />
        ) : (
          <>
            <Route path="/"          element={<MainLayout><HomePage /></MainLayout>} />
            <Route path="/workspace" element={<MainLayout><WorkspacePage /></MainLayout>} />
            <Route path="/templates" element={<MainLayout><TemplatesPage /></MainLayout>} />
            <Route path="/history"   element={<MainLayout><HistoryPage /></MainLayout>} />
            <Route path="/settings"  element={<MainLayout><SettingsPage /></MainLayout>} />
            <Route path="/practice/:sessionId" element={<MainLayout><PracticePage /></MainLayout>} />
            <Route path="/diagnosis/review" element={<MainLayout><DiagnosisReviewPage /></MainLayout>} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
