interface Props {
  icon?: string
  message: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {icon && (
        <span className="text-2xl mb-3 opacity-50">{icon}</span>
      )}
      <p className="text-sm text-ghost leading-relaxed max-w-[200px]">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 text-xs text-brand hover:text-brand-hover font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
