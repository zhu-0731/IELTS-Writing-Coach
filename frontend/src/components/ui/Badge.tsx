import { type ReactNode } from 'react'

type Variant = 'neutral' | 'blue' | 'yellow' | 'green' | 'red'

interface Props {
  variant?: Variant
  children: ReactNode
  className?: string
}

const cls: Record<Variant, string> = {
  neutral: 'bg-muted text-dim',
  blue:    'bg-brand-muted text-brand',
  yellow:  'bg-warn-light text-warn',
  green:   'bg-ok-light text-ok',
  red:     'bg-danger-light text-danger',
}

export default function Badge({ variant = 'neutral', children, className = '' }: Props) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        cls[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
