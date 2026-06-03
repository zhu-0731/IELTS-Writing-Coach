interface Tab {
  key: string
  label: string
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export default function Tabs({ tabs, active, onChange, className = '' }: Props) {
  return (
    <div className={`flex border-b border-line ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            'flex-1 py-2.5 text-xs font-medium transition-colors',
            active === tab.key
              ? 'text-brand border-b-2 border-brand -mb-px'
              : 'text-ghost hover:text-dim',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
