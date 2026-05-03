'use client'

import { useEffect, useState } from 'react'
import { getAllTradeOffers, deleteTradeOfferRecord, clearTradeImageStorage, approveManualPayment } from '@/app/actions/trades'
import { Download, Trash2, ImageIcon, CheckSquare, Square, RefreshCcw, DollarSign, PackageCheck, Handshake, Check, AlertTriangle, X } from 'lucide-react'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'

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
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ msg: string; onConfirm: () => void } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000)
  }

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
    const csvContent = [
      ["Date", "Status", "Buyer Name", "Contact", "Offer Text", "Target Item Count"],
      ...offers.map(o => [
         new Date(o.created_at).toLocaleDateString(),
         o.status,
         o.buyer_name,
         o.buyer_email,
         `"${o.offer_text.replace(/"/g, '""')}"`,
         o.target_items.length
      ])
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trade_offers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  }

  const renderOfferDetails = (offer: any) => {
    if (offer.status === 'pending_payment') {
      return (
        <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
           {offer.offer_text.split('\n').map((line: string, i: number) => <div key={i}>{line}</div>)}
        </div>
      );
    }

    try {
      const parsed = JSON.parse(offer.offer_text);
      if (parsed && parsed.offerItems) {
        return (
          <div className="space-y-3">
             <div className="text-xs bg-slate-50 p-2 border border-slate-200 rounded">
                <span className="font-bold text-slate-700">Contact Method:</span> {parsed.contactMethod} ({parsed.contactValue})<br/>
                {parsed.notes && <><span className="font-bold text-slate-700 mt-1 block">Notes:</span> {parsed.notes}</>}
             </div>
             {parsed.offerItems.length > 0 && (
                <div className="space-y-2 mt-2">
                   <div className="text-[10px] font-bold text-slate-400 uppercase">Trade Items Offered:</div>
                   {parsed.offerItems.map((item: any, idx: number) => (
                     <div key={idx} className="flex gap-3 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <div className="flex-1">
                           <div className="font-bold text-slate-900 leading-tight">{item.playerName}</div>
                           <div className="text-[11px] text-slate-500 mt-0.5">{item.cardSet} {item.cardNumber} {item.parallelName} {item.grade}</div>
                           <div className="text-xs font-black text-emerald-600 mt-1">Est. Value: ${item.marketPrice?.toFixed(2)}</div>
                        </div>
                     </div>
                   ))}
                </div>
             )}
          </div>
        );
      }
    } catch (e) {
      // Fallback
    }

    return <div>{offer.offer_text}</div>;
  };

  const handleMassDelete = async () => {
     if (selectedIds.size === 0) return;
     setConfirmAction({
       msg: `Permanently nuke ${selectedIds.size} records and their orphaned trade images?`,
       onConfirm: async () => {
         setConfirmAction(null)
         setIsLoading(true)
         for (const id of selectedIds) {
            const offer = offers.find(o => o.id === id)
            if (offer) await deleteTradeOfferRecord(id, offer.attached_image_url)
         }
         setSelectedIds(new Set())
         await loadData()
         showToast('success', `Deleted ${selectedIds.size} records.`)
       }
     })
  }

  const handleClearImage = async (id: string, url: string) => {
     setConfirmAction({
       msg: 'Delete this image file from cloud storage? The contact lead and offer will be kept.',
       onConfirm: async () => {
         setConfirmAction(null)
         setIsLoading(true)
         await clearTradeImageStorage(id, url)
         await loadData()
         showToast('success', 'Image file deleted.')
       }
     })
  }

  const handleApprovePayment = async (offerId: string) => {
     setConfirmAction({
       msg: 'Confirm you have received the funds? This will mark the inventory items as SOLD.',
       onConfirm: async () => {
         setConfirmAction(null)
         setIsLoading(true)
         await approveManualPayment(offerId)
         await loadData()
         showToast('success', 'Order paid & marked as sold!')
       }
     })
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overscroll-contain relative">
      {/* Inline toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-2xl border text-sm font-bold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-red-950 border-red-700 text-red-300'}`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className="ml-2 opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4">
            <p className="text-slate-900 font-bold mb-4">{confirmAction.msg}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={confirmAction.onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
           <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Trade & Order Inbox
              <InstructionTrigger 
                title="Trade & Order Inbox Rules" 
                steps={[
                  { 
                    title: "1. Incoming Cash Checkouts", 
                    content: "Buyers checking out manually will appear here. When they check out, their items are temporarily locked ('Pending Payment') in your inventory so no one else can snipe them." 
                  },
                  { 
                    title: "2. Trade Proposals", 
                    content: "If a collector proposes a trade, you'll see their attached photos and notes. You can reach out to them via their provided email to negotiate the deal." 
                  },
                  { 
                    title: "3. Approving Payments", 
                    content: "Once you verify the funds have hit your PayPal, Venmo, or CashApp, click 'Approve Payment'. This permanently marks the inventory as 'Sold' and logs the transaction for your ledger." 
                  },
                  { 
                    title: "4. Expirations & Clean Up", 
                    content: "Unpaid checkouts expire automatically after a set time (usually 7 days) and return to your available inventory. Use 'Mass Cleanup' to clear out old, rejected, or completed trade logs." 
                  }
                ]} 
              />
           </h2>
           <p className="text-sm font-medium text-slate-500">
              Manage incoming trade proposals and verify pending cash checkouts seamlessly.
           </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <button onClick={loadData} className="flex-1 sm:flex-none justify-center px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Sync
           </button>
           <button onClick={handleExportCSV} className="flex-1 sm:flex-none justify-center px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2 whitespace-nowrap">
              <Download className="w-4 h-4" /> CSV
           </button>
           <button onClick={handleMassDelete} disabled={selectedIds.size === 0} className="flex-1 sm:flex-none justify-center px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:grayscale transition-colors flex items-center gap-2 whitespace-nowrap">
              <Trash2 className="w-4 h-4" /> Cleanup ({selectedIds.size})
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:hidden">
        {offers.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 font-medium bg-white rounded-xl border border-dashed border-slate-200">No Trade Offers Found.</div>
        ) : (
          offers.map(offer => (
            <div key={offer.id} className={`bg-white rounded-xl border p-4 shadow-sm space-y-4 transition-colors ${selectedIds.has(offer.id) ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleSelect(offer.id)} className={`${selectedIds.has(offer.id) ? "text-indigo-600" : "text-slate-300"} hover:text-indigo-600 transition-colors`}>
                    {selectedIds.has(offer.id) ? <CheckSquare className="w-6 h-6"/> : <Square className="w-6 h-6"/>}
                  </button>
                  <div className="text-slate-900 font-bold">{new Date(offer.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  {offer.status === 'pending_payment' ? (
                    <span className="bg-amber-100 text-amber-700 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-200 shadow-sm flex items-center gap-1"><DollarSign className="w-3 h-3"/> Checkout</span>
                  ) : offer.status === 'completed' ? (
                    <span className="bg-emerald-100 text-emerald-700 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-200 shadow-sm flex items-center gap-1"><Check className="w-3 h-3"/> Paid</span>
                  ) : (
                    <span className="bg-cyan-100 text-cyan-700 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-cyan-200 shadow-sm flex items-center gap-1"><Handshake className="w-3 h-3"/> Trade</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-base">{offer.buyer_name}</div>
                <div className="text-slate-500 text-sm">{offer.buyer_email}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600">
                <div className="font-bold text-[10px] text-slate-400 uppercase mb-1">Offer Details</div>
                {renderOfferDetails(offer)}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded text-[10px] uppercase">
                    {offer.target_items.length} item{offer.target_items.length > 1 ? 's' : ''}
                  </span>
                  {offer.attached_image_url && (
                    <a href={offer.attached_image_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold flex items-center gap-1 hover:underline text-[10px] uppercase">
                      <ImageIcon className="w-3.5 h-3.5"/> View
                    </a>
                  )}
                </div>
                {offer.status === 'pending_payment' && (
                  <button onClick={() => handleApprovePayment(offer.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-3 py-1.5 rounded shadow-sm flex items-center gap-1 text-[10px] uppercase">
                    <CheckSquare className="w-3.5 h-3.5" /> Approve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-lg">
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
                   <div className="flex items-center gap-2 mb-1">
                      {offer.status === 'pending_payment' ? (
                         <span className="bg-amber-100 text-amber-700 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-200 shadow-sm flex items-center gap-1"><DollarSign className="w-3 h-3"/> Checkout Order</span>
                      ) : offer.status === 'completed' ? (
                         <span className="bg-emerald-100 text-emerald-700 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-200 shadow-sm flex items-center gap-1"><PackageCheck className="w-3 h-3"/> Paid & Confirmed</span>
                      ) : (
                         <span className="bg-cyan-100 text-cyan-700 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-cyan-200 shadow-sm flex items-center gap-1"><Handshake className="w-3 h-3"/> Trade Proposal</span>
                      )}
                   </div>
                   <div className="font-bold text-slate-900">{offer.buyer_name}</div>
                   <div className="text-slate-500">{offer.buyer_email}</div>
                </td>
                <td className="px-4 py-4 text-slate-600 min-w-[250px] whitespace-pre-wrap font-medium">
                   {renderOfferDetails(offer)}
                </td>
                <td className="px-4 py-4 text-slate-600">
                   <div className="flex flex-col gap-2">
                       <span className="bg-slate-100/80 text-slate-700 font-bold px-3 py-1.5 rounded border border-slate-200 text-xs inline-block text-center shadow-sm w-fit">
                          {offer.target_items.length} item{offer.target_items.length > 1 ? 's' : ''}
                       </span>
                       {offer.status === 'pending_payment' && (
                          <button onClick={() => handleApprovePayment(offer.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-3 py-2 rounded shadow-md border border-emerald-600 active:scale-95 transition-all w-fit flex items-center gap-1 text-xs">
                             <CheckSquare className="w-3 h-3" /> Approve Payment
                          </button>
                       )}
                   </div>
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
