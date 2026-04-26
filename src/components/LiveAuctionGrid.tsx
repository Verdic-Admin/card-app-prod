'use client'

import { useState, useEffect, useCallback } from 'react'
import { price } from '@/utils/math'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { buildPlayerIndexForecasterUrl } from '@/lib/player-index-deeplink'
import { PlayerIndexForecastLink } from '@/components/PlayerIndexForecastLink'

interface Item {
  id: string
  image_url: string
  back_image_url?: string | null
  coined_image_url?: string | null
  player_name: string
  card_set: string
  card_number?: string | null
  insert_name?: string | null
  parallel_name?: string | null
  parallel_insert_type?: string | null
  print_run?: string | null
  current_bid: number
  listed_price: number
  bidder_count: number
  oracle_projection?: number | null
  oracle_trend_percentage?: number | null
  is_rookie?: boolean
  is_auto?: boolean
  is_relic?: boolean
  grading_company?: string | null
  grade?: string | null
  [key: string]: unknown
}

type Slide = { key: string; label: string; url: string }

function slidesForItem(item: Item): Slide[] {
  const out: Slide[] = []
  if (item.image_url) out.push({ key: 'front', label: 'Front', url: item.image_url })
  if (item.back_image_url) out.push({ key: 'back', label: 'Back', url: String(item.back_image_url) })
  if (item.coined_image_url) out.push({ key: 'coin', label: 'Coin', url: String(item.coined_image_url) })
  return out.length ? out : []
}

const HANDLE_STORAGE_KEY = 'pi_bidder_handle'

function getSavedHandle(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(HANDLE_STORAGE_KEY) || ''
}

function saveHandle(handle: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(HANDLE_STORAGE_KEY, handle)
  }
}

/** Zero-Auth bid input — caches handle in localStorage for frictionless rebids. */
function BidInput({ itemId, currentBid, onBidPlaced }: { itemId: string; currentBid: number; onBidPlaced: () => void }) {
  const [handle, setHandle] = useState('')
  const [amount, setAmount] = useState('')
  const [hasStoredHandle, setHasStoredHandle] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    const saved = getSavedHandle()
    if (saved) {
      setHandle(saved)
      setHasStoredHandle(true)
    }
  }, [])

  const submit = async () => {
    const trimmed = handle.trim()
    if (!trimmed) { setFeedback({ type: 'error', msg: 'Enter your handle first' }); return }
    const numAmt = Number(amount)
    if (!numAmt || numAmt <= currentBid) {
      setFeedback({ type: 'error', msg: `Bid must be above $${currentBid.toFixed(2)}` })
      return
    }
    setIsSubmitting(true)
    setFeedback(null)
    try {
      const { placeBidAction } = await import('@/app/actions/inventory')
      await placeBidAction(itemId, trimmed, numAmt)
      saveHandle(trimmed)
      setHasStoredHandle(true)
      setAmount('')
      setFeedback({ type: 'success', msg: 'Bid placed!' })
      onBidPlaced()
    } catch (e: unknown) {
      setFeedback({ type: 'error', msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Handle row */}
      {hasStoredHandle ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            Bidding as: <strong className="text-cyan-400">@{handle}</strong>
          </span>
          <button
            type="button"
            onClick={() => { setHasStoredHandle(false); setHandle('') }}
            className="text-zinc-500 hover:text-zinc-300 font-bold transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={handle}
          onChange={e => setHandle(e.target.value)}
          placeholder="Your handle (@twitter, FB name, etc.)"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
        />
      )}

      {/* Bid amount + submit */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min={currentBid + 0.01}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={(currentBid + 1).toFixed(2)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white font-mono placeholder-zinc-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-lg text-sm transition-colors shadow-lg whitespace-nowrap"
        >
          {isSubmitting ? '...' : 'BID'}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <p className={`text-xs font-bold ${feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
          {feedback.msg}
        </p>
      )}
    </div>
  )
}

export function LiveAuctionGrid({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [slideById, setSlideById] = useState<Record<string, number>>({})

  const setSlide = useCallback((id: string, slides: Slide[], next: number) => {
    const len = slides.length
    if (len === 0) return
    const idx = ((next % len) + len) % len
    setSlideById(prev => ({ ...prev, [id]: idx }))
  }, [])

  // 3-second polling for real-time bid updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { getLiveAuctionStatus } = await import('@/app/actions/polling')
        const updates = await getLiveAuctionStatus()
        setItems(prevItems =>
          prevItems.map(item => {
            const up = updates.find((u: { id: string }) => u.id === item.id)
            if (up) {
              return {
                ...item,
                current_bid: (up as { current_bid: number }).current_bid,
                bidder_count: (up as { bidder_count: number }).bidder_count,
              }
            }
            return item
          }),
        )
      } catch (e) {
        console.error('Polling failed', e)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map(item => {
          const slides = slidesForItem(item)
          const idx = slideById[item.id] ?? 0
          const safeIdx = slides.length ? idx % slides.length : 0
          const current = slides[safeIdx]
          const piUrl = buildPlayerIndexForecasterUrl(item)
          const currentBid = price(item.current_bid || item.listed_price)

          return (
            <div
              key={item.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              {/* Image carousel */}
              <div className="relative aspect-[3/4] bg-zinc-950 flex items-center justify-center overflow-hidden group">
                {current ? (
                  <img src={current.url} alt={`${item.player_name} ${current.label}`} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-zinc-500 text-sm font-bold">No image</span>
                )}

                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => setSlide(item.id, slides, safeIdx - 1)}
                      className="absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-black/55 hover:bg-black/75 text-white p-2 rounded-full border border-zinc-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => setSlide(item.id, slides, safeIdx + 1)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-black/55 hover:bg-black/75 text-white p-2 rounded-full border border-zinc-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                      {slides.map((s, i) => (
                        <button
                          key={s.key}
                          type="button"
                          title={s.label}
                          onClick={() => setSlide(item.id, slides, i)}
                          className={`h-2 w-2 rounded-full border ${i === safeIdx ? 'bg-cyan-400 border-cyan-200' : 'bg-zinc-600 border-zinc-500 hover:bg-zinc-400'}`}
                        />
                      ))}
                    </div>
                    <div className="absolute top-2 right-2 z-20 bg-black/55 text-white text-[10px] font-black px-2 py-1 rounded border border-zinc-600 uppercase tracking-wider">
                      {current?.label ?? ''}
                    </div>
                  </>
                )}
              </div>

              {/* Card info */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-white leading-tight">{item.player_name}</h3>
                <p className="text-zinc-400 text-sm">{item.card_set}</p>

                {/* Player Index forecast */}
                {(item.oracle_projection != null && Number(item.oracle_projection) > 0) ||
                item.oracle_trend_percentage != null ? (
                  <PlayerIndexForecastLink
                    href={piUrl}
                    className="mt-2 mb-2 block rounded-lg border border-indigo-700/50 bg-indigo-950/50 px-2.5 py-2 hover:bg-indigo-900/50 transition-colors"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1 flex items-center justify-between gap-1">
                      <span>Player Index</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-80" aria-hidden />
                    </div>
                    {item.oracle_projection != null && Number(item.oracle_projection) > 0 && (
                      <div className="text-xs text-indigo-50 font-bold">
                        Fair value: ${price(item.oracle_projection).toFixed(2)}
                      </div>
                    )}
                    {item.oracle_trend_percentage != null && (
                      <div
                        className={`text-[11px] font-semibold mt-0.5 ${price(item.oracle_trend_percentage) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        Trend {price(item.oracle_trend_percentage) >= 0 ? '+' : '-'}
                        {Math.abs(price(item.oracle_trend_percentage)).toFixed(1)}%
                      </div>
                    )}
                  </PlayerIndexForecastLink>
                ) : null}

                {/* Badges */}
                {(item.is_rookie || item.is_auto || item.is_relic || (item.grading_company && item.grade)) && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                    {item.is_rookie && (
                      <span className="text-[9px] font-black bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">RC</span>
                    )}
                    {item.is_auto && (
                      <span className="text-[9px] font-black bg-blue-400/20 text-blue-400 border border-blue-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">Auto</span>
                    )}
                    {item.is_relic && (
                      <span className="text-[9px] font-black bg-purple-400/20 text-purple-400 border border-purple-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">Relic</span>
                    )}
                    {item.grading_company && item.grade && (
                      <span className="text-[9px] font-black bg-emerald-400/20 text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {String(item.grading_company)} {String(item.grade)}
                      </span>
                    )}
                  </div>
                )}

                {/* Current bid display */}
                <div className="text-center font-mono font-black text-3xl text-cyan-400 bg-zinc-950 py-3 rounded-lg mb-3 shadow-inner border border-zinc-800 relative">
                  ${currentBid.toFixed(2)}
                  {item.bidder_count > 0 && (
                    <span className="absolute -top-3 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow border border-red-400">
                      {item.bidder_count} Bids
                    </span>
                  )}
                </div>

                {/* Zero-Auth bid input */}
                <BidInput itemId={item.id} currentBid={currentBid} onBidPlaced={() => {}} />

                {/* Trade offer button */}
                <button
                  onClick={async () => {
                    const savedHandle = getSavedHandle()
                    const handle = savedHandle || window.prompt('Your handle (@twitter, FB name):')
                    if (!handle) return
                    const offer = window.prompt('Describe your trade offer (card(s), cash, or combo):')
                    if (!offer) return
                    try {
                      const { submitTradeOffer } = await import('@/app/actions/trades')
                      const fd = new FormData()
                      fd.append('name', handle)
                      fd.append('email', handle)
                      fd.append('offer', offer)
                      fd.append('targetItems', JSON.stringify([item.id]))
                      await submitTradeOffer(fd)
                      if (!savedHandle) saveHandle(handle)
                    } catch (e: unknown) {
                      console.error('Trade submit failed', e)
                    }
                  }}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-2 rounded-lg text-sm transition-colors shadow-lg"
                >
                  Offer Trade
                </button>
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <div className="col-span-full text-zinc-500 text-center py-10 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
            No items currently live on the block.
          </div>
        )}
      </div>
    </>
  )
}
