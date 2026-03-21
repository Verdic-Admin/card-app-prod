'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/types/database.types'
import { toggleCardStatus, editCardAction, deleteCardAction } from '@/app/actions/inventory'
import { Loader2, Trash2, Edit2, Check, X } from 'lucide-react'

type InventoryItem = Database['public']['Tables']['inventory']['Row']

export function InventoryTable({ initialItems }: { initialItems: InventoryItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({})
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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

  if (items.length === 0) {
    return <div className="text-center text-slate-500 py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200">No inventory found in database.</div>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 font-semibold text-slate-900 w-16">Image</th>
            <th className="px-4 py-3 font-semibold text-slate-900">Card Details</th>
            <th className="px-4 py-3 font-semibold text-slate-900 text-right">Price</th>
            <th className="px-4 py-3 font-semibold text-slate-900 text-center">Status</th>
            <th className="px-4 py-3 font-semibold text-slate-900 text-right w-32">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-slate-50/50 group">
              <td className="px-4 py-3">
                <div className="w-12 h-16 bg-slate-100 rounded overflow-hidden flex items-center justify-center border border-slate-200">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">No IMG</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 min-w-[320px]">
                {editingId === item.id ? (
                  <div className="space-y-2 font-sans">
                    <input type="text" value={editForm.player_name || ''} onChange={e => setEditForm({...editForm, player_name: e.target.value})} className="w-full p-2 text-sm font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" placeholder="Player Name" />
                    <div className="flex gap-2">
                      <input type="text" value={editForm.year || ''} onChange={e => setEditForm({...editForm, year: e.target.value})} className="w-1/3 p-2 text-sm font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-indigo-100 rounded focus:border-indigo-500 outline-none transition-colors" placeholder="Year" />
                      <input type="text" value={editForm.card_set || ''} onChange={e => setEditForm({...editForm, card_set: e.target.value})} className="w-2/3 p-2 text-sm font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-indigo-100 rounded focus:border-indigo-500 outline-none transition-colors" placeholder="Card Set" />
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={editForm.card_number || ''} onChange={e => setEditForm({...editForm, card_number: e.target.value})} className="w-1/3 p-2 text-sm font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-indigo-100 rounded focus:border-indigo-500 outline-none transition-colors" placeholder="Number" />
                      <input type="text" value={editForm.parallel_insert_type || ''} onChange={e => setEditForm({...editForm, parallel_insert_type: e.target.value})} className="w-2/3 p-2 text-sm font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-indigo-100 rounded focus:border-indigo-500 outline-none transition-colors" placeholder="Parallel/Insert" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                       {item.player_name}
                       {item.back_image_url && <span className="text-[9px] font-black text-white bg-indigo-500 px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider">Dual Sided</span>}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 font-medium">{item.year} {item.card_set} {item.card_number ? `#${item.card_number}` : ''} {item.parallel_insert_type ? `• ${item.parallel_insert_type}` : ''}</div>
                  </>
                )}
              </td>
              <td className="px-4 py-3 font-mono font-medium text-slate-900 text-right align-top pt-5">
                {editingId === item.id ? (
                  <div className="flex flex-col items-end gap-2 font-sans">
                    <div className="flex items-center">
                      <span className="text-slate-500 mr-2 font-bold text-xs uppercase">List $</span>
                      <input type="number" step="0.01" value={editForm.listed_price ?? editForm.avg_price ?? ''} onChange={e => setEditForm({...editForm, listed_price: parseFloat(e.target.value) || 0})} className="w-24 p-2 text-sm font-bold font-mono text-slate-900 bg-white placeholder:text-slate-400 border border-indigo-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="flex items-center">
                      <span className="text-slate-500 mr-2 font-bold text-xs uppercase">Cost $</span>
                      <input type="number" step="0.01" value={editForm.cost_basis ?? ''} onChange={e => setEditForm({...editForm, cost_basis: parseFloat(e.target.value) || 0})} className="w-24 p-2 text-sm font-bold font-mono text-slate-900 bg-white placeholder:text-slate-400 border border-indigo-200 rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <label className="flex items-center gap-2 mt-1 cursor-pointer">
                      <input type="checkbox" checked={editForm.accepts_offers || false} onChange={e => setEditForm({...editForm, accepts_offers: e.target.checked})} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 outline-none" />
                      <span className="text-xs font-bold text-slate-600">Accepts Offers</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                     <span className="text-sm font-black text-slate-900">${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}</span>
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">AI Avg: ${item.avg_price?.toFixed(2) || '0.00'}</span>
                     {item.cost_basis != null && <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Cost: ${item.cost_basis.toFixed(2)}</span>}
                     {item.accepts_offers && <span className="text-[10px] text-indigo-500 font-bold uppercase">Takes Offers</span>}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-center align-top pt-4">
                <button 
                  onClick={() => handleToggle(item)}
                  disabled={loadingId === item.id || editingId === item.id}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border flex items-center justify-center gap-1.5 mx-auto min-w-[96px] transition-colors ${
                    editingId === item.id ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-400' :
                    item.status === 'available' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {loadingId === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  {item.status === 'available' ? 'Available' : 'Sold'}
                </button>
                {errorId === item.id && <div className="text-[10px] text-red-500 mt-1 font-medium">Failed to update</div>}
              </td>
              <td className="px-4 py-3 text-right align-top pt-4">
                {editingId === item.id ? (
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => handleSaveEdit(item.id)} disabled={isSaving} className="text-white hover:bg-emerald-600 font-bold text-xs bg-emerald-500 h-8 w-8 rounded flex items-center justify-center disabled:opacity-50 transition-colors shadow-sm" title="Save">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={cancelEditing} disabled={isSaving} className="text-slate-600 hover:text-slate-800 hover:bg-slate-200 font-medium text-xs bg-slate-100 h-8 w-8 rounded flex items-center justify-center transition-colors" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditing(item)} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 font-medium text-xs bg-indigo-50 h-8 w-8 rounded flex items-center justify-center transition-colors" title="Edit Item">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id, item.image_url)} disabled={isDeleting === item.id} className="text-red-600 hover:text-red-800 hover:bg-red-100 font-medium text-xs bg-red-50 h-8 w-8 rounded disabled:opacity-50 flex items-center justify-center transition-colors shadow-sm" title="Delete Item">
                      {isDeleting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
