'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const KNOWN_INSERTS: string[] = [
  'All-Etch', 'Blank Slate', 'Color Blast', 'Crusade', 'Downtown', 'Elite Dominators',
  'Galactic', 'Gems', 'Genesis', 'Heavy Lumber', 'Home Field Advantage', 'Jambalaya',
  'Kaboom', 'Manga', 'Micro Mosaic', 'Mythical', 'Net Marvels', 'Night Moves',
  'On the Horizon', 'Peacock', 'Precious Metal Gems', 'Rated Rookie', 'Rookie Ticket',
  'Spectra', 'Stained Glass', 'Stars of MLB', 'Tiger Stripe', 'Topps Black Gold',
  'White Sparkle', 'Zebra',
].sort((a, b) => a.localeCompare(b))

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface InsertTypeaheadProps {
  value: string
  onChange: (val: string) => void
  onBlur?: (val: string) => void
  className?: string
  playerName?: string
  cardSet?: string
}

export default function InsertTypeahead({
  value, onChange, onBlur, className, playerName, cardSet,
}: InsertTypeaheadProps) {
  const [open, setOpen]           = useState(false)
  const [options, setOptions]     = useState<string[]>(KNOWN_INSERTS)
  const [isLoading, setIsLoading] = useState(false)
  const [focusIdx, setFocusIdx]   = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const debouncedValue  = useDebounce(value,      280)
  const debouncedPlayer = useDebounce(playerName ?? '', 280)
  const debouncedSet    = useDebounce(cardSet    ?? '', 280)

  // Fetch on keystroke — context-filtered when player+set available
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const params = new URLSearchParams({ field: 'insert_name' })
    if (debouncedValue.length >= 1) params.set('q', debouncedValue)
    if (debouncedPlayer)            params.set('player', debouncedPlayer)
    if (debouncedSet)               params.set('set', debouncedSet)

    // If no query and no context, show static fallback immediately
    if (!debouncedValue && !debouncedPlayer && !debouncedSet) {
      setOptions(KNOWN_INSERTS)
      setIsLoading(false)
      return
    }

    fetch(`/api/admin/typeahead?${params.toString()}`)
      .then(r => r.json())
      .then(({ results }) => {
        if (!cancelled) setOptions(results?.length > 0 ? results : KNOWN_INSERTS)
      })
      .catch(() => { if (!cancelled) setOptions(KNOWN_INSERTS) })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [debouncedValue, debouncedPlayer, debouncedSet])

  // Filter shown list against what's typed (client-side after fetch)
  const displayOptions = value.trim()
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase())).slice(0, 20)
    : options.slice(0, 30)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      ;(listRef.current.children[focusIdx] as HTMLElement)?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusIdx])

  const select = useCallback((label: string) => {
    onChange(label); onBlur?.(label); setOpen(false); setFocusIdx(-1)
  }, [onChange, onBlur])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() } return }
    if (e.key === 'ArrowDown')       { e.preventDefault(); setFocusIdx(p => Math.min(p + 1, displayOptions.length - 1)) }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); setFocusIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && focusIdx >= 0 && displayOptions[focusIdx]) { e.preventDefault(); select(displayOptions[focusIdx]) }
    else if (e.key === 'Escape')     { setOpen(false) }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(true); setFocusIdx(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={e => {
          setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) { setOpen(false); onBlur?.(e.target.value) }
          }, 150)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Insert"
        autoComplete="off"
        className={`w-full ${className || ''}`}
      />
      {open && (isLoading || displayOptions.length > 0) && (
        <ul ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-52 overflow-y-auto
                     bg-surface border border-border rounded-md shadow-xl">
          {isLoading
            ? <li className="px-3 py-2 text-xs text-muted italic text-center">Searching…</li>
            : displayOptions.map((opt, i) => (
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
