'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/types/database.types'
import { toggleCardStatus, editCardAction, deleteCardAction, bulkDeleteCardsAction, bulkUpdateMetricsAction, rotateCardImageAction, sendToAuctionBlock, removeFromAuctionBlock, setAuctionStatus, updateLiveStreamUrl, updateProjectionTimeframe } from '@/app/actions/inventory'
import { syncSingleItemWithOracle, syncInventoryWithOracle, applyOracleDiscount, applyOracleDiscountAll, applyCorrection, approvePriceOnly, denyCorrection } from '@/app/actions/oracleSync'
import { Loader2, Trash2, Edit2, Check, X, Search, Download, RotateCw, RefreshCw, DollarSign, Save, AlertCircle, Gavel, Tv, Radio } from 'lucide-react'

type InventoryItem = Database['public']['Tables']['inventory']['Row']

export function InventoryTable({ initialItems, discountRate = 0, liveStreamUrl = null, projectionTimeframe: initialProjectionTimeframe = '90-Day' }: { initialItems: InventoryItem[], discountRate?: number, liveStreamUrl?: string | null, projectionTimeframe?: string }) {
  const [items, setItems] = useState(initialItems)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [isMasterSyncing, setIsMasterSyncing] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [isApplyingAll, setIsApplyingAll] = useState(false)
  
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [bulkCostBasis, setBulkCostBasis] = useState<string>('0')
  const [bulkAcceptsOffers, setBulkAcceptsOffers] = useState(false)
  
  const [pendingCorrections, setPendingCorrections] = useState<any[]>([])
  const [processingCorrectionId, setProcessingCorrectionId] = useState<string | null>(null)
  const [isProcessingMaster, setIsProcessingMaster] = useState(false)
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false)

  // Auction Block State
  const [streamUrl, setStreamUrl] = useState(liveStreamUrl || '')
  const [isSavingStream, setIsSavingStream] = useState(false)
  const [auctionLoadingId, setAuctionLoadingId] = useState<string | null>(null)
  const [projectionTimeframe, setProjectionTimeframe] = useState(initialProjectionTimeframe)
  const [isSavingTimeframe, setIsSavingTimeframe] = useState(false)

  const [editingClarificationId, setEditingClarificationId] = useState<string | null>(null)
  const [clarificationDraft, setClarificationDraft] = useState({ player_name: '', card_set: '', card_number: '' })
  
  const startEditClarification = (c: any) => {
    setClarificationDraft({
      player_name: c.did_you_mean?.player_name || c.original_item?.player_name || "",
      card_set: c.did_you_mean?.card_set || c.original_item?.card_set || "",
      card_number: c.did_you_mean?.card_number || c.original_item?.card_number || ""
    })
    setEditingClarificationId(c.storefront_id);
  }

  const saveClarificationEdit = () => {
    if (!editingClarificationId) return;
    setPendingCorrections(prev => prev.map(c => {
      if (c.storefront_id === editingClarificationId) {
        return {
          ...c,
          did_you_mean: {
            ...c.did_you_mean,
            player_name: clarificationDraft.player_name,
            card_set: clarificationDraft.card_set,
            card_number: clarificationDraft.card_number
          }
        }
      }
      return c;
    }));
    setEditingClarificationId(null);
  }

  const rotateInventoryImage = async (item: InventoryItem, side: 'front' | 'back') => {
    const url = side === 'front' ? item.image_url : item.back_image_url
    if (!url) return
    setRotatingId(`${item.id}-${side}`)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.height
      canvas.height = bitmap.width
      const ctx = canvas.getContext('2d')!
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
      bitmap.close()
      const rotatedBlob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.95)
      )
      const fd = new FormData()
      fd.append('image', new File([rotatedBlob], 'rotated.jpg', { type: 'image/jpeg' }))
      const { newUrl } = await rotateCardImageAction(item.id, side, fd)
      setItems(prev => prev.map(i => {
        if (i.id !== item.id) return i
        return side === 'front' ? { ...i, image_url: newUrl } : { ...i, back_image_url: newUrl }
      }))
    } catch (e) {
      console.error('Rotate failed:', e)
    } finally {
      setRotatingId(null)
    }
  }
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({})
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = items.filter(item => {
     if (!searchQuery) return true;
     const q = searchQuery.toLowerCase();
     return (
        (item.player_name || '').toLowerCase().includes(q) ||
        (item.team_name || '').toLowerCase().includes(q) ||
        (item.card_set || '').toLowerCase().includes(q) ||
        (item.card_number || '').toLowerCase().includes(q) ||
        (item.parallel_insert_type || '').toLowerCase().includes(q)
     );
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected cards?`)) return;
    
    setIsBulkDeleting(true)
    setErrorId(null)
    
    try {
      const itemsToDelete = items.filter(i => selectedIds.has(i.id)).map(i => ({ id: i.id, image_url: i.image_url }))
      await bulkDeleteCardsAction(itemsToDelete)
      setItems(items.filter(i => !selectedIds.has(i.id)))
      setSelectedIds(new Set())
    } catch (err: any) {
      alert("Failed to bulk delete: " + err.message)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleBulkUpdateMetrics = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Update Cost Basis ($${bulkCostBasis}) and Accepts Offers (${bulkAcceptsOffers ? 'Yes' : 'No'}) for ${selectedIds.size} selected items?`)) return
    
    setIsBulkUpdating(true)
    try {
      const ids = Array.from(selectedIds)
      await bulkUpdateMetricsAction(ids, parseFloat(bulkCostBasis) || 0, bulkAcceptsOffers)

      setItems(prev => prev.map(item => 
        selectedIds.has(item.id) 
          ? { ...item, cost_basis: parseFloat(bulkCostBasis) || 0, accepts_offers: bulkAcceptsOffers }
          : item
      ))
      
      setSelectedIds(new Set())
      alert(`Successfully updated ${ids.length} items.`)
    } catch (e: any) {
      alert("Bulk update failed: " + e.message)
    } finally {
      setIsBulkUpdating(false)
    }
  }

  useEffect(() => setItems(initialItems), [initialItems])

  const handleToggle = async (item: InventoryItem) => {
    setLoadingId(item.id)
    setErrorId(null)
    try {
      await toggleCardStatus(item.id, item.status || 'available')
      setItems(items.map(i => i.id === item.id ? { ...i, status: i.status === 'available' ? 'sold' : 'available' } : i))
    } catch (err: any) {
      setErrorId(item.id)
    } finally {
      setLoadingId(null)
    }
  }

  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id)
    setEditForm({ ...item })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSaveEdit = async (id: string) => {
    setIsSaving(true)
    setErrorId(null)
    try {
      const { id: _, created_at, user_id, image_url, status, ...payload } = editForm as any
      if (payload.listed_price !== undefined) {
          payload.listed_price = parseFloat(payload.listed_price as any) || 0;
      }
      if (payload.cost_basis !== undefined) {
          payload.cost_basis = parseFloat(payload.cost_basis as any) || 0;
      }
      
      await editCardAction(id, payload)
      setItems(items.map(i => i.id === id ? { ...i, ...payload } : i))
      setEditingId(null)
    } catch (err: any) {
      setErrorId(id)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, imageUrl: string | null) => {
    if (!window.confirm("Are you sure you want to permanently delete this card?")) return;
    
    setIsDeleting(id)
    setErrorId(null)
    try {
      await deleteCardAction(id, imageUrl)
      setItems(items.filter(i => i.id !== id))
    } catch (err: any) {
      setErrorId(id)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSingleSync = async (id: string) => {
    setSyncingId(id)
    try {
      const result: any = await syncSingleItemWithOracle(id)
      if (result.is_pending) {
        setPendingCorrections([result.pending_correction])
      } else if (result.success) {
        setItems(items.map(i => i.id === id ? { ...i, listed_price: result.new_price ?? null } : i))
      } else {
        alert(result.message)
      }
    } catch (e: any) {
      alert("Sync failed: " + e.message)
    } finally {
      setSyncingId(null)
    }
  }

  const handleApplyOracleDiscount = async (item: InventoryItem) => {
    setApplyingId(item.id)
    try {
      const result: any = await applyOracleDiscount(item.id)
      if (result.success) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, listed_price: result.new_price ?? null } : i))
      } else {
        alert(result.message)
      }
    } catch (e: any) {
      alert('Failed to apply Oracle pricing: ' + e.message)
    } finally {
      setApplyingId(null)
    }
  }

  const handleApplyAllOracle = async () => {
    if (!window.confirm(`Apply Oracle pricing (${discountRate}% below market) to ALL items with projections?`)) return
    setIsApplyingAll(true)
    try {
      const result: any = await applyOracleDiscountAll()
      if (result.success) {
        alert(`Applied Oracle pricing to ${result.count} items at ${result.discount}% below market.`)
        window.location.reload()
      } else {
        alert(result.message || 'Failed to apply Oracle pricing.')
      }
    } catch (e: any) {
      alert('Failed: ' + e.message)
    } finally {
      setIsApplyingAll(false)
    }
  }

  const handleMasterSync = async () => {
    setIsMasterSyncing(true)
    try {
      const result: any = await syncInventoryWithOracle()
      if (result.pendingCorrections && result.pendingCorrections.length > 0) {
        setPendingCorrections(result.pendingCorrections)
        if (result.count > 0) {
           alert(`Processed ${result.count} items perfectly. There are ${result.pendingCorrections.length} items needing review.`)
        }
      } else if (result.success) {
        alert(`Master Sync Complete! Repriced ${result.count}/${(result as any).total} items across ${(result as any).batches} batches.`)
        // The table items don't automatically refresh unless we reload page, but alert verifies it.
        window.location.reload()
      } else {
        alert(result.message)
      }
    } catch (e: any) {
      alert("Sync failed: " + e.message)
    } finally {
      setIsMasterSyncing(false)
    }
  }

  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;
    const headers = ['Card ID', 'Player Name', 'Team Name', 'Set', 'Number', 'Parallel/Insert', 'Status', 'Cost Basis', 'Listed Price', 'Accepts Offers', 'Image URL'];
    
    const rows = filteredItems.map(item => [
      item.id,
      `"${(item.player_name || '').replace(/"/g, '""')}"`,
      `"${(item.team_name || '').replace(/"/g, '""')}"`,
      `"${(item.card_set || '').replace(/"/g, '""')}"`,
      `"${(item.card_number || '').replace(/"/g, '""')}"`,
      `"${(item.parallel_insert_type || '').replace(/"/g, '""')}"`,
      (item.status || 'available').toUpperCase(),
      item.cost_basis || 0,
      item.listed_price || 0,
      item.accepts_offers ? 'YES' : 'NO',
      `"${item.image_url || ''}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Store_Inventory_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Auction Block Handlers
  const auctionItems = items.filter(i => (i as any).is_auction === true)

  const handleAddToAuction = async (id: string) => {
    setAuctionLoadingId(id)
    try {
      await sendToAuctionBlock([id])
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_auction: true, auction_status: 'pending' } as any : i))
    } catch (e: any) { alert('Failed: ' + e.message) }
    finally { setAuctionLoadingId(null) }
  }

  const handleRemoveFromAuction = async (id: string) => {
    setAuctionLoadingId(id)
    try {
      await removeFromAuctionBlock(id)
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_auction: false, auction_status: 'pending' } as any : i))
    } catch (e: any) { alert('Failed: ' + e.message) }
    finally { setAuctionLoadingId(null) }
  }

  const handleSetStatus = async (id: string, status: 'pending' | 'live' | 'ended') => {
    setAuctionLoadingId(id)
    try {
      await setAuctionStatus(id, status)
      setItems(prev => prev.map(i => i.id === id ? { ...i, auction_status: status } as any : i))
    } catch (e: any) { alert('Failed: ' + e.message) }
    finally { setAuctionLoadingId(null) }
  }

  const handleSaveStream = async () => {
    setIsSavingStream(true)
    try { await updateLiveStreamUrl(streamUrl || null) }
    catch (e: any) { alert('Failed: ' + e.message) }
    finally { setIsSavingStream(false) }
  }

  const handleSaveTimeframe = async (val: string) => {
    setProjectionTimeframe(val)
    setIsSavingTimeframe(true)
    try { await updateProjectionTimeframe(val) }
    catch (e: any) { alert('Failed to save timeframe: ' + e.message) }
    finally { setIsSavingTimeframe(false) }
  }

  if (items.length === 0) {
    return <div className="text-center text-slate-500 py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200">No inventory found in database.</div>
  }

  const handleApplyCorrection = async (item: any) => {
    setProcessingCorrectionId(item.storefront_id);
    try {
      await applyCorrection(item.storefront_id, item);
      setPendingCorrections(prev => prev.filter(c => c.storefront_id !== item.storefront_id));
    } catch(e:any) {
      alert("Error: " + e.message);
    } finally {
      setProcessingCorrectionId(null);
    }
  }

  const handleApprovePriceOnly = async (item: any) => {
    setProcessingCorrectionId(item.storefront_id);
    try {
      await approvePriceOnly(item.storefront_id, item);
      setPendingCorrections(prev => prev.filter(c => c.storefront_id !== item.storefront_id));
    } catch(e:any) {
      alert("Error: " + e.message);
    } finally {
      setProcessingCorrectionId(null);
    }
  }

  const handleDenyCorrection = async (item: any) => {
    setProcessingCorrectionId(item.storefront_id);
    try {
      await denyCorrection(item.storefront_id);
      setPendingCorrections(prev => prev.filter(c => c.storefront_id !== item.storefront_id));
    } catch(e:any) {
      alert("Error: " + e.message);
    } finally {
      setProcessingCorrectionId(null);
    }
  }

  const handleMasterApproveAll = async () => {
    if (!window.confirm("Approve and update ALL pending items with their Oracle catalog matches?")) return;
    setIsProcessingMaster(true);
    try {
      for (const item of pendingCorrections) {
        await applyCorrection(item.storefront_id, item);
      }
      setPendingCorrections([]);
      alert("Master approval complete.");
      window.location.reload();
    } catch (e:any) {
      alert("Error: " + e.message);
    } finally {
      setIsProcessingMaster(false);
    }
  }

  const handleMasterDenyAll = async () => {
    if (!window.confirm("Deny ALL pending suggestions and force fallback math? This may take a minute.")) return;
    setIsProcessingMaster(true);
    try {
      for (const item of pendingCorrections) {
        await denyCorrection(item.storefront_id);
      }
      setPendingCorrections([]);
      alert("Master denial complete.");
      window.location.reload();
    } catch (e:any) {
      alert("Error: " + e.message);
    } finally {
      setIsProcessingMaster(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pending Corrections Modal */}
      {(showCorrectionsModal && pendingCorrections.length > 0) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
            {/* Header */}
            <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded flex items-center justify-center text-xs">{pendingCorrections.length}</span>
                  Oracle Catalog Clarifications Needed
                </h2>
                <p className="text-sm text-indigo-700 mt-1 font-medium">The Oracle matched your listings to its official catalog. Review its suggestions below.</p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <button 
                  onClick={handleMasterApproveAll} 
                  disabled={isProcessingMaster}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingMaster ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                  Approve All
                </button>
                <button 
                  onClick={handleMasterDenyAll} 
                  disabled={isProcessingMaster}
                  className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingMaster ? <Loader2 className="w-4 h-4 animate-spin"/> : <X className="w-4 h-4"/>}
                  Deny All
                </button>
                <button onClick={() => setShowCorrectionsModal(false)} className="text-indigo-400 hover:text-indigo-600 border border-transparent hover:bg-white hover:border-indigo-200 p-2 rounded-lg transition-all ml-2" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-0 bg-slate-50">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_0_rgba(200,200,200,0.5)]">
                  <tr>
                    <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Your Listing Details</th>
                    <th className="px-5 py-3 font-bold text-indigo-500 uppercase tracking-widest text-[10px] border-l border-indigo-50 bg-indigo-50/30">Oracle "Did You Mean?" Suggestion</th>
                    <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Proj Target</th>
                    <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingCorrections.map(c => {
                    const original = c.original_item;
                    const isProcessing = processingCorrectionId === c.storefront_id;
                    return (
                      <tr key={c.storefront_id} className="hover:bg-indigo-50/10 transition-colors">
                        <td className="px-5 py-3 align-top">
                          <div className="font-bold text-slate-900 leading-tight mb-1">{original?.player_name}</div>
                          <div className="text-xs font-semibold text-slate-600 leading-snug whitespace-normal w-48">
                            {original?.card_set} {original?.card_number ? <span className="text-slate-400">#{original?.card_number}</span> : ''}
                          </div>
                          {original?.parallel_insert_type && (
                             <div className="text-[10px] uppercase font-bold text-slate-500 mt-1.5 bg-slate-100 rounded px-1.5 py-0.5 inline-block whitespace-normal break-words max-w-[190px]">
                               {original?.parallel_insert_type}
                             </div>
                          )}
                        </td>
                        <td className="px-5 py-3 border-l border-indigo-50 bg-indigo-50/30 min-w-[300px]">
                          <>
                            <div className="font-bold text-indigo-900 leading-tight">
                              {c.did_you_mean.player_name && c.did_you_mean.player_name !== original?.player_name 
                                  ? <span className="text-emerald-700 tooltip" title="Oracle Corrected Spelling">{c.did_you_mean.player_name}</span> 
                                  : original?.player_name}
                            </div>
                            <div className="font-bold text-indigo-900 leading-tight mt-0.5">{c.did_you_mean.card_set} {c.did_you_mean.card_number ? <span className="text-slate-500">#{c.did_you_mean.card_number}</span> : ''}</div>
                            <div className="text-xs font-medium mt-1 flex flex-col gap-1.5 align-start mb-2">
                               <div className="text-indigo-700 max-w-[250px] truncate">{c.did_you_mean.insert_name || "Base"}</div>
                               {c.did_you_mean.parallel_name ? (
                                 <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex w-fit items-center gap-1 font-bold shadow-sm">
                                   ✅ Verified Parallel: {c.did_you_mean.parallel_name}
                                 </div>
                               ) : original?.parallel_insert_type ? (
                                 <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex w-fit items-center gap-1 font-bold shadow-sm">
                                   ⚠️ Review Parallel: {original.parallel_insert_type}
                                 </div>
                               ) : null}
                            </div>
                          </>
                          
                          {/* Appended Manal Overwrite Form immediately beneath Oracle layout */}
                          {editingClarificationId === c.storefront_id && (
                             <div className="space-y-2 p-3 bg-white border border-amber-300 rounded-lg shadow-lg relative z-10 w-full mt-2">
                                <div className="text-[10px] uppercase font-black tracking-widest text-amber-600 mb-1">Manual Overwrite</div>
                                <input value={clarificationDraft.player_name} onChange={e => setClarificationDraft({...clarificationDraft, player_name: e.target.value})} className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-amber-500 outline-none shadow-sm" placeholder="Player Name" />
                                <input value={clarificationDraft.card_set} onChange={e => setClarificationDraft({...clarificationDraft, card_set: e.target.value})} className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-amber-500 outline-none shadow-sm" placeholder="Card Set" />
                                <input value={clarificationDraft.card_number} onChange={e => setClarificationDraft({...clarificationDraft, card_number: e.target.value})} className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-amber-500 outline-none shadow-sm" placeholder="Card Number" />
                                <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-slate-100">
                                   <button onClick={() => setEditingClarificationId(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2 py-1">Cancel</button>
                                   <button onClick={saveClarificationEdit} className="text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded shadow-sm">Save Overwrite</button>
                                </div>
                             </div>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-slate-700">
                          ${c.projected_target.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right space-x-2">
                          <button 
                            onClick={() => startEditClarification(c)}
                            disabled={isProcessing || editingClarificationId !== null}
                            className="bg-white hover:bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1.5 rounded text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                            title="Edit Suggestion Manually"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleApplyCorrection(c)}
                            disabled={isProcessing || editingClarificationId !== null}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto"/> : 'Apply'}
                          </button>
                          <button 
                            onClick={() => handleApprovePriceOnly(c)}
                            disabled={isProcessing || editingClarificationId !== null}
                            className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                            title="Apply projection target but keep original listing text"
                          >
                            Price Only
                          </button>
                          <button 
                            onClick={() => handleDenyCorrection(c)}
                            disabled={isProcessing || editingClarificationId !== null}
                            className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                          >
                            Deny
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between rounded-b-2xl">
              <span className="text-xs font-bold text-slate-400 uppercase">Master Actions</span>
              <div className="space-x-3">
                <button 
                  onClick={handleMasterDenyAll} 
                  disabled={isProcessingMaster} 
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-bold bg-white hover:bg-slate-50 transition-all disabled:opacity-50 shadow-sm"
                >
                  {isProcessingMaster ? 'Processing...' : 'Deny All'}
                </button>
                <button 
                  onClick={handleMasterApproveAll} 
                  disabled={isProcessingMaster} 
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50"
                >
                  {isProcessingMaster ? 'Processing...' : 'Approve & Apply All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Auction Block Panel ── */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Auction Block</h3>
            {auctionItems.length > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{auctionItems.length}</span>
            )}
          </div>
          {/* Stream URL */}
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={streamUrl}
              onChange={e => setStreamUrl(e.target.value)}
              placeholder="Stream URL (YouTube / Twitch)"
              className="w-64 bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-red-500 placeholder:text-zinc-600"
            />
            <button
              onClick={handleSaveStream}
              disabled={isSavingStream}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isSavingStream ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
              Save
            </button>
          </div>
          {/* Projection Timeframe */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">Projection Timeframe</span>
            <select
              value={projectionTimeframe}
              onChange={e => handleSaveTimeframe(e.target.value)}
              disabled={isSavingTimeframe}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-60"
            >
              {['30-Day', '90-Day', '6-Month', 'End of Season'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {isSavingTimeframe && <span className="text-[10px] text-zinc-500 animate-pulse">Saving...</span>}
          </div>
        </div>

        {auctionItems.length === 0 ? (
          <div className="py-8 text-center text-zinc-600 text-sm font-medium">
            No items on the auction block. Use the <Gavel className="inline w-3.5 h-3.5 mx-1" /> button on any card below to add it.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-2.5 font-bold text-zinc-500 uppercase tracking-widest text-[10px]">Card</th>
                  <th className="px-4 py-2.5 font-bold text-zinc-500 uppercase tracking-widest text-[10px]">Current Bid</th>
                  <th className="px-4 py-2.5 font-bold text-zinc-500 uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-4 py-2.5 font-bold text-zinc-500 uppercase tracking-widest text-[10px] text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {auctionItems.map((item: any) => {
                  const isLoading = auctionLoadingId === item.id
                  const status = item.auction_status || 'pending'
                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.image_url && (
                            <img src={item.image_url} alt={item.player_name} className="w-10 h-12 object-contain rounded bg-zinc-800" />
                          )}
                          <div>
                            <div className="font-bold text-white leading-tight">{item.player_name}</div>
                            <div className="text-zinc-500 text-[10px] mt-0.5">{item.card_set}{item.card_number ? ` #${item.card_number}` : ''}</div>
                            {item.parallel_insert_type && <div className="text-[10px] text-indigo-400 font-semibold">{item.parallel_insert_type}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-cyan-400 text-sm">
                        ${(item.current_bid || item.listed_price || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${
                          status === 'live' ? 'bg-red-900/60 text-red-400 border border-red-700/40' :
                          status === 'ended' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' :
                          'bg-amber-900/60 text-amber-400 border border-amber-700/40'
                        }`}>{status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {status !== 'live' && (
                            <button onClick={() => handleSetStatus(item.id, 'live')} disabled={isLoading}
                              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black px-2.5 py-1 rounded transition-colors disabled:opacity-50">Go Live</button>
                          )}
                          {status === 'live' && (
                            <button onClick={() => handleSetStatus(item.id, 'ended')} disabled={isLoading}
                              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] font-bold px-2.5 py-1 rounded transition-colors disabled:opacity-50">End</button>
                          )}
                          <button onClick={() => handleRemoveFromAuction(item.id)} disabled={isLoading}
                            className="bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 text-[10px] font-bold px-2 py-1 rounded border border-zinc-700 hover:border-red-800 transition-colors disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
         <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search inventory database..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400 text-slate-900 font-medium shadow-sm"
            />
         </div>
         <div className="flex items-center gap-2">
           {pendingCorrections.length > 0 && (
             <button onClick={() => setShowCorrectionsModal(true)} className="whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer animate-pulse">
               <AlertCircle className="w-4 h-4" />
               Review Results ({pendingCorrections.length})
             </button>
           )}
           <button onClick={handleMasterSync} disabled={isMasterSyncing} className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50">
             {isMasterSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
             Sync All Inventory
           </button>
            <button onClick={handleApplyAllOracle} disabled={isApplyingAll} className="whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50">
              {isApplyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Apply All Oracle Pricing
            </button>
           <button onClick={handleExportCSV} className="whitespace-nowrap bg-zinc-800 hover:bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer">
             <Download className="w-4 h-4" />
             Export CSV
           </button>
         </div>
      </div>

      {/* Select all + bulk bar */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
          Select All
        </label>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg animate-in fade-in slide-in-from-top-2 shadow-sm">
            <span className="text-sm font-bold text-indigo-900">{selectedIds.size} selected</span>
            <div className="h-6 w-px bg-indigo-200 mx-1"></div>
            <div className="flex items-center gap-2">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Default Cost $</label>
                 <input type="number" step="0.01" value={bulkCostBasis} onChange={e => setBulkCostBasis(e.target.value)} className="w-16 p-1 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded outline-none focus:ring-2 focus:ring-indigo-500 text-center" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={bulkAcceptsOffers} onChange={e => setBulkAcceptsOffers(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                 <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Offers OBO</span>
            </label>
            <button onClick={handleBulkUpdateMetrics} disabled={isBulkUpdating} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm ml-2">
              {isBulkUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Apply
            </button>
            <div className="h-6 w-px bg-indigo-200 mx-1"></div>
            <button onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm">
              {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map(item => (
          <div
            key={item.id}
            className={`relative rounded-xl border bg-white shadow-sm flex flex-col overflow-hidden transition-all group ${selectedIds.has(item.id) ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-slate-200 hover:border-slate-300'}`}
          >
            {/* Select checkbox */}
            <div className="absolute top-2 left-2 z-10">
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shadow-sm"
              />
            </div>

            {/* Card images — front + back side by side */}
            <div className="w-full flex border-b border-slate-200 bg-slate-100">
              <div className="flex-1 h-36 flex items-center justify-center overflow-hidden border-r border-slate-200 relative group/img">
                {item.image_url ? (
                  <img src={item.image_url} alt="Front" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">No Front</span>
                )}
                {item.image_url && (
                  <button
                    onClick={() => rotateInventoryImage(item, 'front')}
                    disabled={rotatingId === `${item.id}-front`}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white p-1 rounded opacity-0 group-hover/img:opacity-100 transition-opacity shadow disabled:opacity-60"
                    title="Rotate Front 90°"
                  >
                    {rotatingId === `${item.id}-front`
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RotateCw className="w-3.5 h-3.5" />}
                  </button>
                )}
                <span className="absolute bottom-0 inset-x-0 text-center text-[9px] font-bold uppercase tracking-wider text-white bg-black/50 py-0.5">Front</span>
              </div>
              <div className="flex-1 h-36 flex items-center justify-center overflow-hidden relative group/img">
                {item.back_image_url ? (
                  <img src={item.back_image_url} alt="Back" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">No Back</span>
                )}
                {item.back_image_url && (
                  <button
                    onClick={() => rotateInventoryImage(item, 'back')}
                    disabled={rotatingId === `${item.id}-back`}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white p-1 rounded opacity-0 group-hover/img:opacity-100 transition-opacity shadow disabled:opacity-60"
                    title="Rotate Back 90°"
                  >
                    {rotatingId === `${item.id}-back`
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RotateCw className="w-3.5 h-3.5" />}
                  </button>
                )}
                <span className="absolute bottom-0 inset-x-0 text-center text-[9px] font-bold uppercase tracking-wider text-white bg-black/50 py-0.5">Back</span>
              </div>
            </div>

            {/* Card body */}
            <div className="p-3 flex flex-col gap-2 flex-grow">
              {editingId === item.id ? (
                /* ── Edit Mode ── */
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input type="text" value={editForm.player_name || ''} onChange={e => setEditForm({...editForm, player_name: e.target.value})} className="w-1/2 p-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Player Name" />
                    <input type="text" value={editForm.team_name || ''} onChange={e => setEditForm({...editForm, team_name: e.target.value})} className="w-1/2 p-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Team" />
                  </div>
                  <div className="flex gap-1.5">
                    <input type="text" value={editForm.card_set || ''} onChange={e => setEditForm({...editForm, card_set: e.target.value})} className="w-full p-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-100 rounded focus:border-indigo-500 outline-none" placeholder="Card Set" />
                  </div>
                  <div className="flex gap-1.5">
                    <input type="text" value={editForm.card_number || ''} onChange={e => setEditForm({...editForm, card_number: e.target.value})} className="w-1/3 p-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-100 rounded focus:border-indigo-500 outline-none" placeholder="Number" />
                    <input type="text" value={editForm.parallel_insert_type || ''} onChange={e => setEditForm({...editForm, parallel_insert_type: e.target.value})} className="w-2/3 p-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-100 rounded focus:border-indigo-500 outline-none" placeholder="Parallel/Insert" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex items-center w-1/2">
                      <span className="text-slate-500 mr-1 font-bold text-[10px] uppercase">List $</span>
                      <input type="number" step="0.01" value={editForm.listed_price ?? editForm.avg_price ?? ''} onChange={e => setEditForm({...editForm, listed_price: parseFloat(e.target.value) || 0})} className="w-full p-1.5 text-xs font-bold font-mono text-slate-900 bg-white border border-indigo-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="flex items-center w-1/2">
                      <span className="text-slate-500 mr-1 font-bold text-[10px] uppercase">Cost $</span>
                      <input type="number" step="0.01" value={editForm.cost_basis ?? ''} onChange={e => setEditForm({...editForm, cost_basis: parseFloat(e.target.value) || 0})} className="w-full p-1.5 text-xs font-bold font-mono text-slate-900 bg-white border border-indigo-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editForm.accepts_offers || false} onChange={e => setEditForm({...editForm, accepts_offers: e.target.checked})} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 outline-none" />
                    <span className="text-xs font-bold text-slate-600">Accepts Offers</span>
                  </label>
                  {/* Save / Cancel */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleSaveEdit(item.id)} disabled={isSaving} className="flex-1 text-white hover:bg-emerald-600 font-bold text-xs bg-emerald-500 py-1.5 rounded flex items-center justify-center gap-1 disabled:opacity-50 transition-colors shadow-sm">
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                    </button>
                    <button onClick={cancelEditing} disabled={isSaving} className="flex-1 text-slate-600 hover:text-slate-800 hover:bg-slate-200 font-medium text-xs bg-slate-100 py-1.5 rounded flex items-center justify-center transition-colors">
                      <X className="w-3.5 h-3.5 mr-1" /> Cancel
                    </button>
                  </div>
                  {errorId === item.id && <div className="text-[10px] text-red-500 font-medium">Failed to save</div>}
                </div>
              ) : (
                /* ── View Mode ── */
                <>
                  <div>
                    <div className="font-black text-slate-900 text-base leading-tight flex items-center gap-1.5 flex-wrap">
                      {item.player_name}
                    </div>
                    {item.team_name && <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">{item.team_name}</div>}
                    <div className="text-sm text-slate-700 mt-1 font-semibold leading-snug">
                      {item.card_set}{item.card_number ? ` #${item.card_number}` : ''}
                    </div>
                    {item.parallel_insert_type && <div className="text-xs text-indigo-600 font-bold mt-0.5">{item.parallel_insert_type}</div>}
                  </div>

                  {/* Oracle Pricing Section */}
                  {(item as any).oracle_projection && (item as any).oracle_projection > 0 && (
                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 mb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">🔮 Oracle Valuation</span>
                        {(item as any).oracle_trend_percentage != null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${(item as any).oracle_trend_percentage >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {(item as any).oracle_trend_percentage >= 0 ? '↑' : '↓'} {Math.abs((item as any).oracle_trend_percentage).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-black text-purple-900">${(item as any).oracle_projection.toFixed(2)}</span>
                        <span className="text-[10px] text-purple-500 font-semibold">market value</span>
                      </div>
                      {item.listed_price && (item as any).oracle_projection > item.listed_price && (
                        <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Your price: ${item.listed_price.toFixed(2)} ({((1 - item.listed_price / (item as any).oracle_projection) * 100).toFixed(0)}% below)</div>
                      )}
                      <button
                        onClick={() => handleApplyOracleDiscount(item)}
                        disabled={applyingId === item.id}
                        className="mt-1.5 w-full text-[11px] font-bold py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {applyingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                        Apply {discountRate}% Below Oracle
                      </button>
                    </div>
                  )}

                  {/* Pricing row */}
                  <div className="flex items-end justify-between mt-auto pt-1">
                    <div>
                      <span className="text-xl font-black text-slate-900">${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}</span>
                      {item.cost_basis != null && <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-1">Cost: ${item.cost_basis.toFixed(2)}</div>}
                      {item.accepts_offers && <div className="text-xs text-indigo-500 font-bold uppercase tracking-wider">Takes Offers</div>}
                    </div>

                    {/* Status + actions */}
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={loadingId === item.id}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border flex items-center gap-1 transition-colors ${
                          item.status === 'available'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {loadingId === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        {item.status === 'available' ? 'Available' : 'Sold'}
                      </button>
                      {errorId === item.id && <div className="text-[10px] text-red-500 font-medium">Failed</div>}
                      <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(item)} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 bg-indigo-50 h-7 w-7 rounded flex items-center justify-center transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleSingleSync(item.id)} disabled={syncingId === item.id} className="text-purple-600 hover:text-purple-800 hover:bg-purple-100 bg-purple-50 h-7 w-7 rounded disabled:opacity-50 flex items-center justify-center transition-colors" title="Sync with Oracle">
                          {syncingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent([item.player_name, item.card_set, item.parallel_insert_type, item.card_number].filter(Boolean).join(' '))}&LH_Sold=1&LH_Complete=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:text-sky-800 hover:bg-sky-100 bg-sky-50 h-7 w-7 rounded flex items-center justify-center transition-colors"
                          title="Check eBay Comps"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => handleDelete(item.id, item.image_url)} disabled={isDeleting === item.id} className="text-red-600 hover:text-red-800 hover:bg-red-100 bg-red-50 h-7 w-7 rounded disabled:opacity-50 flex items-center justify-center transition-colors" title="Delete">
                          {isDeleting === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                        {/* Auction Block Toggle */}
                        {(item as any).is_auction ? (
                          <button
                            onClick={() => handleRemoveFromAuction(item.id)}
                            disabled={auctionLoadingId === item.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-100 bg-red-50 h-7 w-7 rounded disabled:opacity-50 flex items-center justify-center transition-colors"
                            title="Remove from Auction Block"
                          >
                            {auctionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddToAuction(item.id)}
                            disabled={auctionLoadingId === item.id}
                            className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 bg-amber-50 h-7 w-7 rounded disabled:opacity-50 flex items-center justify-center transition-colors"
                            title="Add to Auction Block"
                          >
                            {auctionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gavel className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
