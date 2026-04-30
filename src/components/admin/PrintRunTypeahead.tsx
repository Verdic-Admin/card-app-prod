'use client'

import { useState, useRef, useEffect } from 'react'

/**
 * Common numbered parallel print run denominators in the hobby.
 * These are the edition sizes that appear on cards, sorted ascending.
 */
const KNOWN_PRINT_RUNS: number[] = [
  1, 5, 10, 15, 25, 35, 49, 50, 75, 99,
  100, 125, 149, 150, 175, 199, 200, 249, 250,
  299, 350, 399, 499, 550, 599, 749, 799, 999,
]

interface PrintRunTypeaheadProps {
  /** Current integer value (from DB) or null */
  value: number | null
  /** Called with the integer denominator or null when cleared */
  onChange: (val: number | null) => void
  className?: string
}

export default function PrintRunTypeahead({
  value,
  onChange,
  className,
}: PrintRunTypeaheadProps) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value ? `/${value}` : '')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Sync display when value changes externally
  useEffect(() => {
    setInputVal(value ? `/${value}` : '')
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /** Extract denominator from any user input: "45/99" | "/99" | "99" → 99 */
  function parsePR(raw: string): number | null {
    const s = raw.trim()
    const slashMatch = s.match(/\/\s*(\d+)/)
    if (slashMatch) {
      const n = parseInt(slashMatch[1], 10)
      return n > 0 ? n : null
    }
    const plainMatch = s.match(/^(\d+)$/)
    if (plainMatch) {
      const n = parseInt(plainMatch[1], 10)
      return n > 0 ? n : null
    }
    return null
  }

  const commit = (raw: string) => {
    const n = parsePR(raw)
    onChange(n)
    setInputVal(n ? `/${n}` : '')
    setOpen(false)
  }

  const selectPreset = (n: number) => {
    onChange(n)
    setInputVal(`/${n}`)
    setOpen(false)
  }

  // Filter presets based on what the user has typed
  const filtered = inputVal
    ? KNOWN_PRINT_RUNS.filter(n => {
        const typed = parsePR(inputVal)
        if (typed == null) return String(n).startsWith(inputVal.replace(/\D/g, ''))
        return String(n).startsWith(String(typed))
      })
    : KNOWN_PRINT_RUNS

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={inputVal}
        onChange={e => {
          setInputVal(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={e => {
          setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) {
              commit(e.target.value)
              setOpen(false)
            }
          }, 150)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { commit(inputVal); e.preventDefault() }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="/PR"
        className={`w-16 text-center ${className || ''}`}
      />

      {open && filtered.length > 0 && (
        <ul
          className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-0.5
                     bg-surface border border-border rounded-md shadow-lg
                     grid grid-cols-3 gap-0.5 p-1 min-w-[120px]"
        >
          {filtered.map(n => (
            <li
              key={n}
              onMouseDown={e => { e.preventDefault(); selectPreset(n) }}
              className="px-2 py-1 text-xs font-mono font-bold text-center cursor-pointer
                         rounded text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300
                         transition-colors"
            >
              /{n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
