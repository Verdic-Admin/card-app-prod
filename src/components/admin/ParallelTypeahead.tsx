'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

/**
 * Comprehensive list of known baseball card parallels.
 * Sorted alphabetically for display. Covers Topps, Panini, Bowman, etc.
 */
const KNOWN_PARALLELS: string[] = [
  // ── Base / No Parallel ──
  'Base',

  // ── Chrome / Refractor family ──
  'Refractor',
  'Chrome Refractor',
  'Atomic Refractor',
  'Aqua Refractor',
  'Black Refractor',
  'Blue Refractor',
  'Blue Wave Refractor',
  'Gold Refractor',
  'Gold Wave Refractor',
  'Green Refractor',
  'Green Shimmer Refractor',
  'Hyper Refractor',
  'Magenta Refractor',
  'Negative Refractor',
  'Orange Refractor',
  'Orange Shimmer Refractor',
  'Pink Refractor',
  'Purple Refractor',
  'Red Refractor',
  'Red Wave Refractor',
  'Rose Gold Refractor',
  'Sepia Refractor',
  'Shimmer Refractor',
  'Silver Refractor',
  'Speckle Refractor',
  'Superfractor',
  'Teal Refractor',
  'X-Fractor',

  // ── Bowman-specific ──
  'Bowman Blue',
  'Bowman Purple',
  'Bowman Sky Blue',
  'Bowman Yellow',
  'Bowman Orange',
  'Bowman Green',
  'Bowman Gold',
  'Bowman Red',
  'Bowman Black',
  'Bowman Atomic',
  'Bowman Sapphire',
  '1st Bowman Chrome Refractor',

  // ── Prizm family (Panini) ──
  'Prizm',
  'Silver Prizm',
  'Blue Prizm',
  'Red Prizm',
  'Green Prizm',
  'Gold Prizm',
  'Orange Prizm',
  'Purple Prizm',
  'Pink Prizm',
  'Black Prizm',
  'Camo Prizm',
  'Mojo Prizm',
  'Neon Green Prizm',
  'Red White Blue Prizm',
  'Snakeskin Prizm',
  'Tiger Stripe Prizm',
  'Tie-Dye Prizm',
  'Wave Prizm',

  // ── Optic / Donruss family (Panini) ──
  'Holo',
  'Blue Holo',
  'Red Holo',
  'Gold Holo',
  'Green Holo',
  'Orange Holo',
  'Purple Holo',
  'Pink Holo',
  'Rated Rookies Holo',

  // ── Standard color parallels ──
  'Black',
  'Blue',
  'Brown',
  'Camo',
  'Clear',
  'Cream',
  'Cyan',
  'Gold',
  'Green',
  'Indigo',
  'Lavender',
  'Magenta',
  'Neon',
  'Orange',
  'Peach',
  'Platinum',
  'Pink',
  'Purple',
  'Rainbow',
  'Red',
  'Rose Gold',
  'Royal Blue',
  'Ruby',
  'Sapphire',
  'Sepia',
  'Silver',
  'Teal',
  'Turquoise',
  'Vintage Stock',
  'White',
  'Yellow',

  // ── Foil / Finish variants ──
  'Black & White',
  'Black Gold',
  'Chrome',
  'Cracked Ice',
  'Diamond',
  'Electric',
  'Foilboard',
  'Foil',
  'Glitter',
  'Glossy',
  'Gold Foil',
  'Holographic',
  'Ice',
  'Independence Day',
  'Lava',
  'Matte',
  'Metallic',
  'Mirror',
  'Mosaic',
  'Mother of Pearl',
  'Neon Green',
  'Negative',
  'No Number',
  'Shimmer',
  'Sparkle',
  'Speckle',
  'Stained Glass',
  'Velocity',
  'Wave',
  'Wood',

  // ── Numbered / Limited ──
  '/1',
  '/5',
  '/10',
  '/15',
  '/25',
  '/35',
  '/50',
  '/75',
  '/99',
  '/100',
  '/150',
  '/199',
  '/250',
  '/299',
  '/399',
  '/499',
  '/500',
  '/999',
  'Printing Plate',
  'Printing Plate Black',
  'Printing Plate Cyan',
  'Printing Plate Magenta',
  'Printing Plate Yellow',
  '1/1',
  'One of One',

  // ── Topps-specific ──
  'Advanced Stats',
  'Clear',
  'Father\'s Day Blue',
  'Gold',
  'Gold Label',
  'Holiday Metallic',
  'Home Run Challenge',
  'Memorial Day Camo',
  'Mother\'s Day Hot Pink',
  'Opening Day',
  'Rainbow Foil',
  'Rainbow Foilboard',
  'Royal Blue',
  'SP Image Variation',
  'SSP Image Variation',
  'Stars',
  'Toys R Us Purple',
  'Vintage Stock',
  'Walmart Blue',
  'Walmart Exclusive',
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

interface ParallelTypeaheadProps {
  value: string
  onChange: (val: string) => void
  onBlur?: (val: string) => void
  className?: string
}

export default function ParallelTypeahead({ value, onChange, onBlur, className }: ParallelTypeaheadProps) {
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const suggestions = useMemo(() => {
    if (!value?.trim()) return KNOWN_PARALLELS.slice(0, 30)
    return KNOWN_PARALLELS
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
        placeholder="Parallel"
        className={className}
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
