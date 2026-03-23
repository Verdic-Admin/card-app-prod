'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/types/database.types'
import { toggleCardStatus, editCardAction, deleteCardAction, bulkDeleteCardsAction } from '@/app/actions/inventory'
import { Loader2, Trash2, Edit2, Check, X, Search, Download } from 'lucide-react'

type InventoryItem = Database['public']['Tables']['inventory']['Row']

export function InventoryTable({ initialItems }: { initialItems: InventoryItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({})
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = items.filter(item => {
     if (!searchQuery) return true;
     const q = searchQuery.toLowerCase();
     return (
        (item.player_name || '').toLowerCase().includes(q) ||
        (item.team_name || '').toLowerCase().includes(q) ||
        (item.card_set || '').toLowerCase().includes(q) ||
        (item.year || '').toLowerCase().includes(q) ||
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

  useEffect(() => setItems(initialItems), [initialItems])

  const handleToggle = async (item: InventoryItem) => {
    setLoadingId(item.id)
    setErrorId(null)
    try {
      await toggleCardStatus(item.id, item.status)
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

  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;
    const headers = ['Card ID', 'Player Name', 'Team Name', 'Year', 'Set', 'Number', 'Parallel/Insert', 'Status', 'Cost Basis', 'Avg Price', 'Listed Price', 'Accepts Offers', 'Image URL'];
    
    const rows = filteredItems.map(item => [
      item.id,
      `"${(item.player_name || '').replace(/"/g, '""')}"`,
      `"${(item.team_name || '').replace(/"/g, '""')}"`,
      item.year || '',
      `"${(item.card_set || '').replace(/"/g, '""')}"`,
      `"${(item.card_number || '').replace(/"/g, '""')}"`,
      `"${(item.parallel_insert_type || '').replace(/"/g, '""')}"`,
      item.status.toUpperCase(),
      item.cost_basis || 0,
      item.avg_price || 0,
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

  if (items.length === 0) {
    return <div className="text-center text-slate-500 py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200">No inventory found in database.</div>
  }

  return (
    <div className="space-y-4">
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
         <button onClick={handleExportCSV} className="whitespace-nowrap bg-zinc-800 hover:bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer">
           <Download className="w-4 h-4" />
           Export CSV
         </button>
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
            <button onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm">
              {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Mass Delete
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
              <div className="flex-1 h-36 flex items-center justify-center overflow-hidden border-r border-slate-200 relative">
                {item.image_url ? (
                  <img src={item.image_url} alt="Front" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">No Front</span>
                )}
                <span className="absolute bottom-0 inset-x-0 text-center text-[9px] font-bold uppercase tracking-wider text-white bg-black/50 py-0.5">Front</span>
              </div>
              <div className="flex-1 h-36 flex items-center justify-center overflow-hidden relative">
                {item.back_image_url ? (
                  <img src={item.back_image_url} alt="Back" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">No Back</span>
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
                    <input type="text" value={editForm.year || ''} onChange={e => setEditForm({...editForm, year: e.target.value})} className="w-1/3 p-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-100 rounded focus:border-indigo-500 outline-none" placeholder="Year" />
                    <input type="text" value={editForm.card_set || ''} onChange={e => setEditForm({...editForm, card_set: e.target.value})} className="w-2/3 p-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-100 rounded focus:border-indigo-500 outline-none" placeholder="Card Set" />
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
                      {item.year} {item.card_set}{item.card_number ? ` #${item.card_number}` : ''}
                    </div>
                    {item.parallel_insert_type && <div className="text-xs text-indigo-600 font-bold mt-0.5">{item.parallel_insert_type}</div>}
                  </div>

                  {/* Pricing row */}
                  <div className="flex items-end justify-between mt-auto pt-1">
                    <div>
                      <span className="text-xl font-black text-slate-900">${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}</span>
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">AI Avg: ${item.avg_price?.toFixed(2) || '0.00'}</div>
                      {item.cost_basis != null && <div className="text-xs text-emerald-600 font-bold uppercase">Cost: ${item.cost_basis.toFixed(2)}</div>}
                      {item.accepts_offers && <div className="text-xs text-indigo-500 font-bold uppercase">Takes Offers</div>}
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
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(item)} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 bg-indigo-50 h-7 w-7 rounded flex items-center justify-center transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent([item.year, item.player_name, item.card_set, item.parallel_insert_type, item.card_number].filter(Boolean).join(' '))}&LH_Sold=1&LH_Complete=1`}
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
