'use client'

import { useState, useEffect, useCallback } from 'react'
import { price } from '@/utils/math'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { buildPlayerIndexForecasterUrl } from '@/lib/player-index-deeplink'

interface Item {
  id: string
  image_url: string
  back_image_url?: string | null
  coined_image_url?: string | null
  video_url?: string
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

export function LiveAuctionGrid({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [slideById, setSlideById] = useState<Record<string, number>>({})

  const setSlide = useCallback((id: string, slides: Slide[], next: number) => {
    const len = slides.length
    if (len === 0) return
    const idx = ((next % len) + len) % len
    setSlideById(prev => ({ ...prev, [id]: idx }))
  }, [])

  // Polling loop — merge bid fields only; keep imagery + oracle columns from initial payload
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

          return (
            <div
              key={item.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              <div className="relative aspect-[3/4] bg-zinc-950 flex items-center justify-center overflow-hidden group">
                {item.video_url ? (
                  <>
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                      src={String(item.video_url)}
                    />
                    <div className="absolute top-2 left-2 bg-zinc-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2 py-1 rounded shadow drop-shadow-md flex items-center gap-1 z-10">
                      Surface Audit ✓
                    </div>
                  </>
                ) : current ? (
                  <img src={current.url} alt={`${item.player_name} ${current.label}`} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-zinc-500 text-sm font-bold">No image</span>
                )}

                {!item.video_url && slides.length > 1 && (
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

              <div className="p-4">
                <h3 className="font-bold text-lg text-white leading-tight">{item.player_name}</h3>
                <p className="text-zinc-400 text-sm">{item.card_set}</p>

                {(item.oracle_projection != null && Number(item.oracle_projection) > 0) ||
                item.oracle_trend_percentage != null ? (
                  <a
                    href={buildPlayerIndexForecasterUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 mb-2 block rounded-lg border border-indigo-700/50 bg-indigo-950/50 px-2.5 py-2 hover:bg-indigo-900/50 transition-colors"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1 flex items-center justify-between gap-1">
                      <span>Player Index</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-80" aria-hidden />
                    </div>
                    {item.oracle_projection != null && Number(item.oracle_projection) > 0 && (
                      <div className="text-xs text-indigo-50 font-bold">
                        Store fair marker: ${price(item.oracle_projection).toFixed(2)}
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
                    <p className="text-[10px] text-indigo-300/90 mt-1.5 leading-snug">
                      Open on Player Index to see the live projected value and run the calculator with this
                      card&apos;s details.
                    </p>
                  </a>
                ) : null}

                {(item.is_rookie || item.is_auto || item.is_relic || (item.grading_company && item.grade)) && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                    {item.is_rookie && (
                      <span className="text-[9px] font-black bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        RC
                      </span>
                    )}
                    {item.is_auto && (
                      <span className="text-[9px] font-black bg-blue-400/20 text-blue-400 border border-blue-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Auto
                      </span>
                    )}
                    {item.is_relic && (
                      <span className="text-[9px] font-black bg-purple-400/20 text-purple-400 border border-purple-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Relic
                      </span>
                    )}
                    {item.grading_company && item.grade && (
                      <span className="text-[9px] font-black bg-emerald-400/20 text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {String(item.grading_company)} {String(item.grade)}
                      </span>
                    )}
                  </div>
                )}

                <div className="text-center font-mono font-black text-3xl text-cyan-400 bg-zinc-950 py-3 rounded-lg mb-2 shadow-inner border border-zinc-800 relative">
                  ${price(item.current_bid || item.listed_price).toFixed(2)}
                  {item.bidder_count > 0 && (
                    <span className="absolute -top-3 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow border border-red-400">
                      {item.bidder_count} Bids
                    </span>
                  )}
                </div>

                <a
                  href={buildPlayerIndexForecasterUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mb-2 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest py-2 rounded-lg border border-indigo-500/50 bg-indigo-950/50 text-indigo-100 hover:bg-indigo-900/60 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Run on Player Index
                </a>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={async () => {
                      const amt = prompt('Enter bid amount:')
                      if (!amt || isNaN(Number(amt))) return
                      const email = prompt('Enter your email for confirmation:')
                      if (!email) return

                      try {
                        const { placeBidAction } = await import('@/app/actions/inventory')
                        await placeBidAction(item.id, email, Number(amt))
                        alert('Bid placed! Poller will update price shortly.')
                      } catch (e: unknown) {
                        alert(e instanceof Error ? e.message : String(e))
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-2 rounded text-sm transition-colors shadow-lg"
                  >
                    Bid Cash
                  </button>
                  <button
                    onClick={async () => {
                      const name = prompt('Your name:')
                      if (!name) return
                      const email = prompt('Your email:')
                      if (!email) return
                      const offer = prompt('Describe your trade offer (card(s), cash, or combo):')
                      if (!offer) return
                      try {
                        const { submitTradeOffer } = await import('@/app/actions/trades')
                        const fd = new FormData()
                        fd.append('name', name)
                        fd.append('email', email)
                        fd.append('offer', offer)
                        fd.append('targetItems', JSON.stringify([item.id]))
                        await submitTradeOffer(fd)
                        alert('Trade offer submitted! The seller will reach out via email.')
                      } catch (e: unknown) {
                        alert(`Failed to submit trade: ${e instanceof Error ? e.message : String(e)}`)
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-2 rounded text-sm transition-colors shadow-lg"
                  >
                    Offer Trade
                  </button>
                </div>
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
