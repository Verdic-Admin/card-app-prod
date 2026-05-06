'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface CardSetTypeaheadProps {
  value: string
  onChange: (val: string) => void
  onBlur?: (val: string) => void
  className?: string
  placeholder?: string
  /** When provided, limits results to sets that exist for this player */
  playerName?: string
}

export default function CardSetTypeahead({
  value,
  onChange,
  onBlur,
  className,
  placeholder = 'Card Set',
  playerName,
}: CardSetTypeaheadProps) {
  const [open, setOpen]           = useState(false)
  const [options, setOptions]     = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [focusIdx, setFocusIdx]   = useState(-1)
  const [inputText, setInputText] = useState(value)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const debouncedSearch = useDebounce(inputText, 280)
  const debouncedPlayer = useDebounce(playerName ?? '', 280)

  // Keep in sync with external value changes
  useEffect(() => { setInputText(value) }, [value])

  // Refetch whenever search text OR player context changes
  useEffect(() => {
    const hasQuery  = debouncedSearch.length >= 1
    const hasPlayer = debouncedPlayer.length >= 2

    // Need either 2+ chars typed OR a confirmed player name to show anything
    if (!hasQuery && !hasPlayer) { setOptions([]); return }

    let cancelled = false
    setIsLoading(true)

    const params = new URLSearchParams({ field: 'card_set' })
    if (debouncedSearch.length >= 1) params.set('q', debouncedSearch)
    if (hasPlayer) params.set('player', debouncedPlayer)

    fetch(`/api/admin/typeahead?${params.toString()}`)
      .then(r => r.json())
      .then(({ results }) => { if (!cancelled) setOptions(results ?? []) })
      .catch(() => { if (!cancelled) setOptions([]) })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [debouncedSearch, debouncedPlayer])

  // When player changes and field is empty, show all sets for that player immediately
  useEffect(() => {
    if (debouncedPlayer.length >= 2 && inputText === '') {
      setOpen(true)
    }
  }, [debouncedPlayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      ;(listRef.current.children[focusIdx] as HTMLElement)?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusIdx])

  const select = useCallback((label: string) => {
    setInputText(label)
    onChange(label)
    onBlur?.(label)
    setOpen(false)
    setFocusIdx(-1)
  }, [onChange, onBlur])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown')       { e.preventDefault(); setFocusIdx(p => Math.min(p + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); setFocusIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && focusIdx >= 0 && options[focusIdx]) { e.preventDefault(); select(options[focusIdx]) }
    else if (e.key === 'Escape')     { setOpen(false) }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={inputText}
        onChange={e => { setInputText(e.target.value); onChange(e.target.value); setOpen(true); setFocusIdx(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={e => {
          setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) { setOpen(false); onBlur?.(e.target.value) }
          }, 150)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full ${className || ''}`}
      />

      {open && (isLoading || options.length > 0) && (
        <ul ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-60 overflow-y-auto
                     bg-surface border border-border rounded-md shadow-xl">
          {isLoading
            ? <li className="px-3 py-2 text-xs text-muted italic text-center">
                {playerName ? `Loading sets for ${playerName.split(' ').pop()}…` : 'Searching…'}
              </li>
            : options.map((opt, i) => (
                <li key={opt}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => select(opt)}
                  className={`px-3 py-2 text-xs cursor-pointer font-medium transition-colors border-b border-border/30 last:border-none
                    ${i === focusIdx ? 'bg-brand/20 text-brand' : 'text-foreground hover:bg-surface-hover hover:text-brand'}`}>
                  {opt}
                </li>
              ))
          }
        </ul>
      )}
    </div>
  )
}
