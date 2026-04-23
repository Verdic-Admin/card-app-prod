'use client'

import { useState } from 'react'
import { getAuctionBidHistoryForAdmin, type AuctionBidHistoryRow } from '@/app/actions/inventory'
import { History, Loader2, X } from 'lucide-react'

type Props = {
  itemId: string
  /** Shown in modal title */
  label?: string
  /** `dark` = zinc panel (admin inventory); `light` = auction studio cards */
  tone?: 'dark' | 'light'
  className?: string
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function AuctionBidLogButton({ itemId, label, tone = 'light', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bids, setBids] = useState<AuctionBidHistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openModal = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setBids(null)
    try {
      const res = await getAuctionBidHistoryForAdmin(itemId)
      if (res.success) {
        setBids(res.bids)
      } else {
        setError(res.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const btnDark =
    'inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-tight text-amber-400 hover:text-amber-300 border border-zinc-600 hover:border-amber-500/50 rounded px-2 py-1 bg-zinc-800/80'
  const btnLight =
    'inline-flex items-center gap-1 text-[10px] font-bold text-red-700 hover:text-red-900 border border-red-200 hover:border-red-300 rounded px-2 py-1 bg-white'

  return (
    <>
      <button type="button" onClick={openModal} className={`${tone === 'dark' ? btnDark : btnLight} ${className}`}>
        <History className="w-3 h-3" />
        Bid log
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`bid-log-title-${itemId}`}
          onClick={() => setOpen(false)}
        >
          <div
            className={`w-full max-w-lg max-h-[min(80vh,520px)] flex flex-col rounded-xl shadow-2xl border ${
              tone === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div
              className={`flex items-start justify-between gap-3 px-4 py-3 border-b ${
                tone === 'dark' ? 'border-zinc-800' : 'border-slate-100'
              }`}
            >
              <div className="min-w-0">
                <h2 id={`bid-log-title-${itemId}`} className="text-sm font-black tracking-tight truncate">
                  Bid history{label ? ` — ${label}` : ''}
                </h2>
                <p className={`text-[11px] mt-0.5 ${tone === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                  Emails come from the public bid form. Newest bids first.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                  tone === 'dark'
                    ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-12 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin opacity-70" />
                  Loading…
                </div>
              )}
              {error && !loading && (
                <div className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              {!loading && !error && bids && bids.length === 0 && (
                <p className={`text-sm py-8 text-center ${tone === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                  No bids recorded for this item yet.
                </p>
              )}
              {!loading && !error && bids && bids.length > 0 && (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={tone === 'dark' ? 'text-zinc-500' : 'text-slate-500'}>
                      <th className="py-2 pr-2 font-bold uppercase tracking-wider">When</th>
                      <th className="py-2 pr-2 font-bold uppercase tracking-wider">Bidder</th>
                      <th className="py-2 text-right font-bold uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody
                    className={
                      tone === 'dark' ? 'divide-y divide-zinc-800/80' : 'divide-y divide-slate-100'
                    }
                  >
                    {bids.map((b) => (
                      <tr key={b.id} className={tone === 'dark' ? 'text-zinc-200' : 'text-slate-800'}>
                        <td className="py-2 pr-2 font-mono whitespace-nowrap align-top">{formatWhen(b.created_at)}</td>
                        <td className="py-2 pr-2 break-all align-top" title={b.bidder_email}>
                          {b.bidder_email}
                        </td>
                        <td className="py-2 text-right font-mono font-bold whitespace-nowrap align-top">
                          ${b.bid_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
