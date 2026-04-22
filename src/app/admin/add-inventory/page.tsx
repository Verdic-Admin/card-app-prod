'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Upload, Crop, RefreshCcw, Sparkles, Image as ImageIcon, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { BulkIngestionWizard } from '@/components/admin/BulkIngestionWizard';
import { uploadAssetAction, addCardAction } from '@/app/actions/inventory';
import { identifyCardPair } from '@/app/actions/visionSync';
import { price } from '@/utils/math';

type StagedSingle = {
  id: string;
  frontFile: File | null;
  frontPreview: string | null;
  backFile: File | null;
  backPreview: string | null;
  data: {
    player_name: string;
    target_percentage: number;
    year: string;
    brand: string;
    card_set: string;
    card_number: string;
    parallel_name: string;
    insert_name: string;
    print_run: string;
    grading_company: string;
    grade: string;
    condition: string;
    listed_price: number;
    avg_price: number;
    is_rookie: boolean;
    is_auto: boolean;
    is_relic: boolean;
  };
  processing: boolean;
  saving: boolean;
  identified: boolean;
  saved: boolean;
};

function blankSingle(): StagedSingle {
  return {
    id: Math.random().toString(36).substring(7),
    frontFile: null,
    frontPreview: null,
    backFile: null,
    backPreview: null,
    data: {
      player_name: '',
      target_percentage: 80,
      year: '',
      brand: '',
      card_set: '',
      card_number: '',
      parallel_name: '',
      insert_name: '',
      print_run: '',
      grading_company: '',
      grade: '',
      condition: 'NM',
      listed_price: 0,
      avg_price: 0,
      is_rookie: false,
      is_auto: false,
      is_relic: false,
    },
    processing: false,
    saving: false,
    identified: false,
    saved: false,
  };
}

export default function AddInventoryPage() {
  const [activeView, setActiveView] = useState<'batch' | 'singles'>('batch');
  const [stagedSingles, setStagedSingles] = useState<StagedSingle[]>([]);

  const addNewManualSingle = () => {
    setStagedSingles(prev => [blankSingle(), ...prev]);
  };

  const updateSingleField = (id: string, field: keyof StagedSingle['data'], value: any) => {
    setStagedSingles(prev => prev.map(s =>
      s.id === id ? { ...s, data: { ...s.data, [field]: value } } : s
    ));
  };

  const handleSingleImageUpload = (id: string, side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setStagedSingles(prev => prev.map(s =>
      s.id === id
        ? {
          ...s,
          identified: false,
          ...(side === 'front'
            ? { frontFile: file, frontPreview: preview }
            : { backFile: file, backPreview: preview }),
        }
        : s
    ));
  };

  const identifySingle = async (id: string) => {
    const single = stagedSingles.find(s => s.id === id);
    if (!single?.frontFile || !single.backFile) {
      alert('Upload both front and back images before running AI scan.');
      return;
    }

    setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, processing: true } : s));

    try {
      const frontFormData = new FormData();
      frontFormData.append('file', single.frontFile);
      const { url: frontUrl } = await uploadAssetAction(frontFormData);

      const backFormData = new FormData();
      backFormData.append('file', single.backFile);
      const { url: backUrl } = await uploadAssetAction(backFormData);

      const result = await identifyCardPair({
        queue_id: `single-${id}`,
        side_a_url: frontUrl,
        side_b_url: backUrl,
      });

      setStagedSingles(prev => prev.map(s =>
        s.id === id
          ? {
            ...s,
            processing: false,
            identified: true,
            data: {
              ...s.data,
              player_name: result.player_name || s.data.player_name,
              card_set: result.card_set || s.data.card_set,
              card_number: result.card_number || s.data.card_number,
              insert_name: result.insert_name || s.data.insert_name,
              parallel_name: result.parallel_name || s.data.parallel_name,
              avg_price: s.data.avg_price,
              listed_price: s.data.listed_price,
            },
          }
          : s
      ));
    } catch (err: any) {
      alert(`AI scan failed: ${err.message}`);
      setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, processing: false } : s));
    }
  };

  const saveToDatabase = async (id: string) => {
    const single = stagedSingles.find(s => s.id === id);
    if (!single?.frontFile || !single.backFile) {
      alert('Upload both front and back images before saving to inventory.');
      return;
    }
    setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, saving: true } : s));
    try {
      const formData = new FormData();
      formData.append('image', single.frontFile);
      formData.append('back_image', single.backFile);
      formData.append('data', JSON.stringify({
        player_name: single.data.player_name,
        team_name: '',
        card_set: single.data.card_set,
        insert_name: single.data.insert_name,
        parallel_name: single.data.parallel_name,
        card_number: single.data.card_number,
        high_price: single.data.avg_price,
        low_price: single.data.avg_price,
        avg_price: single.data.avg_price,
        listed_price: single.data.listed_price,
        cost_basis: 0,
        accepts_offers: false,
        is_rookie: single.data.is_rookie,
        is_auto: single.data.is_auto,
        is_relic: single.data.is_relic,
        grading_company: single.data.grading_company || null,
        grade: single.data.grade || null,
      }));
      const result = await addCardAction(formData);
      if (!result.success) {
        alert('Save failed: ' + result.error);
        return;
      }
      setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, saving: false, saved: true } : s));
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
      setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, saving: false } : s));
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <Link href="/admin" className="text-sm text-brand hover:underline mb-2 inline-block font-bold">← Back to Admin</Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Add Inventory</h1>
          <p className="text-muted mt-1 font-medium max-w-2xl">
            Use the AI Batch Importer to process a full binder page scan, or switch to Singles to enter cards one at a time.
          </p>
        </div>

        <div className="flex bg-surface p-1 rounded-xl border border-border shadow-sm w-fit self-start md:self-end">
          <button
            onClick={() => setActiveView('batch')}
            className={`px-4 py-2 font-bold text-sm flex items-center gap-2 rounded-lg transition-all ${activeView === 'batch' ? 'bg-foreground text-background shadow-md' : 'text-muted hover:text-foreground'}`}
          >
            <ImageIcon className="w-4 h-4" /> Batch Importer
          </button>
          <button
            onClick={() => setActiveView('singles')}
            className={`px-4 py-2 font-bold text-sm flex items-center gap-2 rounded-lg transition-all ${activeView === 'singles' ? 'bg-foreground text-background shadow-md' : 'text-muted hover:text-foreground'}`}
          >
            <Crop className="w-4 h-4" /> Singles Staging
            {stagedSingles.length > 0 && (
              <span className="bg-brand text-background text-[10px] px-1.5 py-0.5 rounded-full">{stagedSingles.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* BATCH — BulkIngestionWizard (full scanner + orchestrator pipeline) */}
      {activeView === 'batch' && (
        <div className="animate-in slide-in-from-bottom-2 duration-300">
          <BulkIngestionWizard />
        </div>
      )}

      {/* SINGLES */}
      {activeView === 'singles' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">

          <div className="flex justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-surface-hover p-2 rounded-lg text-foreground mt-1">
                <Crop className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Singles Staging Area</h4>
                <p className="text-sm text-muted font-medium mt-1 max-w-xl">
                  Upload a card manually, fill in its details for free, or click "1-Click AI Scan" to identify and auto-price it using your API subscription.
                </p>
              </div>
            </div>
            <button
              onClick={addNewManualSingle}
              className="px-6 py-3 bg-foreground text-background font-bold rounded-lg hover:bg-foreground/90 transition-colors shadow-sm whitespace-nowrap"
            >
              + Create Empty Card
            </button>
          </div>

          <div className="space-y-6">
            {stagedSingles.map((single) => (
              <div key={single.id} className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col xl:flex-row">

                {/* Image Section */}
                <div className="xl:w-1/3 bg-surface-hover p-6 flex flex-col justify-center items-center gap-6 border-b xl:border-b-0 xl:border-r border-border">
                  <div className="flex gap-4 w-full">
                    {/* Front Image */}
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-widest text-center">Front (required)</label>
                      <div
                        onClick={() => !single.frontPreview && document.getElementById(`upload-front-${single.id}`)?.click()}
                        className={`aspect-[3/4] w-full rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center relative group
                          ${single.frontPreview ? 'border-border/50' : 'border-dashed border-border cursor-pointer hover:bg-surface hover:border-brand/50'}`}
                      >
                        {single.frontPreview ? (
                          <>
                            <img src={single.frontPreview} className="w-full h-full object-cover" alt="Front" />
                            <button
                              onClick={(e) => { e.stopPropagation(); setStagedSingles(p => p.map(s => s.id === single.id ? { ...s, frontFile: null, frontPreview: null, identified: false } : s)); }}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm"
                            >
                              Replace
                            </button>
                          </>
                        ) : (
                          <Upload className="w-5 h-5 text-muted mb-2 group-hover:text-brand transition-colors" />
                        )}
                      </div>
                      <input id={`upload-front-${single.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleSingleImageUpload(single.id, 'front', e)} />
                    </div>

                    {/* Back Image */}
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-widest text-center">Back (required)</label>
                      <div
                        onClick={() => !single.backPreview && document.getElementById(`upload-back-${single.id}`)?.click()}
                        className={`aspect-[3/4] w-full rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center relative group
                          ${single.backPreview ? 'border-border/50' : 'border-dashed border-border cursor-pointer hover:bg-surface hover:border-brand/50'}`}
                      >
                        {single.backPreview ? (
                          <>
                            <img src={single.backPreview} className="w-full h-full object-cover" alt="Back" />
                            <button
                              onClick={(e) => { e.stopPropagation(); setStagedSingles(p => p.map(s => s.id === single.id ? { ...s, backFile: null, backPreview: null } : s)); }}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm"
                            >
                              Replace
                            </button>
                          </>
                        ) : (
                          <Upload className="w-5 h-5 text-muted mb-2 group-hover:text-brand transition-colors" />
                        )}
                      </div>
                      <input id={`upload-back-${single.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleSingleImageUpload(single.id, 'back', e)} />
                    </div>
                  </div>

                  {/* AI Scan Button */}
                  <div className="w-full mt-2 text-center border-t border-border pt-6">
                    <button
                      onClick={() => identifySingle(single.id)}
                      disabled={single.processing || !single.frontFile || !single.backFile || single.identified}
                      className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {single.processing ? (
                        <><RefreshCcw className="w-5 h-5 animate-spin" /> Analyzing Card...</>
                      ) : single.identified ? (
                        <><CheckCircle2 className="w-5 h-5 text-emerald-300" /> Auto-Priced!</>
                      ) : (
                        <><Sparkles className="w-5 h-5" /> 1-Click AI Scan</>
                      )}
                    </button>
                    {!single.identified && (
                      <p className="text-[10px] text-muted font-bold tracking-wide uppercase mt-3">Requires front + back — then calls Identifier API</p>
                    )}
                  </div>
                </div>

                {/* Form Section */}
                <div className="flex-1 p-6 lg:p-8 flex flex-col relative">
                  {single.processing && (
                    <div className="absolute inset-0 z-10 bg-surface-hover/80 backdrop-blur-[2px] flex items-center justify-center rounded-r-2xl" />
                  )}

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-foreground">Card Details</h3>
                    <div className="text-right">
                      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Market Value</p>
                      <p className="text-2xl font-black text-emerald-500">${price(single.data.avg_price).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-5">
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Player Name</label>
                      <input
                        type="text"
                        value={single.data.player_name}
                        onChange={(e) => updateSingleField(single.id, 'player_name', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg p-3 font-semibold text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                        placeholder="e.g. LeBron James"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Card Set</label>
                      <input
                        type="text"
                        value={single.data.card_set}
                        onChange={(e) => updateSingleField(single.id, 'card_set', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                        placeholder="e.g. 2003 Topps Chrome"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Parallel / Color</label>
                      <input
                        type="text"
                        value={single.data.parallel_name}
                        onChange={(e) => updateSingleField(single.id, 'parallel_name', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                        placeholder="e.g. Refractor"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Insert</label>
                      <input
                        type="text"
                        value={single.data.insert_name}
                        onChange={(e) => updateSingleField(single.id, 'insert_name', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                        placeholder="e.g. All-Star Stitches"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:col-span-2">
                      <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Card #</label>
                        <input
                          type="text"
                          value={single.data.card_number}
                          onChange={(e) => updateSingleField(single.id, 'card_number', e.target.value)}
                          className="w-full bg-background border border-border rounded-lg p-3 text-sm font-medium text-foreground"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Print Run</label>
                        <input
                          type="text"
                          value={single.data.print_run}
                          onChange={(e) => updateSingleField(single.id, 'print_run', e.target.value)}
                          className="w-full bg-background border border-border rounded-lg p-3 text-sm font-medium text-foreground"
                          placeholder="/99"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Condition</label>
                        <select
                          value={single.data.condition}
                          onChange={(e) => updateSingleField(single.id, 'condition', e.target.value)}
                          className="w-full bg-background border border-border rounded-lg p-3 text-sm font-medium text-foreground"
                        >
                          <option>NM</option>
                          <option>EX</option>
                          <option>Graded</option>
                          <option>Damaged</option>
                        </select>
                      </div>
                    </div>

                    {/* Card attribute flags */}
                    <div className="flex items-center gap-4 flex-wrap py-1">
                      {([
                        { key: 'is_rookie' as const, label: 'RC (Rookie)' },
                        { key: 'is_auto'   as const, label: 'Auto' },
                        { key: 'is_relic'  as const, label: 'Relic' },
                      ]).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={single.data[key]}
                            onChange={e => updateSingleField(single.id, key, e.target.checked)}
                            className="w-4 h-4 accent-brand"
                          />
                          <span className="text-sm font-bold text-muted">{label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Grading details (shown when condition = Graded) */}
                    {single.data.condition === 'Graded' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Grading Company</label>
                          <select
                            value={single.data.grading_company}
                            onChange={e => updateSingleField(single.id, 'grading_company', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-3 text-sm font-medium text-foreground"
                          >
                            <option value="">Select...</option>
                            {['PSA', 'BGS', 'SGC', 'CGC', 'CSG'].map(g => <option key={g}>{g}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Grade</label>
                          <input
                            type="text"
                            value={single.data.grade}
                            onChange={e => updateSingleField(single.id, 'grade', e.target.value)}
                            placeholder="e.g. 10, 9.5"
                            className="w-full bg-background border border-border rounded-lg p-3 text-sm font-medium text-foreground"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Listed Price ($)</label>
                      <input
                        type="number"
                        value={single.data.listed_price}
                        onChange={(e) => updateSingleField(single.id, 'listed_price', parseFloat(e.target.value) || 0)}
                        className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3">
                    <button
                      onClick={() => setStagedSingles(prev => prev.filter(s => s.id !== single.id))}
                      className="px-5 py-3 border border-border text-muted font-bold rounded-lg hover:text-foreground transition-colors"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => saveToDatabase(single.id)}
                      disabled={single.saving || single.saved || !single.frontFile || !single.backFile}
                      className="px-8 py-3 bg-foreground text-background font-black rounded-lg hover:bg-foreground/90 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
                    >
                      {single.saving ? (
                        <><RefreshCcw className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : single.saved ? (
                        <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Saved!</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save to Database</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {stagedSingles.length === 0 && (
              <div className="text-center py-20 bg-surface border border-border rounded-2xl border-dashed">
                <Crop className="w-10 h-10 text-muted mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">No Cards in Staging</h3>
                <p className="text-muted font-medium mb-6 max-w-md mx-auto">
                  Click below to create an empty card slot, or switch to the Batch Importer to process a full binder page.
                </p>
                <button
                  onClick={addNewManualSingle}
                  className="px-6 py-3 bg-brand text-background rounded-lg font-bold shadow-sm"
                >
                  Create Empty Card
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
