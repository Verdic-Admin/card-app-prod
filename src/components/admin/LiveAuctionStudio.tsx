'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuctionQRCode } from './AuctionQRCode'
import { AuctionBidLogButton } from '@/components/admin/AuctionBidLogButton'
import {
  stageAuctionItems,
  updateStagedAuction,
  type AuctionStageItemInput,
} from '@/app/actions/inventory'
import { Loader2, CheckCircle2, X, AlertTriangle, Gavel, Search, Check } from 'lucide-react'
import { deriveDisplayPricing } from '@/utils/pricing'
import { price as priceNum } from '@/utils/math'

interface LiveAuctionStudioProps {
  initialItems: any[]
  initialProjectionTimeframe: string
  initialAuctionQrUrl?: string | null
  /** Store discount % for pricing line in staging (same as inventory / storefront). */
  discountRate?: number
  /** Highest bid row per auction item (from server; `auction_bids`). */
  auctionLeadByItemId?: Record<string, { bidder_email: string; bid_amount: number }>
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

function itemSearchHaystack(item: any): string {
  const pr = item.print_run != null ? String(item.print_run) : ''
  return [
    item.player_name,
    item.team_name,
    item.card_set,
    item.card_number,
    item.insert_name,
    item.parallel_name,
    item.parallel_insert_type,
    pr,
    pr ? `/${pr}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function LiveAuctionStudio({
  initialItems,
  initialProjectionTimeframe,
  initialAuctionQrUrl,
  discountRate = 0,
  auctionLeadByItemId = {},
}: LiveAuctionStudioProps) {
  const router = useRouter()
  const [items, setItems] = useState<any[]>(initialItems)
  const [timeframe, setTimeframe] = useState(initialProjectionTimeframe || '90-Day')
  const [isSavingTimeframe, setIsSavingTimeframe] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [liveQrUrl, setLiveQrUrl] = useState(initialAuctionQrUrl || '')

  const [inventoryQuery, setInventoryQuery] = useState('')
  const [stageSelection, setStageSelection] = useState<Set<string>>(new Set())
  const [stageDrafts, setStageDrafts] = useState<Record<string, ItemStagingDraft>>({})
  const [stageGlobalEnd, setStageGlobalEnd] = useState('')
  const [stageGlobalDesc, setStageGlobalDesc] = useState('')
  const [stageCommitting, setStageCommitting] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)
  const [stageSuccess, setStageSuccess] = useState<number | null>(null)

  const [coinFileLabel, setCoinFileLabel] = useState<Record<string, string>>({})

  const [editingLiveId, setEditingLiveId] = useState<string | null>(null)
  const [savingLiveId, setSavingLiveId] = useState<string | null>(null)
  const [goingLive, setGoingLive] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const pendingItems = useMemo(
    () => items.filter(i => i.is_auction && i.auction_status === 'pending'),
    [items],
  )
  const liveItems = useMemo(
    () => items.filter(i => i.is_auction && i.auction_status === 'live'),
    [items],
  )

  const availableFromInventory = useMemo(
    () =>
      items.filter(
        (i: any) =>
          i.status === 'available' &&
          !i.is_auction &&
          !i.lot_id,
      ),
    [items],
  )

  const filteredForPicker = useMemo(() => {
    const q = inventoryQuery.toLowerCase().trim()
    if (!q) return availableFromInventory
    const words = q.split(/\s+/).filter(Boolean)
    return availableFromInventory.filter((item: any) => {
      const h = itemSearchHaystack(item)
      return words.every(w => h.includes(w))
    })
  }, [availableFromInventory, inventoryQuery])

  const selectedFromInventory = useMemo(
    () => availableFromInventory.filter((i: any) => stageSelection.has(i.id)),
    [availableFromInventory, stageSelection],
  )

  const toggleStageSelect = (id: string) => {
    setStageSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setStageDrafts(prev => (prev[id] ? prev : { ...prev, [id]: { ...EMPTY_DRAFT } }))
  }

  const updateStageDraft = (id: string, field: keyof ItemStagingDraft, value: string) => {
    setStageDrafts(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_DRAFT), [field]: value },
    }))
  }

  const applyStageGlobals = () => {
    setStageDrafts(prev => {
      const next = { ...prev }
      for (const id of stageSelection) {
        next[id] = {
          ...(next[id] ?? EMPTY_DRAFT),
          endTime: stageGlobalEnd || next[id]?.endTime || '',
          description: stageGlobalDesc || next[id]?.description || '',
        }
      }
      return next
    })
  }

  const handleStageToAuction = async () => {
    setStageError(null)
    setStageSuccess(null)
    if (stageSelection.size === 0) {
      setStageError('Select at least one card, then click Stage to auction.')
      return
    }
    const payload: AuctionStageItemInput[] = Array.from(stageSelection).map(id => {
      const d = stageDrafts[id] ?? EMPTY_DRAFT
      const reservePriceNum = d.reservePrice ? Number(d.reservePrice) : null
      return {
        id,
        reservePrice:
          reservePriceNum != null && Number.isFinite(reservePriceNum) ? reservePriceNum : null,
        endTime: d.endTime || null,
        description: d.description || null,
      }
    })

    setStageCommitting(true)
    try {
      const res = await stageAuctionItems(payload, {
        endTime: stageGlobalEnd || null,
        description: stageGlobalDesc || null,
      })
      if (!res.success) {
        setStageError(res.error ?? 'Failed to stage.')
        return
      }
      setStageSuccess(res.count)
      setItems(prev =>
        prev.map((i: any) =>
          stageSelection.has(i.id) ? { ...i, is_auction: true, auction_status: 'pending' } : i,
        ),
      )
      setStageSelection(new Set())
      setStageDrafts({})
      setInventoryQuery('')
      router.refresh()
    } catch (e: unknown) {
      setStageError(e instanceof Error ? e.message : 'Failed to stage items.')
    } finally {
      setStageCommitting(false)
    }
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
      showToast('success', 'Batch codes generated. Refresh to view.')
      router.refresh()
    }
  }

  const handleSaveLiveAuctionMeta = async (itemId: string, formData: FormData) => {
    setSavingLiveId(itemId)
    try {
      const res = await updateStagedAuction(itemId, formData)
      setItems(prev =>
        prev.map((i: any) =>
          i.id === itemId
            ? {
                ...i,
                coined_image_url: res.coined_image_url ?? i.coined_image_url,
                auction_reserve_price: formData.get('reservePrice')
                  ? Number(formData.get('reservePrice'))
                  : i.auction_reserve_price,
                auction_end_time: (formData.get('endTime') as string) || i.auction_end_time,
                auction_description: (formData.get('description') as string) || i.auction_description,
              }
            : i,
        ),
      )
      showToast('success', 'Live auction item updated.')
      setEditingLiveId(null)
    } catch (e: any) {
      showToast('error', `Failed to save: ${e?.message || 'Unknown error'}`)
    } finally {
      setSavingLiveId(null)
    }
  }

  return (
    <div className="space-y-8 relative">
      {/* Inline toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-2xl border text-sm font-bold flex items-center gap-2 animate-slide-in ${
          toastMsg.type === 'success' ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-red-950 border-red-700 text-red-300'
        }`}>
          {toastMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toastMsg.text}
          <button type="button" onClick={() => setToastMsg(null)} className="ml-2 opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Auction Studio Controls</h2>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: settings */}
          <div className="flex flex-col gap-5 flex-1">
            {/* Projection timeframe */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Projection timeframe</label>
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
              {!isSavingTimeframe && (
                <span className="text-xs text-emerald-600 font-semibold">Active: {timeframe}</span>
              )}
            </div>

            {/* QR toggle + URL */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">Live Bidding QR Code</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Show a QR code on screen during your stream so viewers can scan to place bids.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showQR}
                  onClick={() => setShowQR(v => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    showQR ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                      showQR ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {showQR && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Bidding Page URL
                  </label>
                  <input
                    type="url"
                    value={liveQrUrl}
                    onChange={e => setLiveQrUrl(e.target.value)}
                    placeholder="https://yourstore.com/auction"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Paste the full URL to your live auctions page — this is what the QR code will scan to.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: live QR preview */}
          {showQR && (
            <div className="flex items-center justify-center lg:w-56 shrink-0">
              <AuctionQRCode
                isVisible
                toggleVisibility={() => setShowQR(false)}
                url={liveQrUrl || null}
              />
            </div>
          )}
        </div>
      </div>

      {/* 1) Pick from inventory → stage */}
      <div
        id="add-from-inventory"
        className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Gavel className="w-5 h-5 text-indigo-600" /> 1. Add cards from inventory
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Search and check the cards you want to run on your stream, set a reserve price and end time, then click
              "Stage to auction" to move them into the queue below. Bundled lot cards won't appear here — break them
              apart in your inventory first.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleStageToAuction}
              disabled={stageSelection.size === 0 || stageCommitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {stageCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Stage {stageSelection.size > 0 ? `${stageSelection.size} ` : ''}to auction
            </button>
            {stageSelection.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStageSelection(new Set())
                  setStageDrafts({})
                }}
                className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {stageError && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold">{stageError}</p>
          </div>
        )}
        {stageSuccess !== null && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="text-sm font-semibold">
              Staged {stageSuccess} card{stageSuccess === 1 ? '' : 's'}. They appear in the staging area — add coin
              photos, then <strong>GO LIVE</strong>.
            </p>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={inventoryQuery}
            onChange={e => setInventoryQuery(e.target.value)}
            placeholder="Typeahead: player, team, set, #, parallel, print /99…"
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-slate-500 mb-2">
          Showing {filteredForPicker.length} of {availableFromInventory.length} available card
          {availableFromInventory.length !== 1 ? 's' : ''} not yet on the auction block.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[min(400px,50vh)] overflow-y-auto pr-1 border border-slate-100 rounded-lg p-2 bg-slate-50/50">
          {filteredForPicker.map((item: any) => {
            const isSelected = stageSelection.has(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleStageSelect(item.id)}
                className={`text-left border p-2.5 rounded-lg flex items-start gap-2 transition-colors ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                    : 'border-slate-200 hover:bg-white bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={isSelected}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 pointer-events-none"
                />
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-12 w-12 object-cover rounded shadow-sm border border-slate-200"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-slate-200 border border-slate-200" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800 line-clamp-1">{item.player_name}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">
                    {item.card_set}
                    {item.card_number != null && item.card_number !== '' ? ` · #${item.card_number}` : ''}
                    {item.print_run != null && item.print_run !== '' ? ` /${item.print_run}` : ''}
                  </div>
                  {(() => {
                    const p = deriveDisplayPricing({
                      listed_price: item.listed_price,
                      avg_price: item.avg_price,
                      oracle_projection: item.oracle_projection,
                      oracle_discount_percentage: discountRate,
                    })
                    return (
                      <div className="text-[10px] font-mono text-emerald-800 mt-0.5">
                        Store: ${p.effectiveStorePrice.toFixed(2)}
                        {p.hasProjection && (
                          <span className="text-slate-500">
                            {' '}
                            (PI {p.hasManualOverride ? '· manual' : '· ' + p.discountPercent.toFixed(0) + '% off PI'})
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </button>
            )
          })}
        </div>
        {availableFromInventory.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-6 bg-slate-50 rounded border border-slate-100">
            No eligible inventory (all cards on auction, sold, or lot children).
          </div>
        )}

        {stageSelection.size > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Session defaults (optional)
                </div>
                <button
                  type="button"
                  onClick={applyStageGlobals}
                  disabled={!stageGlobalEnd && !stageGlobalDesc}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 rounded px-3 py-1.5 transition-colors disabled:opacity-40"
                >
                  Apply defaults to selected
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Default end time
                  </label>
                  <input
                    type="datetime-local"
                    value={stageGlobalEnd}
                    onChange={e => setStageGlobalEnd(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Default description
                  </label>
                  <input
                    type="text"
                    value={stageGlobalDesc}
                    onChange={e => setStageGlobalDesc(e.target.value)}
                    placeholder="Applied when per-item description is empty"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {selectedFromInventory.map((item: any) => {
                const draft = stageDrafts[item.id] ?? EMPTY_DRAFT
                return (
                  <div
                    key={item.id}
                    className="border border-slate-200 bg-white p-3 rounded-xl flex flex-col md:flex-row gap-3"
                  >
                    <div className="flex items-start gap-2 md:w-1/3">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-16 w-16 object-cover rounded border border-slate-200"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded bg-slate-100 border border-slate-200" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 line-clamp-1 text-sm">{item.player_name}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{item.card_set}</div>
                        <button
                          type="button"
                          onClick={() => toggleStageSelect(item.id)}
                          className="text-[10px] font-bold text-rose-600 mt-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Reserve ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={draft.reservePrice}
                          onChange={e => updateStageDraft(item.id, 'reservePrice', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">End time</label>
                        <input
                          type="datetime-local"
                          value={draft.endTime}
                          onChange={e => updateStageDraft(item.id, 'endTime', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Description</label>
                        <input
                          type="text"
                          value={draft.description}
                          onChange={e => updateStageDraft(item.id, 'description', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                          placeholder="Hype / notes"
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

      {/* 2) Staging: coin photo + go live */}
      <div
        id="auction-staging"
        className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-amber-500">2.</span> Staging (pending) — coin photo, then go live
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Edit reserve, end, description, attach a <strong>coin verification</strong> photo, save each row, then
              <strong> GO LIVE</strong> so bidders see the card on /auction.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenBatch}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
              disabled={pendingItems.length === 0}
            >
              Generate batch codes
            </button>
            <button
              type="button"
              disabled={goingLive || pendingItems.length === 0}
              onClick={async () => {
                const checked = document.querySelectorAll('input[name="stagedItemRadio"]:checked')
                let ids: string[]
                if (checked.length > 0) {
                  ids = Array.from(checked).map(i => (i as HTMLInputElement).value)
                } else if (pendingItems.length > 0) {
                  ids = pendingItems.map(p => p.id)
                } else {
                  showToast('error', 'No staged items.')
                  return
                }
                setGoingLive(true)
                try {
                  await import('@/app/actions/inventory').then(m => m.goLiveWithAuctions(ids))
                  setItems(prev =>
                    prev.map((i: any) => (ids.includes(i.id) ? { ...i, auction_status: 'live' } : i)),
                  )
                  router.refresh()
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : String(e)
                  showToast('error', `Could not go live: ${msg}`)
                } finally {
                  setGoingLive(false)
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-black tracking-widest transition-colors shadow-lg disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
            >
              {goingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              GO LIVE
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {pendingItems.map(item => {
            const p = deriveDisplayPricing({
              listed_price: item.listed_price,
              avg_price: item.avg_price,
              oracle_projection: item.oracle_projection,
              oracle_discount_percentage: discountRate,
            })
            return (
              <div
                key={item.id}
                className="border border-slate-200 p-4 rounded-lg flex flex-col gap-4 bg-slate-50"
              >
                <div className="flex items-start gap-3 flex-col lg:flex-row">
                  <div className="flex items-start gap-3 flex-1 w-full">
                    <input
                      type="checkbox"
                      name="stagedItemRadio"
                      value={item.id}
                      defaultChecked
                      className="w-5 h-5 mt-1 rounded border-slate-300 text-emerald-600"
                    />
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-20 w-20 object-cover rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded bg-slate-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-lg text-slate-900 line-clamp-1">{item.player_name}</div>
                      {item.team_name ? (
                        <div className="text-sm text-slate-600 font-medium">{item.team_name}</div>
                      ) : null}
                      <div className="text-sm text-slate-500 line-clamp-2">
                        {item.card_set}
                        {item.card_number != null && String(item.card_number) !== ''
                          ? ` · #${item.card_number}`
                          : ''}
                        {item.print_run != null && String(item.print_run) !== '' ? ` /${item.print_run}` : ''}
                        {item.parallel_name != null && String(item.parallel_name).toLowerCase() !== 'base'
                          ? ` · ${item.parallel_name}`
                          : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="font-mono font-bold text-emerald-800">
                          Current store: ${p.effectiveStorePrice.toFixed(2)}
                        </span>
                        {p.hasProjection && (
                          <span className="text-slate-500">
                            PI ref: ${p.playerIndexPrice.toFixed(2)}
                            {p.hasManualOverride && (
                              <span className="text-amber-700 font-semibold ml-1">(manual list)</span>
                            )}
                          </span>
                        )}
                        {item.listed_price != null && priceNum(item.listed_price) > 0 && (
                          <span className="text-slate-600">Listed ${priceNum(item.listed_price).toFixed(2)}</span>
                        )}
                      </div>
                      {item.verification_code ? (
                        <div className="text-emerald-600 font-mono font-bold mt-2 inline-block text-sm bg-emerald-100 px-2 py-0.5 rounded">
                          {item.verification_code}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-sm mt-1 font-mono">No ID generated</div>
                      )}
                      {item.coined_image_url && (
                        <div className="text-indigo-600 text-xs font-bold mt-1">Coin photo attached</div>
                      )}
                    </div>
                  </div>
                </div>

                <form
                  className="flex flex-col gap-2 border-t border-slate-200 pt-3"
                  encType="multipart/form-data"
                  onSubmit={async e => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    try {
                      const res = await updateStagedAuction(item.id, fd)
                      setItems(prev =>
                        prev.map((i: any) =>
                          i.id === item.id
                            ? {
                                ...i,
                                coined_image_url: res.coined_image_url ?? i.coined_image_url,
                                auction_reserve_price: fd.get('reservePrice')
                                  ? Number(fd.get('reservePrice'))
                                  : i.auction_reserve_price,
                                auction_end_time: (fd.get('endTime') as string) || i.auction_end_time,
                                auction_description: (fd.get('description') as string) || i.auction_description,
                              }
                            : i,
                        ),
                      )
                      setCoinFileLabel(prev => ({ ...prev, [item.id]: '' }))
                      router.refresh()
                      showToast('success', 'Saved.')
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err)
                      showToast('error', `Could not save: ${msg}`)
                    }
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      name="reservePrice"
                      defaultValue={item.auction_reserve_price || ''}
                      placeholder="Reserve ($)"
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                    />
                    <input
                      type="datetime-local"
                      name="endTime"
                      defaultValue={
                        typeof item.auction_end_time === 'string' ? item.auction_end_time.substring(0, 16) : ''
                      }
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    name="description"
                    defaultValue={item.auction_description || ''}
                    placeholder="Auction description (e.g. Grading, note)"
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm w-full"
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <label
                        htmlFor={`coin-input-${item.id}`}
                        className="inline-flex items-center justify-center cursor-pointer bg-white px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 hover:bg-slate-50 shrink-0"
                      >
                        Choose coin photo
                      </label>
                      <input
                        id={`coin-input-${item.id}`}
                        name="coinedImage"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          setCoinFileLabel(prev => ({
                            ...prev,
                            [item.id]: f ? f.name : '',
                          }))
                        }}
                      />
                      <span className="text-xs text-slate-500 truncate" title={coinFileLabel[item.id]}>
                        {coinFileLabel[item.id] || 'No new file selected'}
                      </span>
                    </div>
                    <button
                      type="submit"
                      className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-indigo-700"
                    >
                      Save row
                    </button>
                  </div>
                </form>
              </div>
            )
          })}
          {pendingItems.length === 0 && (
            <div className="text-slate-500 text-sm py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
              Nothing in staging. Use section 1 above to add cards from inventory.
            </div>
          )}
        </div>
      </div>

      {/* 3) Live */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-slate-900">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          3. Live on auction
        </h2>
        <p className="text-sm text-slate-500 mb-6">These listings accept bids on the public auction page.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveItems.map(item => (
            <div key={item.id} className="border border-red-100 bg-red-50/30 p-4 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="h-16 w-16 object-cover rounded border" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 line-clamp-1">{item.player_name}</div>
                    <div className="text-xs text-slate-500 line-clamp-1 mb-1">{item.card_set}</div>
                    <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-red-200">
                      Bidding open
                    </span>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                      <div className="font-mono">
                        High:{' '}
                        <strong className="text-slate-900">${priceNum(item.current_bid || item.listed_price || 0).toFixed(2)}</strong>
                        {Number(item.bidder_count ?? 0) > 0 && (
                          <span className="text-slate-500 font-sans font-medium">
                            {' '}
                            · {Number(item.bidder_count)} bid{Number(item.bidder_count) === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      {auctionLeadByItemId[item.id] && (
                        <div className="break-all" title={auctionLeadByItemId[item.id].bidder_email}>
                          <span className="text-slate-500 font-sans">Leading handle: </span>
                          <span className="font-medium text-slate-900">@{auctionLeadByItemId[item.id].bidder_email}</span>
                        </div>
                      )}
                      <AuctionBidLogButton itemId={item.id} label={item.player_name} tone="light" />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingLiveId(prev => (prev === item.id ? null : item.id))}
                  className="text-xs font-bold px-2 py-1.5 rounded border border-red-200 bg-white text-red-700 shrink-0"
                >
                  {editingLiveId === item.id ? 'Close' : 'Edit'}
                </button>
              </div>
              {editingLiveId === item.id && (
                <form
                  encType="multipart/form-data"
                  onSubmit={async e => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    await handleSaveLiveAuctionMeta(item.id, fd)
                  }}
                  className="bg-white border border-red-100 rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      name="reservePrice"
                      defaultValue={item.auction_reserve_price || ''}
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                    />
                    <input
                      type="datetime-local"
                      name="endTime"
                      defaultValue={
                        typeof item.auction_end_time === 'string' ? item.auction_end_time.substring(0, 16) : ''
                      }
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    name="description"
                    defaultValue={item.auction_description || ''}
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`live-coin-${item.id}`}
                      className="text-xs font-bold text-slate-700 border border-slate-200 rounded px-2 py-1 cursor-pointer bg-slate-50"
                    >
                      Coin photo
                    </label>
                    <input
                      id={`live-coin-${item.id}`}
                      name="coinedImage"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingLiveId === item.id}
                    className="bg-red-600 text-white rounded py-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    {savingLiveId === item.id ? 'Saving…' : 'Save'}
                  </button>
                </form>
              )}
            </div>
          ))}
          {liveItems.length === 0 && (
            <div className="text-slate-500 text-sm col-span-full py-2">No live auctions right now.</div>
          )}
        </div>
      </div>
    </div>
  )
}
