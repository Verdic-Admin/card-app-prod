'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, Send, Image as ImageIcon, Wand2 } from 'lucide-react';
import { listScanStagingAction, updateDraftCardAction, publishDraftCardsAction, promoteToPremiumTrackAction } from '@/app/actions/drafts';
import { deleteStagingCardsAction } from '@/app/actions/inventory';
import { useToastContext } from '@/components/admin/ToastProvider';

type DraftCard = any;

interface ManualIngestionGridProps {
  /** Increment this to trigger a re-fetch without lifting state globally. */
  refreshKey?: number;
}

export function ManualIngestionGrid({ refreshKey = 0 }: ManualIngestionGridProps) {
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const { showToast } = useToastContext();

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const rows = await listScanStagingAction('single_pair');
      setDrafts(rows || []);
    } catch (e: any) {
      showToast('Failed to load drafts: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === drafts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(drafts.map(d => d.id)));
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    // Optimistic update
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    try {
      await updateDraftCardAction(id, { [field]: value });
    } catch (e: any) {
      showToast('Failed to save edit: ' + e.message, 'error');
      loadDrafts(); // revert
    }
  };

  const handlePublish = async () => {
    if (!selectedIds.size) return;
    setIsPublishing(true);
    try {
      const res = await publishDraftCardsAction(Array.from(selectedIds));
      if (res.success) {
        showToast(`Successfully published ${selectedIds.size} cards!`, 'success');
        setSelectedIds(new Set());
        loadDrafts();
      } else {
        showToast('Publish failed: ' + res.error, 'error');
      }
    } catch (e: any) {
      showToast('Publish failed: ' + e.message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const res = await deleteStagingCardsAction([id]);
      if (res.success) {
        showToast('Draft deleted', 'success');
        setDrafts(prev => prev.filter(d => d.id !== id));
        const nextIds = new Set(selectedIds);
        nextIds.delete(id);
        setSelectedIds(nextIds);
      } else {
        showToast('Delete failed: ' + res.error, 'error');
      }
    } catch (e: any) {
      showToast('Delete failed: ' + e.message, 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              checked={drafts.length > 0 && selectedIds.size === drafts.length}
              onChange={toggleSelectAll}
            />
            <span className="text-sm font-bold text-slate-700">Select All ({selectedIds.size})</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!selectedIds.size) return;
              setIsPromoting(true);
              try {
                await promoteToPremiumTrackAction(Array.from(selectedIds));
                showToast(`${selectedIds.size} card(s) moved to Premium AI track.`, 'success');
                setSelectedIds(new Set());
                loadDrafts();
              } catch (e: any) {
                showToast('Promote failed: ' + e.message, 'error');
              } finally {
                setIsPromoting(false);
              }
            }}
            disabled={selectedIds.size === 0 || isPromoting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            {isPromoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Push to Premium
          </button>
          <button
            onClick={handlePublish}
            disabled={selectedIds.size === 0 || isPublishing}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publish Selected
          </button>
        </div>
      </div>

      {/* Grid */}
      {drafts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No drafts found in staging.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3">Images</th>
                  <th className="px-4 py-3">Player Name</th>
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Card #</th>
                  <th className="px-4 py-3">Parallel/Insert</th>
                  <th className="px-4 py-3 w-24">Price ($)</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((draft) => (
                  <tr 
                    key={draft.id} 
                    className={`hover:bg-slate-50 transition-colors ${selectedIds.has(draft.id) ? 'bg-indigo-50/50' : ''}`}
                  >
                    <td className="px-4 py-3 text-center align-middle">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        checked={selectedIds.has(draft.id)}
                        onChange={() => toggleSelect(draft.id)}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        {draft.image_url || draft.raw_front_url ? (
                          <img src={draft.image_url || draft.raw_front_url} className="w-10 h-14 object-cover rounded shadow-sm border border-slate-200 bg-slate-100" />
                        ) : (
                          <div className="w-10 h-14 bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          </div>
                        )}
                        {draft.back_image_url || draft.raw_back_url ? (
                          <img src={draft.back_image_url || draft.raw_back_url} className="w-10 h-14 object-cover rounded shadow-sm border border-slate-200 bg-slate-100" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <input 
                        type="text" 
                        defaultValue={draft.player_name || ''}
                        onBlur={(e) => handleUpdate(draft.id, 'player_name', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-1 font-bold text-slate-900 transition-colors"
                        placeholder="Player Name"
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <input 
                        type="text" 
                        defaultValue={draft.card_set || ''}
                        onBlur={(e) => handleUpdate(draft.id, 'card_set', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-1 font-medium text-slate-700 transition-colors"
                        placeholder="Card Set"
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <input 
                        type="text" 
                        defaultValue={draft.card_number || ''}
                        onBlur={(e) => handleUpdate(draft.id, 'card_number', e.target.value)}
                        className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-1 font-medium text-slate-700 transition-colors"
                        placeholder="#"
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <input 
                        type="text" 
                        defaultValue={draft.parallel_name || draft.insert_name || ''}
                        onBlur={(e) => handleUpdate(draft.id, 'parallel_name', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-1 font-medium text-slate-700 transition-colors"
                        placeholder="Parallel/Insert"
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="relative flex items-center">
                        <span className="absolute left-0 text-slate-400 font-bold">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          defaultValue={parseFloat(draft.listed_price || 0).toFixed(2)}
                          onBlur={(e) => handleUpdate(draft.id, 'price', e.target.value)}
                          className="w-full pl-3 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none py-1 font-black text-emerald-600 transition-colors"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <button 
                        onClick={() => handleDelete(draft.id)}
                        disabled={isDeleting === draft.id}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete Draft"
                      >
                        {isDeleting === draft.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
