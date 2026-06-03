import { useEffect, useRef, useState } from 'react'
import type { ModelOption } from '../../lib/modelPresets'

interface ModelSelectProps {
  value: string
  onChange: (value: string, supportsVision?: boolean) => void
  options: ModelOption[]
  providerName: string | null
  placeholder?: string
  disabled?: boolean
}

export default function ModelSelect({
  value,
  onChange,
  options,
  providerName,
  placeholder,
  disabled,
}: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const hasOptions = options.length > 0

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!hasOptions) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setHighlightIdx(0)
        } else {
          setHighlightIdx((i) => Math.min(i + 1, options.length - 1))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (isOpen) {
          setHighlightIdx((i) => Math.max(i - 1, 0))
        }
        break
      case 'Enter':
        if (isOpen && highlightIdx >= 0 && highlightIdx < options.length) {
          e.preventDefault()
          const opt = options[highlightIdx]
          onChange(opt.value, opt.supportsVision)
          setIsOpen(false)
          setHighlightIdx(-1)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightIdx(-1)
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  function selectOption(opt: ModelOption) {
    onChange(opt.value, opt.supportsVision)
    setIsOpen(false)
    setHighlightIdx(-1)
    inputRef.current?.focus()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
    setIsOpen(true)
  }

  const inputCls =
    'w-full px-3 py-2 border border-line rounded-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors'

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          className={`${inputCls} pr-8`}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (hasOptions) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {hasOptions && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ghost hover:text-dim transition-colors"
            onClick={() => {
              setIsOpen((o) => !o)
              if (!isOpen) inputRef.current?.focus()
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && hasOptions && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-line rounded-input shadow-panel max-h-72 overflow-y-auto">
          {providerName && (
            <div className="px-3 py-1.5 text-xs font-medium text-ghost bg-muted/40 border-b border-line/50">
              检测到：{providerName} 推荐模型
            </div>
          )}
          {options.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                idx === highlightIdx
                  ? 'bg-brand/8 text-ink'
                  : 'text-ink hover:bg-muted/60'
              }`}
              onMouseEnter={() => setHighlightIdx(idx)}
              onClick={() => selectOption(opt)}
            >
              <span className="font-medium">{opt.label}</span>
              {opt.value !== opt.label && (
                <span className="ml-1.5 text-xs text-ghost font-mono">
                  {opt.value}
                </span>
              )}
            </button>
          ))}
          <div className="px-3 py-1.5 text-xs text-ghost border-t border-line/50">
            也可直接输入任意模型名
          </div>
        </div>
      )}
    </div>
  )
}
