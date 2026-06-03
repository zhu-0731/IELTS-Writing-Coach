import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-filled'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variantCls: Record<Variant, string> = {
  primary:       'bg-brand text-white hover:bg-brand-hover disabled:bg-brand/50',
  secondary:     'bg-muted text-dim hover:bg-line disabled:opacity-40',
  ghost:         'text-dim hover:bg-muted disabled:opacity-40',
  danger:        'border border-danger text-danger hover:bg-danger-light disabled:opacity-40',
  'danger-filled': 'bg-danger text-white hover:bg-[#DC2626] disabled:opacity-40',
}

const sizeCls: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-1.5 font-medium rounded-btn',
        'transition-colors cursor-pointer select-none',
        'disabled:cursor-not-allowed',
        variantCls[variant],
        sizeCls[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {children}
    </button>
  )
}
