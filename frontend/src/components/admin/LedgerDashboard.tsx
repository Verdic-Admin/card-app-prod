'use client'

import { useState, useMemo } from 'react'
import { Database } from '@/types/database.types'
import { Download, TrendingUp, DollarSign, Package } from 'lucide-react'

type InventoryItem = Database['public']['Tables']['inventory']['Row']

export function LedgerDashboard({ soldItems }: { soldItems: InventoryItem[] }) {
  const [shippingRate] = useState<number>(4.00)

  const { grossRevenue, totalCostBasis, netProfit, transactionsCount } = useMemo(() => {
    let gross = 0
    let cost = 0
    
    // Group by sold_at to deduce distinct transactions
    const transactions = new Set<string>()

    soldItems.forEach(item => {
      gross += (item.listed_price ?? item.avg_price ?? 0)
      cost += (item.cost_basis ?? 0)
      
      // If no sold_at exists from legacy data, fallback to ID to assume individual transaction
      const txKey = item.sold_at ? item.sold_at.substring(0, 16) : item.id
      transactions.add(txKey)
    })

    const totalShipping = transactions.size * shippingRate
    const profit = gross - cost - totalShipping

    return {
      grossRevenue: gross,
      totalCostBasis: cost,
      netProfit: profit,
      transactionsCount: transactions.size
    }
  }, [soldItems, shippingRate])

  const exportCSV = () => {
    const headers = ['Card_ID', 'Player', 'Year', 'Set', 'Listed_Price', 'Cost_Basis', 'Sold_Date']
    const rows = soldItems.map(item => [
      item.id,
      `"${(item.player_name || '').replace(/"/g, '""')}"`,
      `"${(item.year || '').replace(/"/g, '""')}"`,
      `"${(item.card_set || '').replace(/"/g, '""')}"`,
      (item.listed_price ?? item.avg_price ?? 0).toFixed(2),
      (item.cost_basis ?? 0).toFixed(2),
      item.sold_at || 'Unknown'
    ].join(','))

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tax_ledger_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (soldItems.length === 0) {
     return null
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
           <TrendingUp className="w-5 h-5 text-emerald-500" /> Financial Tax Ledger
         </h2>
         <button onClick={exportCSV} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> 1-Click CSV Export
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5"/> Gross Revenue</div>
            <div className="text-2xl font-black text-slate-900">${grossRevenue.toFixed(2)}</div>
         </div>
         <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Package className="w-3.5 h-3.5"/> Total Cost Basis</div>
            <div className="text-2xl font-black text-slate-900">${totalCostBasis.toFixed(2)}</div>
         </div>
         <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Package className="w-3.5 h-3.5"/> Shipping Fees ({transactionsCount} tx)</div>
            <div className="text-2xl font-black text-red-600">-${(transactionsCount * shippingRate).toFixed(2)}</div>
         </div>
         <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5"/> Net Profit</div>
            <div className="text-2xl font-black text-emerald-900">${netProfit.toFixed(2)}</div>
         </div>
      </div>
    </div>
  )
}
