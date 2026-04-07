'use client'

import { useState } from 'react'
import { updateLiveStreamUrl, sendToAuctionBlock, generateBatchCodes, uploadVerifiedFlipUI, updateProjectionTimeframe } from '@/app/actions/inventory'

export function AuctionManager({ initialItems, initialStreamUrl, initialProjectionTimeframe }: { initialItems: any[], initialStreamUrl: string | null, initialProjectionTimeframe?: string }) {
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl || '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [timeframe, setTimeframe] = useState(initialProjectionTimeframe || '90-Day')
  const [isSavingTimeframe, setIsSavingTimeframe] = useState(false)

  const itemsForAuction = initialItems.filter(i => !i.is_auction && i.status === 'available')
  const pendingItems = initialItems.filter(i => i.is_auction && i.auction_status === 'pending')

  const handleSaveStream = async () => {
    await updateLiveStreamUrl(streamUrl)
    alert("Live stream updated!")
  }

  const handleSaveTimeframe = async (val: string) => {
    setTimeframe(val)
    setIsSavingTimeframe(true)
    try { await updateProjectionTimeframe(val) }
    finally { setIsSavingTimeframe(false) }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleSendToBlock = async () => {
    await sendToAuctionBlock(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleGenBatch = async () => {
    const ids = pendingItems.map(i => i.id)
    if (ids.length > 0) {
      await generateBatchCodes(ids)
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Live Stream Control</h2>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <input 
              className="border p-2 rounded flex-1 focus:ring-2 focus:ring-indigo-500" 
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

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Inventory Selection</h2>
        <div className="mb-4">
          <button 
            onClick={handleSendToBlock} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors" 
            disabled={selectedIds.size === 0}
          >
            Send to Auction Block
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {itemsForAuction.map(item => (
            <div key={item.id} className="border border-slate-200 p-3 rounded-lg flex items-center gap-3 hover:bg-slate-50 transition-colors">
              <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />
              <div>
                <img src={item.image_url} alt="card" className="h-12 w-12 object-cover rounded shadow-sm" />
                <div className="text-sm font-bold text-slate-800 line-clamp-1">{item.player_name}</div>
                <div className="text-xs text-slate-500 line-clamp-1">{item.card_set}</div>
              </div>
            </div>
          ))}
          {itemsForAuction.length === 0 && <div className="text-slate-500 text-sm">No available inventory to send to block.</div>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold">Pending Auction Items</h2>
          <button onClick={handleGenBatch} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50" disabled={pendingItems.length === 0}>
            Generate Batch Codes
          </button>
        </div>
        <div className="space-y-4">
          {pendingItems.map(item => (
            <div key={item.id} className="border border-slate-200 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src={item.image_url} alt="card" className="h-16 w-16 object-cover rounded shadow-sm" />
                <div>
                  <div className="font-bold text-lg text-slate-900">{item.player_name}</div>
                  <div className="text-sm text-slate-500">{item.card_set}</div>
                  {item.verification_code ? (
                    <div className="text-emerald-600 font-mono font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded inline-block">{item.verification_code}</div>
                  ) : (
                    <div className="text-slate-400 text-sm mt-1">No code yet</div>
                  )}
                </div>
              </div>
              <div>
                {!item.is_verified_flip && (
                  <form action={formData => uploadVerifiedFlipUI(item.id, formData)} className="flex items-center gap-2 border border-slate-200 p-2 rounded bg-slate-50">
                    <input type="file" name="video" accept="video/mp4" className="text-sm flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" required />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold shadow-sm transition-colors whitespace-nowrap">
                      Upload Flip (MP4)
                    </button>
                  </form>
                )}
                {item.is_verified_flip && (
                  <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded font-bold border border-emerald-200 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    PlayerIndex Certified ✓
                  </div>
                )}
              </div>
            </div>
          ))}
          {pendingItems.length === 0 && <div className="text-slate-500 text-sm">No pending items on the block.</div>}
        </div>
      </div>
    </div>
  )
}
