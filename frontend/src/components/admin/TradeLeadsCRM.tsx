'use client'

import { useEffect, useState } from 'react'
import { getAllTradeOffers, deleteTradeOfferRecord, clearTradeImageStorage } from '@/app/actions/trades'
import { Download, Trash2, ImageIcon, CheckSquare, Square, RefreshCcw } from 'lucide-react'

type TradeOffer = {
  id: string
  buyer_name: string
  buyer_email: string
  offer_text: string
  target_items: any[]
  attached_image_url: string | null
  status: string
  created_at: string
}

export function TradeLeadsCRM() {
  const [offers, setOffers] = useState<TradeOffer[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    setIsLoading(true)
    try {
       const data = await getAllTradeOffers()
       setOffers((data || []) as TradeOffer[])
    } catch(e) {
       console.error(e)
    } finally {
       setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleExportCSV = () => {
    if (offers.length === 0) return alert("No records to export.");
    const headers = ['Offer Date', 'Buyer Name', 'Email', 'Status', 'Offer Text', 'Target Items (JSON)', 'Attachment URL']
    const csvContent = [
        headers.join(','),
        ...offers.map(t => 
            `"${new Date(t.created_at).toLocaleDateString()}",` +
            `"${t.buyer_name}",` +
            `"${t.buyer_email}",` +
            `"${t.status}",` +
            `"${(t.offer_text || '').replace(/"/g, '""')}",` +
            `"${JSON.stringify(t.target_items).replace(/"/g, '""')}",` +
            `"${t.attached_image_url || ''}"`
        )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trade_leads_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const handleMassDelete = async () => {
     if (selectedIds.size === 0) return;
     if (!window.confirm(`Warning: This will permanently nuke ${selectedIds.size} records and their associated orphaned trade images. Proceed?`)) return;
     
     setIsLoading(true)
     for (const id of selectedIds) {
        const offer = offers.find(o => o.id === id)
        if (offer) {
           await deleteTradeOfferRecord(id, offer.attached_image_url)
        }
     }
     setSelectedIds(new Set())
     await loadData()
  }

  const handleClearImage = async (id: string, url: string) => {
     if (!window.confirm("Delete this heavy image file from cloud storage? You will keep the contact lead and offer natively.")) return;
     setIsLoading(true)
     await clearTradeImageStorage(id, url)
     await loadData()
  }

  const toggleSelect = (id: string) => {
     const next = new Set(selectedIds)
     if (next.has(id)) next.delete(id)
     else next.add(id)
     setSelectedIds(next)
  }
  
  const toggleAll = () => {
     if (selectedIds.size === offers.length) setSelectedIds(new Set())
     else setSelectedIds(new Set(offers.map(o => o.id)))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overscroll-contain">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
           <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Trade Leads CRM
           </h2>
           <p className="text-sm font-medium text-slate-500">
              Zero-cost footprint. Clear active images when done, export your localized leads.
           </p>
        </div>
        <div className="flex flex-wrap gap-3">
           <button onClick={loadData} className="px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Sync
           </button>
           <button onClick={handleExportCSV} className="px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" /> 1-Click Export CSV
           </button>
           <button onClick={handleMassDelete} disabled={selectedIds.size === 0} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:grayscale transition-colors flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Mass Cleanup ({selectedIds.size})
           </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left w-10">
                 <button onClick={toggleAll} className="text-slate-400 hover:text-indigo-600 transition-colors">
                    {selectedIds.size === offers.length && offers.length > 0 ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                 </button>
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Contact</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Offer Details</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Targets</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Storage</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100 text-sm">
            {offers.length === 0 ? (
               <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-medium">No Trade Offers Found. A clean slate!</td></tr>
            ) : offers.map(offer => (
              <tr key={offer.id} className={selectedIds.has(offer.id) ? "bg-indigo-50/50" : "hover:bg-slate-50"}>
                <td className="px-4 py-4 whitespace-nowrap">
                   <button onClick={() => toggleSelect(offer.id)} className={`${selectedIds.has(offer.id) ? "text-indigo-600" : "text-slate-300"} hover:text-indigo-600 transition-colors`}>
                      {selectedIds.has(offer.id) ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                   </button>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-slate-900 font-medium">
                   {new Date(offer.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-4">
                   <div className="font-bold text-slate-900">{offer.buyer_name}</div>
                   <div className="text-slate-500">{offer.buyer_email}</div>
                </td>
                <td className="px-4 py-4 text-slate-600 min-w-[250px] whitespace-pre-wrap">
                   {offer.offer_text}
                </td>
                <td className="px-4 py-4 text-slate-600">
                   <span className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded">{offer.target_items.length} items</span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                   {offer.attached_image_url ? (
                      <div className="flex flex-col gap-2">
                         <a href={offer.attached_image_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold flex items-center gap-1 hover:underline text-xs">
                            <ImageIcon className="w-3 h-3"/> View Upload
                         </a>
                         <button onClick={() => handleClearImage(offer.id, offer.attached_image_url!)} className="text-red-500 font-bold hover:underline flex items-center gap-1 text-[10px] uppercase tracking-wider">
                           <Trash2 className="w-3 h-3"/> Nuke File
                         </button>
                      </div>
                   ) : (
                      <span className="text-emerald-600 font-bold text-xs bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">Zero Footprint</span>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
