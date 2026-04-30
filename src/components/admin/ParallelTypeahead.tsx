'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

/**
 * Comprehensive list of known baseball card parallels.
 * Sorted alphabetically for display. Covers Topps, Panini, Bowman, etc.
 */
const KNOWN_PARALLELS: string[] = [
  // ── Base / No Parallel ──
  'Base',

  // ── Chrome / Refractor Family (Topps/Bowman) ──
  'Refractor', 'Chrome Refractor', 'Atomic Refractor', 'Aqua Refractor', 'Aqua Lava Refractor', 
  'Aqua Shimmer Refractor', 'Aqua Wave Refractor', 'Black Refractor', 'Black Atomic Refractor',
  'Black Wave Refractor', 'Black Shimmer Refractor', 'Blue Refractor', 'Blue Wave Refractor',
  'Blue Shimmer Refractor', 'Blue Atomic Refractor', 'Canary Yellow Refractor', 'Gold Refractor',
  'Gold Wave Refractor', 'Gold Shimmer Refractor', 'Green Refractor', 'Green Wave Refractor',
  'Green Shimmer Refractor', 'Green Atomic Refractor', 'Hyper Refractor', 'Lava Refractor',
  'Logofractor', 'Magenta Refractor', 'Magenta Speckle Refractor', 'Mini-Diamond Refractor',
  'Negative Refractor', 'Orange Refractor', 'Orange Wave Refractor', 'Orange Shimmer Refractor',
  'Pink Refractor', 'Pink Wave Refractor', 'Prism Refractor', 'Pulsar Refractor', 'Purple Refractor',
  'Purple Wave Refractor', 'Purple Shimmer Refractor', 'RayWave Refractor', 'Red Refractor',
  'Red Wave Refractor', 'Red Shimmer Refractor', 'Rose Gold Refractor', 'Rose Gold Wave Refractor',
  'Rose Gold Shimmer Refractor', 'Sepia Refractor', 'Shimmer Refractor', 'Silver Refractor',
  'Speckle Refractor', 'Superfractor', 'Teal Refractor', 'Teal Wave Refractor', 'Teal Shimmer Refractor',
  'Wave Refractor', 'X-Fractor', 'Yellow Refractor', 'Yellow Wave Refractor',

  // ── Prizm Family (Panini) ──
  'Prizm', 'Silver Prizm', 'Base Prizm', 'Hyper Prizm', 'Mojo Prizm', 'Choice Prizm', 'Fast Break Prizm',
  'Aqua Prizm', 'Black Prizm', 'Black Gold Prizm', 'Black Shimmer Prizm', 'Blue Prizm', 'Blue Ice Prizm',
  'Blue Shimmer Prizm', 'Blue Wave Prizm', 'Blue Yellow Green Prizm', 'Bronze Prizm', 'Camo Prizm',
  'Carolina Blue Prizm', 'Checkerboard Prizm', 'Cosmic Prizm', 'Cracked Ice Prizm', 'Disco Prizm',
  'Flash Prizm', 'Gold Prizm', 'Gold Shimmer Prizm', 'Gold Vinyl Prizm', 'Green Prizm', 'Green Ice Prizm',
  'Green Pulsar Prizm', 'Green Shimmer Prizm', 'Green Wave Prizm', 'Green Yellow Prizm', 'Ice Prizm',
  'Light Blue Prizm', 'Neon Green Prizm', 'Neon Orange Prizm', 'Orange Prizm', 'Orange Ice Prizm',
  'Orange Wave Prizm', 'Pink Prizm', 'Pink Ice Prizm', 'Purple Prizm', 'Purple Ice Prizm',
  'Purple Wave Prizm', 'Red Prizm', 'Red Ice Prizm', 'Red Wave Prizm', 'Red White Blue Prizm',
  'Ruby Wave Prizm', 'Scope Prizm', 'Sensory Prizm', 'Shimmer Prizm', 'Snakeskin Prizm',
  'Sparkle Prizm', 'Teal Prizm', 'Tie-Dye Prizm', 'Tiger Stripe Prizm', 'Tri-Color Prizm',
  'Velocity Prizm', 'Wave Prizm', 'White Prizm', 'White Sparkle Prizm', 'Zebra Prizm',

  // ── Optic / Donruss / Select Family (Panini) ──
  'Holo', 'Aqua Holo', 'Black Holo', 'Blue Holo', 'Blue Velocity Holo', 'Bronze Holo', 'Carolina Blue Holo',
  'Gold Holo', 'Gold Vinyl Holo', 'Green Holo', 'Green Velocity Holo', 'Ice Holo', 'Lime Green Holo',
  'Orange Holo', 'Pink Holo', 'Pink Velocity Holo', 'Purple Holo', 'Red Holo', 'Red White Blue Holo',
  'Silver Holo', 'Teal Velocity Holo', 'White Sparkle Holo', 'Rated Rookies Holo',
  
  'Concourse', 'Premier Level', 'Club Level', 'Field Level', 'Courtside',
  'Silver', 'Scope', 'Tri-Color', 'Zebra', 'Elephant', 'Peacock', 'Tiger', 'Cheetah',

  // ── Standard Color / Foil Parallels ──
  'Black', 'Black Foil', 'Black Border', 'Black & White', 'Black & White RayWave', 'Blue',
  'Blue Foil', 'Blue Border', 'Bronze', 'Brown', 'Camo', 'Clear', 'Clear Acetate', 'Copper',
  'Cream', 'Cyan', 'Emerald', 'Foil', 'Foilboard', 'Gold', 'Gold Foil', 'Gold Foilboard',
  'Gold Border', 'Green', 'Green Foil', 'Grey', 'Holographic', 'Indigo', 'Lavender', 'Magenta',
  'Matte', 'Matte Black', 'Matte Foil', 'Metallic', 'Neon', 'Neon Green', 'Neon Orange',
  'Orange', 'Orange Foil', 'Orange Border', 'Peach', 'Pink', 'Pink Foil', 'Platinum', 'Purple',
  'Purple Foil', 'Rainbow', 'Rainbow Foil', 'Rainbow Foilboard', 'Red', 'Red Foil', 'Red Border',
  'Rose Gold', 'Royal Blue', 'Ruby', 'Sapphire', 'Sepia', 'Silver', 'Silver Foil', 'Silver Pack',
  'Teal', 'Turquoise', 'White', 'White Border', 'Yellow', 'Yellow Foil',

  // ── Topps / Bowman Specific (Paper & Variants) ──
  'Advanced Stats', 'Clear', 'Father\'s Day Blue', 'First Edition', 'Gold Label', 'Holiday Metallic',
  'Home Run Challenge', 'Independence Day', 'Memorial Day Camo', 'Mother\'s Day Hot Pink',
  'Opening Day', 'SP Image Variation', 'SSP Image Variation', 'SSSP Image Variation', 'Stars',
  'Toys R Us Purple', 'Vintage Stock', 'Walmart Blue', 'Walmart Exclusive', 'Target Red',
  'Target Exclusive', 'Meijer Purple', 'Walgreens Yellow',
  
  '1st Bowman', 'Bowman Blue', 'Bowman Purple', 'Bowman Sky Blue', 'Bowman Yellow', 'Bowman Orange',
  'Bowman Green', 'Bowman Gold', 'Bowman Red', 'Bowman Black', 'Bowman Atomic', 'Bowman Sapphire',

  // ── Finishes / Patterns ──
  'Acetate', 'Aqua', 'Black Gold', 'Burst', 'Checkerboard', 'Circles', 'Cosmic', 'Cracked Ice',
  'Crystals', 'Diamond', 'Die-Cut', 'Disco', 'Dots', 'Electric', 'Electric Charge', 'Fast Break',
  'Fire', 'Flash', 'Galactic', 'Geometric', 'Glitter', 'Glossy', 'Glow in the Dark', 'Ice',
  'Laser', 'Lava', 'Lightning', 'Liquid', 'Lunar', 'Lunar Mini', 'Matrix', 'Micro Etch',
  'Mirror', 'Mosaic', 'Mother of Pearl', 'Negative', 'No Number', 'Out of Bounds', 'Pattern',
  'Pulsar', 'RayWave', 'Scope', 'Seismic', 'Shimmer', 'Shock', 'Snake Skin', 'Sparkle',
  'Speckle', 'Spiral', 'Splash', 'Stained Glass', 'Starburst', 'Static', 'Stripes', 'Swirl',
  'Tie-Dye', 'Velocity', 'Wave', 'White Sparkle', 'Wood', 'Woodgrain',

  // ── Numbered / Tiered Quantities ──
  '/1', '/2', '/3', '/4', '/5', '/7', '/8', '/9', '/10', '/11', '/12', '/13', '/14', '/15',
  '/20', '/23', '/24', '/25', '/30', '/35', '/40', '/49', '/50', '/60', '/75', '/99', '/100',
  '/125', '/149', '/150', '/199', '/200', '/249', '/250', '/299', '/300', '/349', '/350',
  '/399', '/400', '/499', '/500', '/799', '/999', '/2020', '/2021', '/2022', '/2023', '/2024', '/2025',
  
  // ── Printing Plates & 1/1s ──
  '1/1', 'One of One', 'Masterpiece', 'Logoman', 'Shield', 'Laundry Tag', 'Button', 'Knob',
  'Printing Plate', 'Printing Plate Black', 'Printing Plate Cyan', 'Printing Plate Magenta',
  'Printing Plate Yellow', 'Framed Printing Plate',

  // ── Upper Deck / Fleer / Marvel / Misc ──
  'Exclusives', 'High Gloss', 'Clear Cut', 'PMG', 'Precious Metal Gems', 'Precious Metal Gems Red',
  'Precious Metal Gems Green', 'Precious Metal Gems Gold', 'Precious Metal Gems Blue', 'Rubies',
  'Emeralds', 'Sapphires', 'Diamonds', 'Jambalaya', 'Credentials', 'Essential Credentials',
  'Essential Credentials Now', 'Essential Credentials Future', 'Platinum Medallion', 'Gold Medallion',
  'Showcase', 'Legacy Collection', 'Masterpieces'
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
