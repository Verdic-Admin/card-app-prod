'use client'

import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/utils/supabase/client'
import { fulfillCoinRequest } from '@/app/actions/coins'
import { Database } from '@/types/database.types'

type CoinRequest = Database['public']['Tables']['coin_requests']['Row'] & {
  inventory: Database['public']['Tables']['inventory']['Row'] | null
}

export function CoinRequestsCRM() {
  const [requests, setRequests] = useState<CoinRequest[]>([])
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadRequests() {
      const supabase = createSupabaseClient()
      const { data } = await supabase
        .from('coin_requests')
        .select(`*, inventory(*)`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (data) {
        setRequests(data as any)
      }
    }
    loadRequests()
  }, [])

  const handleFulfill = async (reqId: string, itemId: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    
    setLoadingIds(prev => new Set(prev).add(reqId))
    try {
      await fulfillCoinRequest(reqId, itemId, form)
      setRequests(prev => prev.filter(r => r.id !== reqId))
    } catch (err) {
      alert("Failed to fulfill request.")
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(reqId)
        return next
      })
    }
  }

  if (requests.length === 0) return null

  return (
    <div className="bg-white text-slate-900 rounded-xl shadow-sm border border-amber-200">
      <div className="bg-amber-50 rounded-t-xl px-6 py-4 border-b border-amber-200 flex justify-between items-center">
        <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
          <span>📸</span> Coin Requests Action Center
        </h2>
        <span className="bg-amber-600 text-white font-black px-3 py-1 rounded-full text-sm">
          {requests.length} Pending
        </span>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map(req => {
           const item = req.inventory
           if (!item) return null
           
           return (
             <div key={req.id} className="border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <img src={item.image_url || ''} alt="card" className="w-16 h-20 object-cover rounded shadow" />
                  <div>
                    <h3 className="font-bold text-slate-900 line-clamp-1">{item.player_name}</h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{item.card_set}</p>
                    <p className="text-xs font-bold text-amber-600 mt-2">
                      <a href={`mailto:${req.buyer_email}?subject=Your physical coin photo from Into the Gap`} className="hover:underline">
                        {req.buyer_email}
                      </a>
                    </p>
                  </div>
                </div>
                
                <form onSubmit={e => handleFulfill(req.id, item.id, e)} className="mt-auto flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <input 
                    type="file" 
                    name="image" 
                    accept="image/*"
                    required
                    className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                  />
                  <button 
                    type="submit"
                    disabled={loadingIds.has(req.id)}
                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                  >
                    {loadingIds.has(req.id) ? 'Uploading...' : 'Fulfill & Send'}
                  </button>
                </form>
             </div>
           )
        })}
      </div>
    </div>
  )
}
