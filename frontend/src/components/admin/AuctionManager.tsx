'use client'

import { useState } from 'react'
import { sendToAuctionBlock } from '@/app/actions/inventory'
import Link from 'next/link'

interface AuctionManagerProps {
  initialItems: any[]
}

export function AuctionManager({ initialItems }: AuctionManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Status arrays
  const itemsForAuction = initialItems.filter(i => i.status === 'available' && !i.is_auction)
  const pendingItems = initialItems.filter(i => i.is_auction && i.auction_status === 'pending')

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

  return (
    <div className="space-y-8">
      <div className="bg-white text-slate-900 p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
               <span>📦</span> Inventory to Auction Block
            </h2>
            <p className="text-sm text-slate-500 mt-1">Select available items to pull from the storefront and stage for live auction.</p>
          </div>
          <Link href="/admin/auction-studio" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-black transition-colors shadow-md flex items-center gap-2 text-sm uppercase tracking-wider">
            Enter Auction Studio <span className="text-lg">→</span>
          </Link>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <button 
            onClick={handleSendToBlock} 
            className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors" 
            disabled={selectedIds.size === 0}
          >
            Move Selected to Block ({selectedIds.size})
          </button>
          {pendingItems.length > 0 && (
             <div className="text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
               {pendingItems.length} item(s) currently staged waiting for broadcast.
             </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2 pb-2">
          {itemsForAuction.map(item => (
            <div key={item.id} className="border border-slate-200 p-3 rounded-lg flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleSelect(item.id)}>
              <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={selectedIds.has(item.id)} onChange={() => {}} />
              <div>
                <img src={item.image_url} alt="card" className="h-12 w-12 object-cover rounded shadow-sm" />
                <div className="text-sm font-bold text-slate-800 line-clamp-1">{item.player_name}</div>
                <div className="text-xs text-slate-500 line-clamp-1">{item.card_set}</div>
              </div>
            </div>
          ))}
          {itemsForAuction.length === 0 && <div className="text-slate-500 text-sm col-span-full text-center py-8 bg-slate-50 rounded border border-slate-100">No available inventory to send to block.</div>}
        </div>
      </div>
    </div>
  )
}
