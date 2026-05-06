'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const KNOWN_PARALLELS: string[] = [
  'Base', 'Refractor', 'Chrome Refractor', 'Atomic Refractor', 'Aqua Refractor',
  'Black Refractor', 'Blue Refractor', 'Gold Refractor', 'Green Refractor',
  'Hyper Refractor', 'Orange Refractor', 'Pink Refractor', 'Purple Refractor',
  'Red Refractor', 'Rose Gold Refractor', 'Sepia Refractor', 'Shimmer Refractor',
  'Silver Refractor', 'Superfractor', 'Wave Refractor', 'X-Fractor',
  'Prizm', 'Silver Prizm', 'Hyper Prizm', 'Mojo Prizm', 'Gold Prizm', 'Blue Prizm',
  'Green Prizm', 'Orange Prizm', 'Pink Prizm', 'Purple Prizm', 'Red Prizm', 'Cracked Ice Prizm',
  'Tie-Dye Prizm', 'Disco Prizm', 'Scope Prizm', 'Neon Green Prizm',
  'Holo', 'Gold Holo', 'Blue Holo', 'Green Holo', 'Orange Holo', 'Purple Holo', 'Red Holo',
  'Black', 'Blue', 'Gold', 'Green', 'Orange', 'Pink', 'Purple', 'Red', 'Silver',
  'Teal', 'White', 'Yellow', 'Rainbow Foil', 'Gold Foil',
  '1/1', 'Printing Plate Black', 'Printing Plate Cyan', 'Printing Plate Magenta', 'Printing Plate Yellow',
  'Logoman', 'Superfractor', 'Masterpiece',
  '1st Bowman', 'Bowman Blue', 'Bowman Purple', 'Bowman Gold', 'Bowman Red', 'Bowman Black',
  'Memorial Day Camo', "Mother's Day Hot Pink", "Father's Day Blue",
  'Target Red', 'Walmart Blue',
].sort((a, b) => a.localeCompare(b))

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface ParallelTypeaheadProps {
  value: string
  onChange: (val: string) => void
  onBlur?: (val: string) => void
  className?: string
  cardSet?: string
}

export default function ParallelTypeahead({
  value, onChange, onBlur, className, cardSet,
}: ParallelTypeaheadProps) {
  const [open, setOpen]           = useState(false)
  const [options, setOptions]     = useState<string[]>(KNOWN_PARALLELS)
  const [isLoading, setIsLoading] = useState(false)
  const [focusIdx, setFocusIdx]   = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const debouncedValue = useDebounce(value,       280)
  const debouncedSet   = useDebounce(cardSet ?? '', 280)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const params = new URLSearchParams({ field: 'parallel_name' })
    if (debouncedValue.length >= 1) params.set('q', debouncedValue)
    if (debouncedSet)               params.set('set', debouncedSet)

    if (!debouncedValue && !debouncedSet) {
      setOptions(KNOWN_PARALLELS)
      setIsLoading(false)
      return
    }

    fetch(`/api/admin/typeahead?${params.toString()}`)
      .then(r => r.json())
      .then(({ results }) => {
        if (!cancelled) setOptions(results?.length > 0 ? results : KNOWN_PARALLELS)
      })
      .catch(() => { if (!cancelled) setOptions(KNOWN_PARALLELS) })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [debouncedValue, debouncedSet])

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
        placeholder="Parallel"
        autoComplete="off"
        className={`w-full ${className || ''}`}
      />
      {open && (isLoading || displayOptions.length > 0) && (
        <ul ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-52 overflow-y-auto
                     bg-surface border border-border rounded-md shadow-xl">
          {isLoading
            ? <li className="px-3 py-2 text-xs text-muted italic text-center">
                {cardSet ? `Loading parallels for ${cardSet}…` : 'Searching…'}
              </li>
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
