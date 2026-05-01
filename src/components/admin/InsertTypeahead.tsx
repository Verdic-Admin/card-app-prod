'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

/**
 * Comprehensive list of known baseball/sports card inserts.
 * Sorted alphabetically for display.
 */
const KNOWN_INSERTS: string[] = [
  'All-Etch', 'Blank Slate', 'Color Blast', 'Downtown', 'Gems', 
  'Genesis', 'Heavy Lumber', 'Home Field Advantage', 'Kaboom', 
  'Manga', 'Micro Mosaic', 'Mythical', 'Net Marvels', 'Night Moves', 
  'On the Horizon', 'Peacock', 'Stained Glass', 'Stars of MLB', 
  'Tiger Stripe', 'Topps Black Gold', 'Zebra', 'Crusade', 'Elite Dominators',
  'Galactic', 'Jambalaya', 'Precious Metal Gems', 'Rated Rookie', 'Rookie Ticket',
  'Spectra', 'White Sparkle'
].sort((a, b) => a.localeCompare(b))

/**
 * Simple fuzzy/token match — checks if every token in the query
 * appears somewhere in the candidate (case-insensitive).
 * "chrome ref" matches "Chrome Refractor"
 * "gold 25" matches "Gold /25"
 */
function fuzzyMatch(query: string, candidate: string): { match: boolean; score: number } {
  const q = query.toLowerCase().trim()
  const c = candidate.toLowerCase()

  if (!q) return { match: true, score: 0 }

  // Exact start match gets highest score
  if (c.startsWith(q)) return { match: true, score: 3 }

  // Full substring match
  if (c.includes(q)) return { match: true, score: 2 }

  // Token-based: every word in query must appear in candidate
  const tokens = q.split(/\s+/)
  const allPresent = tokens.every(t => c.includes(t))
  if (allPresent) return { match: true, score: 1 }

  return { match: false, score: 0 }
}

interface InsertTypeaheadProps {
  value: string
  onChange: (val: string) => void
  onBlur?: (val: string) => void
  className?: string
}

export default function InsertTypeahead({ value, onChange, onBlur, className }: InsertTypeaheadProps) {
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const suggestions = useMemo(() => {
    if (!value?.trim()) {
      return KNOWN_INSERTS.slice(0, 30).map(p => ({ label: p, match: true, score: 0 }))
    }
    return KNOWN_INSERTS
      .map(p => ({ label: p, ...fuzzyMatch(value, p) }))
      .filter(s => s.match)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 20)
  }, [value])

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
      const el = listRef.current.children[focusIdx] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusIdx])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault()
      selectItem(suggestions[focusIdx].label)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const selectItem = (label: string) => {
    onChange(label)
    onBlur?.(label)
    setOpen(false)
    setFocusIdx(-1)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(true); setFocusIdx(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={e => {
          // Small delay so click on dropdown item fires first
          setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) {
              setOpen(false)
              onBlur?.(e.target.value)
            }
          }, 150)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Insert"
        className={`w-full ${className || ''}`}
      />

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-48 overflow-y-auto
                     bg-surface border border-border rounded-md shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.label}
              onMouseDown={e => { e.preventDefault(); selectItem(s.label) }}
              className={`px-2 py-1.5 text-xs cursor-pointer transition-colors
                ${i === focusIdx
                  ? 'bg-brand/20 text-brand'
                  : 'text-foreground hover:bg-surface-hover'
                }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
