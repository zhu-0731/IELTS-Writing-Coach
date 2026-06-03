import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getProfileStatus } from './api/client'
import TopNav from './components/nav/TopNav'
import SetupPage from './pages/SetupPage'
import HomePage from './pages/HomePage'
import WorkspacePage from './pages/WorkspacePage'
import TemplatesPage from './pages/TemplatesPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

type InitState = 'loading' | 'setup_needed' | 'ready' | 'backend_down'

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">正在连接服务…</p>
        </div>
      </div>
    )
  }

  if (init === 'backend_down') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-md text-center">
          <div className="text-3xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">无法连接后端服务</h2>
          <p className="text-sm text-slate-500 mb-4">
            请先启动后端服务，然后刷新页面。
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-xs font-mono text-slate-600 space-y-1">
            <p># 进入后端目录</p>
            <p>cd backend</p>
            <p># 激活虚拟环境（Windows）</p>
            <p>.venv\Scripts\activate</p>
            <p># 启动服务</p>
            <p>uvicorn main:app --reload</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 px-5 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors"
          >
            重新连接
          </button>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 首次设置页（无顶部导航） */}
        <Route
          path="/setup"
          element={
            init === 'ready'
              ? <Navigate to="/" replace />
              : <SetupPage onComplete={() => setInit('ready')} />
          }
        />

        {/* 需要设置完成才能访问的页面 */}
        {init === 'setup_needed' ? (
          <Route path="*" element={<Navigate to="/setup" replace />} />
        ) : (
          <>
            <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />
            <Route path="/workspace" element={<MainLayout><WorkspacePage /></MainLayout>} />
            <Route path="/templates" element={<MainLayout><TemplatesPage /></MainLayout>} />
            <Route path="/history" element={<MainLayout><HistoryPage /></MainLayout>} />
            <Route path="/settings" element={<MainLayout><SettingsPage /></MainLayout>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
