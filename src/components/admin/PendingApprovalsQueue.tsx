'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, X } from 'lucide-react'
import { price } from '@/utils/math'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'

interface PendingAuction {
  id: string
  player_name: string
  card_set: string
  card_number?: string | null
  image_url?: string | null
  current_bid: number | string
  bidder_count: number
  auction_reserve_price?: number | string | null
  auction_end_time?: string | null
  winner_handle?: string | null
}

export function PendingApprovalsQueue() {
  const router = useRouter()
  const [items, setItems] = useState<PendingAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, { type: 'success' | 'error'; msg: string }>>({})

  useEffect(() => {
    loadPending()
  }, [])

  const loadPending = async () => {
    setLoading(true)
    try {
      const { getExpiredAuctionsPendingApproval } = await import('@/app/actions/inventory')
      const rows = await getExpiredAuctionsPendingApproval()
      setItems(rows as PendingAuction[])
    } catch { }
    setLoading(false)
  }

  const handleApprove = async (itemId: string) => {
    setApproving(itemId)
    setFeedback(prev => ({ ...prev, [itemId]: undefined as any }))
    try {
      const { approveAuctionWinner } = await import('@/app/actions/inventory')
      const res = await approveAuctionWinner(itemId)
      setFeedback(prev => ({
        ...prev,
        [itemId]: { type: 'success', msg: `Approved! Winner: ${res.winner} — $${res.amount.toFixed(2)}. Trade offer created.` },
      }))
      // Remove from list after a delay
      setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== itemId))
        router.refresh()
      }, 2000)
    } catch (e: unknown) {
      setFeedback(prev => ({
        ...prev,
        [itemId]: { type: 'error', msg: e instanceof Error ? e.message : 'Approval failed' },
      }))
    }
    setApproving(null)
  }

  const handleReject = async (itemId: string) => {
    try {
      const { removeFromAuctionBlock } = await import('@/app/actions/inventory')
      await removeFromAuctionBlock(itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
      router.refresh()
    } catch { }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading pending approvals...
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="bg-amber-950/30 border border-amber-700/50 rounded-xl p-5">
      <h2 className="text-lg font-black text-amber-400 mb-1 flex items-center gap-2">
        🔨 Pending Auction Approvals
        <span className="bg-amber-500 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">{items.length}</span>
        <InstructionTrigger 
          title="Auction Approvals Guide" 
          steps={[
            { 
              title: "1. Auction End", 
              content: "When a Live or 24/7 asynchronous auction runs out of time or hits its end date, it lands here. The card is temporarily locked in your inventory so no one else can buy it." 
            },
            { 
              title: "2. Review & Approve", 
              content: "Check the winning bid amount. If the reserve was met and you're happy with the final price, click 'Approve'. This instantly generates a pending order and emails the winner a secure checkout link." 
            },
            { 
              title: "3. Rejecting / Canceling", 
              content: "If you need to cancel the result (e.g., due to a suspected troll bidder or non-payment), click the 'X' to reject. The card will immediately return to your available inventory at its standard Buy It Now price." 
            }
          ]} 
        />
      </h2>
      <p className="text-sm text-amber-200/60 mb-4">
        These auctions have closed. Review the winning bid and approve to create a checkout link, or reject to return the card to inventory.
      </p>

      <div className="space-y-3">
        {items.map(item => {
          const bid = price(item.current_bid)
          const fb = feedback[item.id]

          return (
            <div key={item.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-4 flex-1">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-14 h-14 object-cover rounded-lg border border-zinc-700 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-zinc-700 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm line-clamp-1">{item.player_name}</div>
                  <div className="text-xs text-zinc-400 line-clamp-1">{item.card_set}{item.card_number ? ` #${item.card_number}` : ''}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="font-mono font-black text-cyan-400">${bid.toFixed(2)}</span>
                    <span className="text-zinc-500">{item.bidder_count} bid{item.bidder_count !== 1 ? 's' : ''}</span>
                    {item.winner_handle && (
                      <span className="text-emerald-400 font-bold">Winner: @{item.winner_handle}</span>
                    )}
                  </div>
                  {fb && (
                    <p className={`text-xs font-bold mt-1 ${fb.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fb.msg}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApprove(item.id)}
                  disabled={approving === item.id}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                >
                  {approving === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve Winner
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(item.id)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  title="Reject — return card to inventory"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
