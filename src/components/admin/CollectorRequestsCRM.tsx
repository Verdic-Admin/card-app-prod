'use client'

import { useState } from 'react'
import { TradeLeadsCRM } from './TradeLeadsCRM'
import { CoinRequestsCRM } from './CoinRequestsCRM'

export function CollectorRequestsCRM() {
  const [activeTab, setActiveTab] = useState<'trades' | 'coins'>('trades')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            📥 Collector Requests Inbox
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Centralized task management for incoming trades, orders, and photo requests.
          </p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('trades')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'trades' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Trades & Orders
          </button>
          <button 
            onClick={() => setActiveTab('coins')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'coins' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Coin Photo Requests
          </button>
        </div>
      </div>
      
      <div className="p-0">
         {activeTab === 'trades' && (
           <div className="[&>div]:border-none [&>div]:shadow-none [&>div]:rounded-none">
             <TradeLeadsCRM />
           </div>
         )}
         {activeTab === 'coins' && (
           <div className="[&>div]:border-none [&>div]:shadow-none [&>div]:rounded-none">
             <CoinRequestsCRM />
           </div>
         )}
      </div>
    </div>
  )
}
