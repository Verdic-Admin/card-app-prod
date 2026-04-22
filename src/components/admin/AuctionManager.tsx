'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  stageAuctionItems,
  type AuctionStageItemInput,
} from '@/app/actions/inventory'
import { Loader2, Package, CheckCircle2, X, AlertTriangle } from 'lucide-react'

interface AuctionManagerProps {
  initialItems: any[]
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

export function AuctionManager({ initialItems }: AuctionManagerProps) {
  const [items, setItems] = useState<any[]>(initialItems)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, ItemStagingDraft>>({})
  const [globalEndTime, setGlobalEndTime] = useState<string>('')
  const [globalDescription, setGlobalDescription] = useState<string>('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)

  const itemsForAuction = useMemo(
    () => items.filter(i => i.status === 'available' && !i.is_auction),
    [items],
  )
  const pendingItems = useMemo(
    () => items.filter(i => i.is_auction && i.auction_status === 'pending'),
    [items],
  )
  const selectedItems = useMemo(
    () => itemsForAuction.filter(i => selectedIds.has(i.id)),
    [itemsForAuction, selectedIds],
  )

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setDrafts(prev => {
      if (prev[id]) return prev
      return { ...prev, [id]: { ...EMPTY_DRAFT } }
    })
  }

  const updateDraft = (
    id: string,
    field: keyof ItemStagingDraft,
    value: string,
  ) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_DRAFT), [field]: value },
    }))
  }

  const applyGlobalsToSelected = () => {
    setDrafts(prev => {
      const next = { ...prev }
      for (const id of selectedIds) {
        next[id] = {
          ...(next[id] ?? EMPTY_DRAFT),
          endTime: globalEndTime || next[id]?.endTime || '',
          description: globalDescription || next[id]?.description || '',
        }
      }
      return next
    })
  }

  const handleCommit = async () => {
    setErrorMsg(null)
    setSuccessCount(null)

    if (selectedIds.size === 0) {
      setErrorMsg('Select at least one card to stage for auction.')
      return
    }

    const payload: AuctionStageItemInput[] = Array.from(selectedIds).map(id => {
      const d = drafts[id] ?? EMPTY_DRAFT
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

    setIsCommitting(true)
    try {
      const res = await stageAuctionItems(payload, {
        endTime: globalEndTime || null,
        description: globalDescription || null,
      })
      if (!res.success) {
        setErrorMsg(res.error)
        return
      }
      setSuccessCount(res.count)
      setItems(prev =>
        prev.map(i =>
          selectedIds.has(i.id)
            ? { ...i, is_auction: true, auction_status: 'pending' }
            : i,
        ),
      )
      setSelectedIds(new Set())
      setDrafts({})
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to stage items.')
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" /> Inventory to Auction Block
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Select available items, tune each card's reserve and timing below, then commit the batch to auction staging.
            </p>
          </div>
          <Link
            href="/admin/auction-studio"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-black transition-colors shadow-md flex items-center gap-2 text-sm uppercase tracking-wider"
          >
            Enter Auction Studio <span className="text-lg">→</span>
          </Link>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleCommit}
              disabled={selectedIds.size === 0 || isCommitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isCommitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Commit {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}to Auction
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set())
                  setDrafts({})
                }}
                className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear selection
              </button>
            )}
          </div>
          {pendingItems.length > 0 && (
            <div className="text-sm font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
              {pendingItems.length} item(s) currently staged in Auction Studio.
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold">{errorMsg}</p>
          </div>
        )}
        {successCount !== null && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="text-sm font-semibold">
              Committed {successCount} card{successCount === 1 ? '' : 's'} to the auction block.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2 pb-2">
          {itemsForAuction.map(item => {
            const isSelected = selectedIds.has(item.id)
            return (
              <div
                key={item.id}
                className={`border p-3 rounded-lg flex items-center gap-3 transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-200'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => toggleSelect(item.id)}
              >
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  checked={isSelected}
                  onChange={() => {}}
                />
                <div>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.player_name}
                      className="h-12 w-12 object-cover rounded shadow-sm"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-slate-100 border border-slate-200" />
                  )}
                  <div className="text-sm font-bold text-slate-800 line-clamp-1 mt-1">
                    {item.player_name}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-1">
                    {item.card_set}
                  </div>
                  {item.is_lot && (
                    <div className="text-xs bg-indigo-100 text-indigo-800 mt-1 inline-block px-1.5 rounded font-bold">
                      LOT BUNDLE
                    </div>
                  )}
                  {item.lot_id && (
                    <div className="text-xs bg-orange-100 text-orange-800 mt-1 inline-block px-1.5 rounded font-bold">
                      Child of Lot
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {itemsForAuction.length === 0 && (
            <div className="text-slate-500 text-sm col-span-full text-center py-8 bg-slate-50 rounded border border-slate-100">
              No available inventory to send to block.
            </div>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                Staging Setup ({selectedIds.size} selected)
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Each card gets its own reserve, end time, and description. Blank per-card fields fall back to the session defaults below.
              </p>
            </div>
          </div>

          {/* Session defaults */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                Session Defaults (optional)
              </div>
              <button
                type="button"
                onClick={applyGlobalsToSelected}
                disabled={!globalEndTime && !globalDescription}
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
                  value={globalEndTime}
                  onChange={e => setGlobalEndTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Default Description
                </label>
                <input
                  type="text"
                  value={globalDescription}
                  onChange={e => setGlobalDescription(e.target.value)}
                  placeholder="Applied when per-item description is empty"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Per-card staging rows */}
          <div className="space-y-4">
            {selectedItems.map(item => {
              const draft = drafts[item.id] ?? EMPTY_DRAFT
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
                        onClick={() => toggleSelect(item.id)}
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
                        onChange={e =>
                          updateDraft(item.id, 'reservePrice', e.target.value)
                        }
                        placeholder="0.00"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        End Time (override)
                      </label>
                      <input
                        type="datetime-local"
                        value={draft.endTime}
                        onChange={e =>
                          updateDraft(item.id, 'endTime', e.target.value)
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Description (override)
                      </label>
                      <input
                        type="text"
                        value={draft.description}
                        onChange={e =>
                          updateDraft(item.id, 'description', e.target.value)
                        }
                        placeholder="Per-item hype text"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
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
  )
}
