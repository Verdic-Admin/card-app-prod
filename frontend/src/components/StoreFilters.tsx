'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Filter, Search, X } from 'lucide-react'

interface StoreFiltersProps {
  availableTeams: string[]
  availableYears: string[]
}

export function StoreFilters({ availableTeams, availableYears }: StoreFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // Local state for debounced text search
  const [query, setQuery] = useState(searchParams.get('q') || '')
  
  // Debounce the search term to avoid hammering the router on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQuery = searchParams.get('q') || ''
      if (query !== currentQuery) {
        setFilter('q', query)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query, searchParams])

  // Sync external URL changes back into the input (e.g. user hits back button)
  useEffect(() => {
    setQuery(searchParams.get('q') || '')
  }, [searchParams])

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const clearAll = () => {
    setQuery('')
    router.push(pathname, { scroll: false })
    setIsOpen(false) // Close mobile drawer on clear
  }

  const activeTeam = searchParams.get('team') || ''
  const activeYear = searchParams.get('year') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''

  const filterContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
           <Filter className="w-4 h-4" /> Filters
        </h3>
        {Array.from(searchParams.keys()).length > 0 && (
          <button onClick={clearAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="search" 
            placeholder="Search players, sets..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">Team</label>
        <select 
          value={activeTeam}
          onChange={e => setFilter('team', e.target.value)}
          className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors cursor-pointer"
        >
          <option value="">All Teams ({availableTeams.length})</option>
          {availableTeams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">Year</label>
        <select 
          value={activeYear}
          onChange={e => setFilter('year', e.target.value)}
          className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors cursor-pointer"
        >
          <option value="">Any Year</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">Price Range</label>
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            placeholder="Min $" 
            value={minPrice}
            onChange={e => setFilter('minPrice', e.target.value)}
            className="w-1/2 p-2.5 text-sm text-center bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
          />
          <span className="text-slate-400 font-bold">-</span>
          <input 
            type="number" 
            placeholder="Max $" 
            value={maxPrice}
            onChange={e => setFilter('maxPrice', e.target.value)}
            className="w-1/2 p-2.5 text-sm text-center bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
          />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="lg:hidden w-full mb-4">
        <button 
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-2 justify-center bg-white border border-slate-200 shadow-sm py-3 px-4 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Filter className="w-5 h-5" /> Filter & Search Results
        </button>
      </div>

      {/* Desktop Sidebar (Always Visible on lg screens) */}
      <aside className="hidden lg:block w-72 flex-shrink-0 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 h-fit sticky top-24">
        {filterContent}
      </aside>

      {/* Mobile Off-Canvas Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] overflow-hidden flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-[300px] h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 tracking-tight">Filters</h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {filterContent}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
