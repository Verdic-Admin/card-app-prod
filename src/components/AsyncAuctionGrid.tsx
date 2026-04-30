'use client'

import { useState, useEffect, useMemo } from 'react'
import { price } from '@/utils/math'
import { ExternalLink } from 'lucide-react'
import { buildPlayerIndexForecasterUrl } from '@/lib/player-index-deeplink'
import { PlayerIndexForecastLink } from '@/components/PlayerIndexForecastLink'

interface AsyncItem {
  id: string
  image_url: string
  player_name: string
  card_set: string
  card_number?: string | null
  print_run?: string | null
  current_bid: number
  listed_price: number
  bidder_count: number
  auction_end_time: string
  oracle_projection?: number | null
  oracle_trend_percentage?: number | null
  is_rookie?: boolean
  is_auto?: boolean
  is_relic?: boolean
  grading_company?: string | null
  grade?: string | null
  auction_bid_increment?: number | null
  [key: string]: unknown
}

const HANDLE_KEY = 'pi_bidder_handle'
function getSavedHandle(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(HANDLE_KEY) || ''
}
function saveHandle(h: string) {
  if (typeof window !== 'undefined') localStorage.setItem(HANDLE_KEY, h)
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const diff = new Date(endTime).getTime() - now
  if (diff <= 0) return <span className="text-red-400 font-black text-xs uppercase tracking-wider animate-pulse">Auction Closed</span>

  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)

  const isUrgent = diff < 3600000 // less than 1 hour

  return (
    <div className={`font-mono text-sm font-black ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
      {d > 0 && <span>{d}d </span>}
      <span>{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
      {isUrgent && <span className="animate-pulse ml-1">🔥</span>}
    </div>
  )
}

function AsyncBidInput({ itemId, currentBid, bidIncrement, endTime, onBidPlaced }: {
  itemId: string
  currentBid: number
  bidIncrement: number
  endTime: string
  onBidPlaced: () => void
}) {
  const isExpired = new Date(endTime).getTime() <= Date.now()
  const [handle, setHandle] = useState('')
  const [hasStored, setHasStored] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // The minimum valid bid is always currentBid + 1 increment (rounded to cents)
  const minBid = parseFloat((currentBid + bidIncrement).toFixed(2))
  const [amount, setAmount] = useState(minBid)

  // Keep the stepper in sync if currentBid updates from polling
  useEffect(() => {
    setAmount(prev => {
      const newMin = parseFloat((currentBid + bidIncrement).toFixed(2))
      return prev < newMin ? newMin : prev
    })
  }, [currentBid, bidIncrement])

  useEffect(() => {
    const saved = getSavedHandle()
    if (saved) { setHandle(saved); setHasStored(true) }
  }, [])

  if (isExpired) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-center">
        <p className="text-zinc-400 text-sm font-bold">Auction Closed</p>
        <p className="text-zinc-500 text-xs mt-1">Winner pending shop approval.</p>
      </div>
    )
  }

  const step = (dir: 1 | -1) => {
    setAmount(prev => {
      const next = parseFloat((prev + dir * bidIncrement).toFixed(2))
      const floor = parseFloat((currentBid + bidIncrement).toFixed(2))
      return next < floor ? floor : next
    })
  }

  const submit = async () => {
    const trimmed = handle.trim()
    if (!trimmed) { setFeedback({ type: 'error', msg: 'Enter your handle' }); return }
    const floor = parseFloat((currentBid + bidIncrement).toFixed(2))
    if (amount < floor) {
      setFeedback({ type: 'error', msg: `Minimum bid is $${floor.toFixed(2)}` })
      return
    }
    setSubmitting(true); setFeedback(null)
    try {
      const { placeBidAction } = await import('@/app/actions/inventory')
      await placeBidAction(itemId, trimmed, amount)
      saveHandle(trimmed); setHasStored(true)
      setFeedback({ type: 'success', msg: 'Bid placed! 🎉' })
      onBidPlaced()
    } catch (e: unknown) {
      setFeedback({ type: 'error', msg: e instanceof Error ? e.message.replace(/^409 Conflict: /, '') : String(e) })
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-2">
      {hasStored ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Bidding as: <strong className="text-cyan-400">@{handle}</strong></span>
          <button type="button" onClick={() => { setHasStored(false); setHandle('') }} className="text-zinc-500 hover:text-zinc-300 font-bold">Change</button>
        </div>
      ) : (
        <input type="text" value={handle} onChange={e => setHandle(e.target.value)} placeholder="Your handle (@twitter, FB name)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 outline-none" />
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={submitting}
          className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-black text-xl hover:bg-zinc-700 disabled:opacity-40 flex items-center justify-center leading-none"
          aria-label="Decrease bid"
        >−</button>
        <div className="flex-1 text-center bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-3">
          <span className="text-zinc-500 font-bold text-sm">$</span>
          <span className="font-mono font-black text-xl text-white ml-0.5">{amount.toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={submitting}
          className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-black text-xl hover:bg-zinc-700 disabled:opacity-40 flex items-center justify-center leading-none"
          aria-label="Increase bid"
        >+</button>
      </div>
      <p className="text-[10px] text-zinc-600 text-center">
        Min bid: ${minBid.toFixed(2)} · Increment: ${bidIncrement.toFixed(2)}
      </p>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-2.5 rounded-lg text-sm transition-colors shadow-lg"
      >
        {submitting ? 'Submitting…' : `Place Bid — $${amount.toFixed(2)}`}
      </button>

      {feedback && <p className={`text-xs font-bold text-center ${feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.msg}</p>}
    </div>
  )
}


export function AsyncAuctionGrid({ initialItems }: { initialItems: AsyncItem[] }) {
  const [items, setItems] = useState<AsyncItem[]>(initialItems)

  // Slower polling for async auctions (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { getLiveAuctionStatus } = await import('@/app/actions/polling')
        const updates = await getLiveAuctionStatus()
        setItems(prev =>
          prev.map(item => {
            const up = updates.find((u: { id: string }) => u.id === item.id)
            if (up) return { ...item, current_bid: (up as any).current_bid, bidder_count: (up as any).bidder_count }
            return item
          }),
        )
      } catch {}
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {items.map(item => {
        const currentBid = price(item.current_bid || item.listed_price)
        const piUrl = buildPlayerIndexForecasterUrl(item)

        return (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl hover:-translate-y-1 transition-all duration-300">
            {/* Image */}
            <div className="relative aspect-[3/4] bg-zinc-950 flex items-center justify-center overflow-hidden">
              {item.image_url ? (
                <img src={item.image_url} alt={item.player_name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-zinc-500 text-sm font-bold">No image</span>
              )}
              {/* Countdown overlay */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent px-3 py-2">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <CountdownTimer endTime={item.auction_end_time} />
                </div>
              </div>
            </div>

            {/* Card info */}
            <div className="p-4">
              <h3 className="font-bold text-lg text-white leading-tight">{item.player_name}</h3>
              <p className="text-zinc-400 text-sm mb-1">{item.card_set}</p>

              {/* Badges */}
              {(item.is_rookie || item.is_auto || item.is_relic || (item.grading_company && item.grade)) && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {item.is_rookie && <span className="text-[9px] font-black bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 px-1.5 py-0.5 rounded-full uppercase">RC</span>}
                  {item.is_auto && <span className="text-[9px] font-black bg-blue-400/20 text-blue-400 border border-blue-400/40 px-1.5 py-0.5 rounded-full uppercase">Auto</span>}
                  {item.is_relic && <span className="text-[9px] font-black bg-purple-400/20 text-purple-400 border border-purple-400/40 px-1.5 py-0.5 rounded-full uppercase">Relic</span>}
                  {item.grading_company && item.grade && <span className="text-[9px] font-black bg-emerald-400/20 text-emerald-400 border border-emerald-400/40 px-1.5 py-0.5 rounded-full uppercase">{String(item.grading_company)} {String(item.grade)}</span>}
                </div>
              )}

              {/* PI forecast */}
              {item.oracle_projection != null && Number(item.oracle_projection) > 0 && (
                <PlayerIndexForecastLink href={piUrl} className="mb-2 block text-xs text-indigo-300 hover:text-indigo-200 font-bold transition-colors">
                  <ExternalLink className="w-3 h-3 inline mr-1" />
                  PI Fair: ${price(item.oracle_projection).toFixed(2)}
                  {item.oracle_trend_percentage != null && (
                    <span className={price(item.oracle_trend_percentage) >= 0 ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
                      ({price(item.oracle_trend_percentage) >= 0 ? '+' : ''}{price(item.oracle_trend_percentage).toFixed(1)}%)
                    </span>
                  )}
                </PlayerIndexForecastLink>
              )}

              {/* Current bid */}
              <div className="text-center font-mono font-black text-2xl text-cyan-400 bg-zinc-950 py-2.5 rounded-lg mb-3 shadow-inner border border-zinc-800 relative">
                ${currentBid.toFixed(2)}
                {item.bidder_count > 0 && (
                  <span className="absolute -top-2.5 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow border border-red-400">
                    {item.bidder_count}
                  </span>
                )}
              </div>

              {/* Bid input with auto-lock on expiry */}
              <AsyncBidInput
                itemId={item.id}
                currentBid={currentBid}
                bidIncrement={item.auction_bid_increment != null ? parseFloat(String(item.auction_bid_increment)) : 1.00}
                endTime={item.auction_end_time}
                onBidPlaced={() => {}}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
