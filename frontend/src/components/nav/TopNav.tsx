import { NavLink, useNavigate } from 'react-router-dom'
import { copy } from '../../i18n'
import Button from '../ui/Button'

const c = copy.nav

const NAV_ITEMS = [
  { to: '/',          label: c.home,      end: true },
  { to: '/workspace', label: c.workspace },
  { to: '/templates', label: c.templates },
  { to: '/history',   label: c.history   },
]

const WORKSPACE_KEYS = [
  'workspace_active_task',
  'workspace_draft_task1',
  'workspace_draft_task2',
  'workspace_idea',
  'workspace_expression',
]

export default function TopNav() {
  const navigate = useNavigate()

  const startNew = () => {
    WORKSPACE_KEYS.forEach((k) => sessionStorage.removeItem(k))
    navigate('/workspace')
  }

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-40 h-14">
      <div className="w-full max-w-[1180px] mx-auto px-6 md:px-8 h-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(190px,1fr)_auto_minmax(190px,1fr)] items-center gap-4">
        {/* Brand */}
        <button
          onClick={() => navigate('/')}
          className="justify-self-start text-sm font-semibold text-ink hover:text-brand transition-colors tracking-tight"
        >
          {copy.app.brand}
        </button>

        {/* Main nav */}
        <nav className="hidden sm:flex items-center justify-center gap-0.5 bg-muted/70 rounded-card p-1">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'px-3 py-1.5 rounded-btn text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-light text-brand'
                    : 'text-dim hover:text-ink hover:bg-muted',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right */}
        <div className="justify-self-end flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={startNew}
            className="hidden sm:inline-flex"
          >
            {c.startNew}
          </Button>
          <NavLink
            to="/settings"
            title={c.settings}
            className={({ isActive }) =>
              [
                'p-2 rounded-btn transition-colors',
                isActive ? 'text-brand bg-brand-light' : 'text-ghost hover:text-dim hover:bg-muted',
              ].join(' ')
            }
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </NavLink>
        </div>
      </div>
    </header>
  )
}
