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

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [teamQuery, setTeamQuery] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQuery = searchParams.get('q') || ''
      if (query !== currentQuery) {
        setFilter('q', query)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query, searchParams])

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
    setIsOpen(false) 
  }

  const activeTeam = searchParams.get('team') || ''
  const activeYear = searchParams.get('year') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''

  const filterContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <h3 className="font-bold text-white flex items-center gap-2">
           <Filter className="w-4 h-4" /> Filters
        </h3>
        {Array.from(searchParams.keys()).length > 0 && (
          <button onClick={clearAll} className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-zinc-400 tracking-wide uppercase">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="search" 
            placeholder="Players, sets..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-colors placeholder:text-zinc-600 text-white font-medium"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-zinc-400 tracking-wide uppercase">Team</label>
        <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filter teams..."
              value={teamQuery}
              onChange={e => setTeamQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none transition-colors placeholder:text-zinc-600 text-white font-medium shadow-sm"
            />
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
           <button 
             onClick={() => setFilter('team', '')}
             className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${!activeTeam ? 'bg-cyan-900/40 text-cyan-400 font-bold border border-cyan-800/50' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
           >
             All Teams ({availableTeams.length})
           </button>
           {availableTeams.filter(t => t.toLowerCase().includes(teamQuery.toLowerCase())).map(t => (
             <button 
               key={t}
               onClick={() => setFilter('team', t)}
               className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${activeTeam === t ? 'bg-cyan-900/40 text-cyan-400 font-bold border border-cyan-800/50' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
             >
               {t}
             </button>
           ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-zinc-400 tracking-wide uppercase">Year</label>
        <select 
          value={activeYear}
          onChange={e => setFilter('year', e.target.value)}
          className="w-full p-2.5 text-sm bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-colors cursor-pointer text-white font-medium"
        >
          <option value="">Any Year</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-zinc-400 tracking-wide uppercase">Price Range</label>
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            placeholder="Min $" 
            value={minPrice}
            onChange={e => setFilter('minPrice', e.target.value)}
            className="w-1/2 p-2.5 text-sm text-center bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-colors text-white font-medium placeholder:text-zinc-600"
          />
          <span className="text-zinc-600 font-bold">-</span>
          <input 
            type="number" 
            placeholder="Max $" 
            value={maxPrice}
            onChange={e => setFilter('maxPrice', e.target.value)}
            className="w-1/2 p-2.5 text-sm text-center bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-colors text-white font-medium placeholder:text-zinc-600"
          />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden w-full mb-4">
        <button 
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-2 justify-center bg-zinc-900 border border-zinc-800 shadow-sm py-3 px-4 rounded-xl font-bold text-white hover:bg-zinc-800 transition-colors"
        >
          <Filter className="w-5 h-5" /> Filter & Search Results
        </button>
      </div>

      <aside className="hidden lg:block w-72 flex-shrink-0 bg-zinc-950 border border-zinc-800 shadow-sm rounded-2xl p-6 h-fit sticky top-24">
        {filterContent}
      </aside>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] overflow-hidden flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-[300px] h-full bg-zinc-950 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-zinc-800">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white tracking-tight">Filters</h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
              {filterContent}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
