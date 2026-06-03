import { type ReactNode } from 'react'

type Padding = 'none' | 'sm' | 'md' | 'lg'

interface Props {
  children: ReactNode
  padding?: Padding
  className?: string
  as?: 'div' | 'section' | 'article'
}

const paddingCls: Record<Padding, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
}

export default function Card({ children, padding = 'md', className = '', as: Tag = 'div' }: Props) {
  return (
    <Tag
      className={[
        'bg-surface rounded-card border border-line shadow-card',
        paddingCls[padding],
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  )
}
