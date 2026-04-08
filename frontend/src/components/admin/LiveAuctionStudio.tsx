'use client'

import { useState } from 'react'

interface LiveAuctionStudioProps {
  initialItems: any[]
  initialStreamUrl: string | null
  initialProjectionTimeframe: string
}

export function LiveAuctionStudio({ initialItems, initialStreamUrl, initialProjectionTimeframe }: LiveAuctionStudioProps) {
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl || '')
  const [timeframe, setTimeframe] = useState(initialProjectionTimeframe || '90-Day')
  const [isSavingTimeframe, setIsSavingTimeframe] = useState(false)

  // Status arrays
  const pendingItems = initialItems.filter(i => i.is_auction && i.auction_status === 'pending')

  const handleSaveStream = async () => {
    const admin = await import('@/utils/supabase/client').then(m => m.createSupabaseClient())
    await admin.from('store_settings').update({ live_stream_url: streamUrl }).eq('id', 1)
    alert("Live stream updated!")
  }

  const handleSaveTimeframe = async (val: string) => {
    setIsSavingTimeframe(true)
    setTimeframe(val)
    const admin = await import('@/utils/supabase/client').then(m => m.createSupabaseClient())
    await admin.from('store_settings').update({ projection_timeframe: val }).eq('id', 1)
    setIsSavingTimeframe(false)
  }

  const handleGenBatch = async () => {
    const ids = pendingItems.map(i => i.id)
    if (ids.length > 0) {
      const admin = await import('@/utils/supabase/client').then(m => m.createSupabaseClient())
      const updates = ids.map(id => ({ id, verification_code: Math.random().toString(36).substring(2, 10).toUpperCase() }))
      await Promise.all(updates.map(u => admin.from('inventory').update({ verification_code: u.verification_code }).eq('id', u.id)))
      alert("Batch codes generated. Please refresh to view.")
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Live Stream Control</h2>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <input 
              className="border border-slate-300 bg-white placeholder-slate-400 p-2 rounded flex-1 focus:ring-2 focus:ring-indigo-500" 
              value={streamUrl} 
              onChange={e => setStreamUrl(e.target.value)} 
              placeholder="YouTube or Twitch URL" 
            />
            <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition-colors" onClick={handleSaveStream}>
              Save Stream
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Projection Timeframe</label>
            <select
              value={timeframe}
              onChange={e => handleSaveTimeframe(e.target.value)}
              disabled={isSavingTimeframe}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60 shadow-sm"
            >
              {['30-Day', '90-Day', '6-Month', 'End of Season'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {isSavingTimeframe && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
            {!isSavingTimeframe && <span className="text-xs text-emerald-600 font-semibold">Active: {timeframe}</span>}
          </div>
        </div>
      </div>

      <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-amber-500">⏳</span> Staging Area (Pending)
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={handleGenBatch} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm" disabled={pendingItems.length === 0}>
              Generate Batch Codes
            </button>
            <button 
              onClick={async () => {
                const checked = document.querySelectorAll('input[name="stagedItemRadio"]:checked')
                if (checked.length > 0) {
                  const ids = Array.from(checked).map(i => (i as HTMLInputElement).value)
                  await import('@/app/actions/inventory').then(m => m.goLiveWithAuctions(ids))
                } else if (pendingItems.length > 0) {
                  // Fallback: full blast
                  await import('@/app/actions/inventory').then(m => m.goLiveWithAuctions(pendingItems.map(p => p.id)))
                } else {
                  alert('No staged items.')
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-black tracking-widest transition-colors shadow-lg"
            >
              GO LIVE
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {pendingItems.map(item => (
            <div key={item.id} className="border border-slate-200 p-4 rounded-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-slate-50">
              <div className="flex items-start gap-4 flex-1">
                <input type="checkbox" name="stagedItemRadio" value={item.id} className="w-5 h-5 mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" defaultChecked />
                <img src={item.image_url} alt="card" className="h-20 w-20 object-cover rounded-lg shadow-sm bg-white p-1" />
                <div>
                  <div className="font-bold text-lg text-slate-900 line-clamp-1">{item.player_name}</div>
                  <div className="text-sm text-slate-500 line-clamp-1">{item.card_set}</div>
                  {item.verification_code ? (
                    <div className="text-emerald-600 font-mono font-bold mt-2 bg-emerald-100 px-2 py-0.5 rounded inline-block text-sm shadow-sm">{item.verification_code}</div>
                  ) : (
                    <div className="text-slate-400 text-sm mt-2 font-mono">No ID generated</div>
                  )}
                  {item.coined_image_url && (
                    <div className="text-indigo-600 text-xs font-bold mt-1">✓ Coined Image Attached</div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 w-full flex flex-col gap-3 border-l border-slate-200 pl-0 lg:pl-6">
                <form 
                  onSubmit={async e => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const rp = fd.get('reservePrice') as string
                    const et = fd.get('endTime') as string
                    const desc = fd.get('description') as string
                    const file = fd.get('coinedImage') as File
                    
                    let coinedUrl = undefined
                    if (file && file.size > 0) {
                      const admin = await import('@/utils/supabase/client').then(m => m.createSupabaseClient())
                      const ext = file.name.split('.').pop()
                      const fName = `auction-coin-${Date.now()}.${ext}`
                      await admin.storage.from('card-images').upload(fName, file)
                      coinedUrl = admin.storage.from('card-images').getPublicUrl(fName).data.publicUrl
                    }
                    
                    await import('@/app/actions/inventory').then(m => m.updateStagedAuction(
                      item.id,
                      rp ? Number(rp) : null,
                      et || null,
                      desc || null,
                      coinedUrl
                    ))
                    alert("Draft saved!")
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" step="0.01" name="reservePrice" defaultValue={item.auction_reserve_price || ''} placeholder="Reserve Price ($)" className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500" />
                    <input type="datetime-local" name="endTime" defaultValue={item.auction_end_time?.substring(0,16) || ''} className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <input type="text" name="description" defaultValue={item.auction_description || ''} placeholder="Auction Description (e.g. Centering 10)" className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 w-full" />
                  
                  <div className="flex gap-2 items-center justify-between mt-1">
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors w-full">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <span className="truncate flex-1">Attach Special Coin Photo</span>
                      <input type="file" name="coinedImage" accept="image/*" className="hidden" />
                    </label>
                    <button type="submit" className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded px-3 py-1 text-xs font-bold transition-colors whitespace-nowrap">
                      Save Draft
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ))}
          {pendingItems.length === 0 && <div className="text-slate-500 text-sm py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">Staging area is empty.</div>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-slate-900">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
          Live Auctions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialItems.filter(i => i.is_auction && i.auction_status === 'live').map(item => (
             <div key={item.id} className="border border-red-100 bg-red-50/30 p-4 rounded-xl flex items-center gap-4">
                <img src={item.image_url} alt="card" className="h-16 w-16 object-cover rounded shadow-sm bg-white p-0.5" />
                <div>
                  <div className="font-bold text-slate-900 line-clamp-1">{item.player_name}</div>
                  <div className="text-xs text-slate-500 line-clamp-1 mb-1">{item.card_set}</div>
                  <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm border border-red-200">Bidding Open</span>
                </div>
             </div>
          ))}
          {initialItems.filter(i => i.is_auction && i.auction_status === 'live').length === 0 && (
             <div className="text-slate-500 text-sm col-span-full py-2">No auctions currently running.</div>
          )}
        </div>
      </div>
    </div>
  )
}
