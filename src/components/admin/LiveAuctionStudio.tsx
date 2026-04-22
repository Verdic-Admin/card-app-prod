'use client'

import { useMemo, useState } from 'react'
import { AuctionQRCode } from './AuctionQRCode'
import {
  stageAuctionItems,
  type AuctionStageItemInput,
} from '@/app/actions/inventory'
import { Loader2, CheckCircle2, X, AlertTriangle, Tv } from 'lucide-react'

interface LiveAuctionStudioProps {
  initialItems: any[]
  initialStreamUrl: string | null
  initialProjectionTimeframe: string
  initialAuctionQrUrl?: string | null
}

interface ItemStagingDraft {
  reservePrice: string
  endTime: string
  description: string
}

const EMPTY_DRAFT: ItemStagingDraft = {
  reservePrice: '',
  endTime: '',
  description: '',
}

export function LiveAuctionStudio({ initialItems, initialStreamUrl, initialProjectionTimeframe, initialAuctionQrUrl }: LiveAuctionStudioProps) {
  const [items, setItems] = useState<any[]>(initialItems)
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl || '')
  const [timeframe, setTimeframe] = useState(initialProjectionTimeframe || '90-Day')
  const [isSavingTimeframe, setIsSavingTimeframe] = useState(false)
  const [showQR, setShowQR] = useState(true)

  // Livestream selection state (adds new items to auction staging)
  const [liveSelection, setLiveSelection] = useState<Set<string>>(new Set())
  const [liveDrafts, setLiveDrafts] = useState<Record<string, ItemStagingDraft>>({})
  const [liveGlobalEnd, setLiveGlobalEnd] = useState('')
  const [liveGlobalDesc, setLiveGlobalDesc] = useState('')
  const [liveCommitting, setLiveCommitting] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [liveSuccess, setLiveSuccess] = useState<number | null>(null)

  const pendingItems = useMemo(
    () => items.filter(i => i.is_auction && i.auction_status === 'pending'),
    [items],
  )
  const liveItems = useMemo(
    () => items.filter(i => i.is_auction && i.auction_status === 'live'),
    [items],
  )
  const availableForLivestream = useMemo(
    () => items.filter(i => i.status === 'available' && !i.is_auction),
    [items],
  )
  const selectedLiveItems = useMemo(
    () => availableForLivestream.filter(i => liveSelection.has(i.id)),
    [availableForLivestream, liveSelection],
  )

  const toggleLiveSelect = (id: string) => {
    setLiveSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLiveDrafts(prev => (prev[id] ? prev : { ...prev, [id]: { ...EMPTY_DRAFT } }))
  }

  const updateLiveDraft = (
    id: string,
    field: keyof ItemStagingDraft,
    value: string,
  ) => {
    setLiveDrafts(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_DRAFT), [field]: value },
    }))
  }

  const applyLiveGlobals = () => {
    setLiveDrafts(prev => {
      const next = { ...prev }
      for (const id of liveSelection) {
        next[id] = {
          ...(next[id] ?? EMPTY_DRAFT),
          endTime: liveGlobalEnd || next[id]?.endTime || '',
          description: liveGlobalDesc || next[id]?.description || '',
        }
      }
      return next
    })
  }

  const handleCommitLivestream = async () => {
    setLiveError(null)
    setLiveSuccess(null)
    if (liveSelection.size === 0) {
      setLiveError('Select at least one card to stage for livestream.')
      return
    }
    const payload: AuctionStageItemInput[] = Array.from(liveSelection).map(id => {
      const d = liveDrafts[id] ?? EMPTY_DRAFT
      const reservePriceNum = d.reservePrice ? Number(d.reservePrice) : null
      return {
        id,
        reservePrice:
          reservePriceNum != null && Number.isFinite(reservePriceNum)
            ? reservePriceNum
            : null,
        endTime: d.endTime || null,
        description: d.description || null,
      }
    })

    setLiveCommitting(true)
    try {
      const res = await stageAuctionItems(payload, {
        endTime: liveGlobalEnd || null,
        description: liveGlobalDesc || null,
      })
      if (!res.success) {
        setLiveError(res.error)
        return
      }
      setLiveSuccess(res.count)
      setItems(prev =>
        prev.map(i =>
          liveSelection.has(i.id)
            ? { ...i, is_auction: true, auction_status: 'pending' }
            : i,
        ),
      )
      setLiveSelection(new Set())
      setLiveDrafts({})
    } catch (e: any) {
      setLiveError(e?.message || 'Failed to stage items for livestream.')
    } finally {
      setLiveCommitting(false)
    }
  }

  const handleSaveStream = async () => {
    await import('@/app/actions/inventory').then(m => m.updateLiveStreamUrl(streamUrl))
    alert("Live stream updated!")
  }

  const handleSaveTimeframe = async (val: string) => {
    setIsSavingTimeframe(true)
    setTimeframe(val)
    await import('@/app/actions/inventory').then(m => m.updateProjectionTimeframe(val))
    setIsSavingTimeframe(false)
  }

  const handleGenBatch = async () => {
    const ids = pendingItems.map(i => i.id)
    if (ids.length > 0) {
      await import('@/app/actions/inventory').then(m => m.generateBatchCodes(ids))
      alert("Batch codes generated. Please refresh to view.")
    }
  }

  return (
    <div className="space-y-8 relative">
      {/* Floating QR Modal */}
      <div className={`fixed bottom-8 right-8 z-50 transition-all ${showQR ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}>
        <AuctionQRCode isVisible={true} toggleVisibility={() => setShowQR(false)} url={initialAuctionQrUrl ?? undefined} />
      </div>

      <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
           <h2 className="text-xl font-bold">Live Stream Control</h2>
           <button onClick={() => setShowQR(!showQR)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors">
              Toggle Live QR
           </button>
        </div>
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

      {/* NEW: Livestream Item Selection */}
      <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Tv className="w-5 h-5 text-red-600" /> Livestream Item Selection
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Select inventory items to run on this livestream. Each card gets its own reserve, end time, and hype description.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleCommitLivestream}
              disabled={liveSelection.size === 0 || liveCommitting}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {liveCommitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Stage {liveSelection.size > 0 ? `${liveSelection.size} ` : ''}for Livestream
            </button>
            {liveSelection.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setLiveSelection(new Set())
                  setLiveDrafts({})
                }}
                className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {liveError && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold">{liveError}</p>
          </div>
        )}
        {liveSuccess !== null && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="text-sm font-semibold">
              Staged {liveSuccess} card{liveSuccess === 1 ? '' : 's'} for the livestream.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-2">
          {availableForLivestream.map(item => {
            const isSelected = liveSelection.has(item.id)
            return (
              <div
                key={item.id}
                onClick={() => toggleLiveSelect(item.id)}
                className={`border p-3 rounded-lg flex items-start gap-3 cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'border-red-400 bg-red-50/70 ring-1 ring-red-200'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-5 h-5 mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.player_name}
                    className="h-14 w-14 object-cover rounded shadow-sm bg-white p-0.5 border border-slate-200"
                  />
                ) : (
                  <div className="h-14 w-14 rounded bg-slate-100 border border-slate-200" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 line-clamp-1">
                    {item.player_name}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-1">
                    {item.card_set}
                  </div>
                  {item.is_lot && (
                    <div className="text-[10px] bg-indigo-100 text-indigo-800 mt-1 inline-block px-1.5 rounded font-bold">
                      LOT BUNDLE
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {availableForLivestream.length === 0 && (
            <div className="text-slate-500 text-sm col-span-full text-center py-8 bg-slate-50 rounded border border-slate-100">
              No available inventory to add to the livestream.
            </div>
          )}
        </div>

        {liveSelection.size > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            {/* Session defaults */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Session Defaults (optional)
                </div>
                <button
                  type="button"
                  onClick={applyLiveGlobals}
                  disabled={!liveGlobalEnd && !liveGlobalDesc}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded px-3 py-1.5 transition-colors disabled:opacity-40"
                >
                  Apply defaults to all selected
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Default End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={liveGlobalEnd}
                    onChange={e => setLiveGlobalEnd(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-red-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Default Description
                  </label>
                  <input
                    type="text"
                    value={liveGlobalDesc}
                    onChange={e => setLiveGlobalDesc(e.target.value)}
                    placeholder="Applied when per-item description is empty"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-red-500 outline-none bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {selectedLiveItems.map(item => {
                const draft = liveDrafts[item.id] ?? EMPTY_DRAFT
                return (
                  <div
                    key={item.id}
                    className="border border-slate-200 bg-slate-50/60 p-4 rounded-xl flex flex-col lg:flex-row gap-4"
                  >
                    <div className="flex items-start gap-3 lg:w-1/3">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.player_name}
                          className="h-20 w-20 object-cover rounded-lg shadow-sm bg-white p-1 border border-slate-200"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-lg bg-slate-100 border border-slate-200" />
                      )}
                      <div>
                        <div className="font-bold text-slate-900 line-clamp-1">
                          {item.player_name}
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-1 font-semibold">
                          {item.card_set}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleLiveSelect(item.id)}
                          className="text-[11px] font-bold text-red-600 hover:text-red-800 mt-2 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 border-l border-slate-200 lg:pl-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Reserve Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={draft.reservePrice}
                          onChange={e => updateLiveDraft(item.id, 'reservePrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          End Time (override)
                        </label>
                        <input
                          type="datetime-local"
                          value={draft.endTime}
                          onChange={e => updateLiveDraft(item.id, 'endTime', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Description (override)
                        </label>
                        <input
                          type="text"
                          value={draft.description}
                          onChange={e => updateLiveDraft(item.id, 'description', e.target.value)}
                          placeholder="Per-item hype text"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
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
                    await import('@/app/actions/inventory').then(m => m.updateStagedAuction(item.id, fd))
                    alert("Draft saved!")
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" step="0.01" name="reservePrice" defaultValue={item.auction_reserve_price || ''} placeholder="Reserve Price ($)" className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500" />
                    <input type="datetime-local" name="endTime" defaultValue={typeof item.auction_end_time === 'string' ? item.auction_end_time.substring(0, 16) : ''} className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500" />
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
          {liveItems.map(item => (
             <div key={item.id} className="border border-red-100 bg-red-50/30 p-4 rounded-xl flex items-center gap-4">
                <img src={item.image_url} alt="card" className="h-16 w-16 object-cover rounded shadow-sm bg-white p-0.5" />
                <div>
                  <div className="font-bold text-slate-900 line-clamp-1">{item.player_name}</div>
                  <div className="text-xs text-slate-500 line-clamp-1 mb-1">{item.card_set}</div>
                  <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm border border-red-200">Bidding Open</span>
                </div>
             </div>
          ))}
          {liveItems.length === 0 && (
             <div className="text-slate-500 text-sm col-span-full py-2">No auctions currently running.</div>
          )}
        </div>
      </div>
    </div>
  )
}
