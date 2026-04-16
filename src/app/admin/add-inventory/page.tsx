'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Upload, Crop, RefreshCcw, Sparkles, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';

type StagedSingle = {
  id: string;
  frontImage: string | null;
  backImage: string | null;
  data: {
    player_name: string;
    target_percentage: number;
    year: string;
    brand: string;
    set_name: string;
    card_number: string;
    parallel: string;
    print_run: string;
    grading_company: string;
    grade: string;
    condition: string;
    market_value: number;
  };
  processing: boolean;
  identified: boolean;
};

export default function AddInventoryPage() {
  const [activeView, setActiveView] = useState<'batch' | 'singles'>('batch');
  
  // Batch State is now exclusively for a single 9-pocket page (Front + Back)
  const [batchFront, setBatchFront] = useState<string | null>(null);
  const [batchBack, setBatchBack] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const [stagedSingles, setStagedSingles] = useState<StagedSingle[]>([]);
  
  const batchFrontRef = useRef<HTMLInputElement>(null);
  const batchBackRef = useRef<HTMLInputElement>(null);

  // Handlers for Batch Grid Uploads
  const handleBatchImageUpload = (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      if (side === 'front') {
        setBatchFront(url);
      } else {
        setBatchBack(url);
      }
    }
  };

  const processBatchImages = async () => {
    // Requires both front and back
    if (!batchFront || !batchBack) return;

    setIsCropping(true);
    
    // Simulate hitting API to slice the 9-pocket page
    setTimeout(() => {
      // Simulate returning 9 cropped singles
      const newSingles: StagedSingle[] = Array.from({ length: 9 }).map((_, i) => ({
        id: Math.random().toString(36).substring(7),
        frontImage: batchFront, // Using the same image placeholder for visual
        backImage: batchBack,
        data: {
          player_name: '',
          target_percentage: 80,
          year: '',
          brand: '',
          set_name: '',
          card_number: '',
          parallel: '',
          print_run: '',
          grading_company: '',
          grade: '',
          condition: 'NM',
          market_value: 0
        },
        processing: false,
        identified: false
      }));
      
      setStagedSingles(prev => [...newSingles, ...prev]);
      setBatchFront(null);
      setBatchBack(null);
      setIsCropping(false);
      setActiveView('singles');
    }, 3000);
  };

  // Handlers for Singles
  const addNewManualSingle = () => {
    const newSingle: StagedSingle = {
      id: Math.random().toString(36).substring(7),
      frontImage: null,
      backImage: null,
      data: {
        player_name: '',
        target_percentage: 80,
        year: '',
        brand: '',
        set_name: '',
        card_number: '',
        parallel: '',
        print_run: '',
        grading_company: '',
        grade: '',
        condition: 'NM',
        market_value: 0
      },
      processing: false,
      identified: false
    };
    setStagedSingles(prev => [newSingle, ...prev]);
  };

  const identifySingle = async (id: string) => {
    setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, processing: true } : s));
    
    setTimeout(() => {
      setStagedSingles(prev => prev.map(s => s.id === id ? { 
        ...s, 
        processing: false, 
        identified: true,
        data: {
          ...s.data,
          player_name: 'Shohei Ohtani',
          year: '2018',
          brand: 'Topps Chrome',
          set_name: 'Update',
          market_value: 1250.00
        }
      } : s));
    }, 2500);
  };

  const updateSingleField = (id: string, field: keyof StagedSingle['data'], value: any) => {
    setStagedSingles(prev => prev.map(s => s.id === id ? {
      ...s,
      data: { ...s.data, [field]: value }
    } : s));
  };

  const handleSingleImageUpload = (id: string, side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setStagedSingles(prev => prev.map(s => s.id === id ? {
        ...s,
        [side === 'front' ? 'frontImage' : 'backImage']: url
      } : s));
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <Link href="/admin" className="text-sm text-brand hover:underline mb-2 inline-block font-bold">← Back to Admin</Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Add Inventory</h1>
          <p className="text-muted mt-1 font-medium max-w-2xl">
            Upload a 9-card binder page to auto-crop, or move to the singles view to enter cards one at a time.
          </p>
        </div>
        
        <div className="flex bg-surface p-1 rounded-xl border border-border shadow-sm w-fit self-start md:self-end">
          <button 
            onClick={() => setActiveView('batch')}
            className={`px-4 py-2 font-bold text-sm flex items-center gap-2 rounded-lg transition-all ${activeView === 'batch' ? 'bg-foreground text-background shadow-md' : 'text-muted hover:text-foreground'}`}
          >
            <ImageIcon className="w-4 h-4" /> 9-Card Batch Upload
          </button>
          <button 
            onClick={() => setActiveView('singles')}
            className={`px-4 py-2 font-bold text-sm flex items-center gap-2 rounded-lg transition-all ${activeView === 'singles' ? 'bg-foreground text-background shadow-md' : 'text-muted hover:text-foreground'}`}
          >
            <Crop className="w-4 h-4" /> Singles Staging
            {stagedSingles.length > 0 && <span className="bg-brand text-background text-[10px] px-1.5 py-0.5 rounded-full">{stagedSingles.length}</span>}
          </button>
        </div>
      </div>

      {/* BATCH (9-CARD BINDER) VIEW */}
      {activeView === 'batch' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          
          <div className="flex items-start gap-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4 mb-4">
             <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 mt-1">
               <AlertCircle className="w-5 h-5" />
             </div>
             <div>
               <h4 className="font-bold text-indigo-900 dark:text-indigo-300">Binder Page Extractor (API Usage)</h4>
               <p className="text-sm text-indigo-700 dark:text-indigo-400 font-medium mt-1">
                 Take <strong>one photo</strong> of the front of a binder page (up to 9 cards), and <strong>one photo</strong> of the back. Our computer vision API will automatically separate, rotate, and crop them into individual singles for staging.
               </p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Front of Binder Page */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-black uppercase tracking-widest text-foreground">Front of Binder Page</label>
              <div 
                onClick={() => !batchFront && batchFrontRef.current?.click()}
                className={`w-full aspect-[3/4] border-2 rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group transition-all
                  ${batchFront ? 'border-border/50' : 'border-dashed border-border cursor-pointer hover:bg-surface-hover hover:border-brand/50 bg-surface'}`}
              >
                {batchFront ? (
                  <>
                    <img src={batchFront} className="absolute inset-0 w-full h-full object-cover" alt="Front Binder Page" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setBatchFront(null); }}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white font-bold"
                    >
                      <RefreshCcw className="w-8 h-8 mb-2" />
                      Replace Image
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-brand" />
                    </div>
                    <p className="font-bold text-muted">Upload Front Grid</p>
                  </>
                )}
                <input ref={batchFrontRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleBatchImageUpload('front', e)} />
              </div>
            </div>

            {/* Back of Binder Page */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-black uppercase tracking-widest text-foreground">Back of Binder Page</label>
              <div 
                onClick={() => !batchBack && batchBackRef.current?.click()}
                className={`w-full aspect-[3/4] border-2 rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group transition-all
                  ${batchBack ? 'border-border/50' : 'border-dashed border-border cursor-pointer hover:bg-surface-hover hover:border-brand/50 bg-surface'}`}
              >
                {batchBack ? (
                  <>
                    <img src={batchBack} className="absolute inset-0 w-full h-full object-cover" alt="Back Binder Page" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setBatchBack(null); }}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white font-bold"
                    >
                      <RefreshCcw className="w-8 h-8 mb-2" />
                      Replace Image
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-brand" />
                    </div>
                    <p className="font-bold text-muted">Upload Back Grid</p>
                  </>
                )}
                <input ref={batchBackRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleBatchImageUpload('back', e)} />
              </div>
            </div>
          </div>

          {/* Action Area */}
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm mt-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">Process Binder Page</h3>
              <p className="text-sm text-muted font-medium">This will detect and extract up to 9 cards and move them directly into Singles Staging.</p>
            </div>
            <button 
              onClick={processBatchImages}
              disabled={!batchFront || !batchBack || isCropping}
              className="px-8 py-3 bg-brand text-background rounded-xl font-bold shadow-sm disabled:opacity-50 disabled:bg-muted disabled:text-foreground flex items-center gap-2 group transition-all"
            >
              {isCropping ? (
                <><RefreshCcw className="w-5 h-5 animate-spin" /> Extracting Cards...</>
              ) : (
                <><Crop className="w-5 h-5 group-hover:-rotate-12 transition-transform" /> Crop & Extract</>
              )}
            </button>
          </div>
          
        </div>
      )}

      {/* SINGLES VIEW */}
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
                  Upload a single card manually below. Fill out the data for free, or click "1-Click AI Scan" to identify and auto-price it via your API subscription.
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
            {stagedSingles.map((single, index) => (
              <div key={single.id} className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col xl:flex-row">
                
                {/* Image Section */}
                <div className="xl:w-1/3 bg-surface-hover p-6 flex flex-col justify-center items-center gap-6 border-b xl:border-b-0 xl:border-r border-border">
                  <div className="flex gap-4 w-full">
                    {/* Front Image */}
                    <div className="flex-1 flex flex-col gap-2 relative">
                      <label className="text-xs font-bold text-muted uppercase tracking-widest text-center">Front</label>
                      <div 
                        onClick={() => !single.frontImage && document.getElementById(`upload-front-${single.id}`)?.click()}
                        className={`aspect-[3/4] w-full rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center relative group
                          ${single.frontImage ? 'border-border/50' : 'border-dashed border-border cursor-pointer hover:bg-surface hover:border-brand/50'}`}
                      >
                        {single.frontImage ? (
                          <>
                            <img src={single.frontImage} className="w-full h-full object-cover" />
                            <button onClick={(e) => { e.stopPropagation(); updateSingleField(single.id, 'market_value' as any, null); }} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">
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
                    <div className="flex-1 flex flex-col gap-2 relative">
                      <label className="text-xs font-bold text-muted uppercase tracking-widest text-center">Back</label>
                      <div 
                         onClick={() => !single.backImage && document.getElementById(`upload-back-${single.id}`)?.click()}
                        className={`aspect-[3/4] w-full rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center relative group
                          ${single.backImage ? 'border-border/50' : 'border-dashed border-border cursor-pointer hover:bg-surface hover:border-brand/50'}`}
                      >
                        {single.backImage ? (
                          <>
                             <img src={single.backImage} className="w-full h-full object-cover" />
                             <button onClick={(e) => { e.stopPropagation(); updateSingleField(single.id, 'market_value' as any, null); }} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">
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

                  {/* Identification Button */}
                  <div className="w-full relative mt-2 text-center border-t border-border pt-6">
                     <button 
                       onClick={() => identifySingle(single.id)}
                       disabled={single.processing || !single.frontImage || single.identified}
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
                     {!single.identified && <p className="text-[10px] text-muted font-bold tracking-wide uppercase mt-3">Hits Scanner API</p>}
                  </div>
                </div>

                {/* Form Section */}
                <div className="flex-1 p-6 lg:p-8 flex flex-col relative">
                  {single.processing && (
                    <div className="absolute inset-0 z-10 bg-surface-hover/80 backdrop-blur-[2px] flex items-center justify-center rounded-r-2xl"></div>
                  )}
                  
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-foreground">Card Details</h3>
                    <div className="text-right">
                      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Market Value</p>
                      <p className="text-2xl font-black text-emerald-500">${single.data.market_value.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-5">
                    {/* Basic Info */}
                    <div className="col-span-1 md:col-span-2">
                       <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Player Name (Title)</label>
                       <input 
                         type="text" 
                         value={single.data.player_name}
                         onChange={(e) => updateSingleField(single.id, 'player_name', e.target.value)}
                         className="w-full bg-background border border-border rounded-lg p-3 font-semibold text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                         placeholder="e.g. LeBron James"
                       />
                    </div>
                    
                    <div>
                       <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Year</label>
                       <input 
                         type="text" 
                         value={single.data.year}
                         onChange={(e) => updateSingleField(single.id, 'year', e.target.value)}
                         className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                         placeholder="e.g. 2003"
                       />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Brand</label>
                       <input 
                         type="text" 
                         value={single.data.brand}
                         onChange={(e) => updateSingleField(single.id, 'brand', e.target.value)}
                         className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                         placeholder="e.g. Topps"
                       />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Set / Insert</label>
                       <input 
                         type="text" 
                         value={single.data.set_name}
                         onChange={(e) => updateSingleField(single.id, 'set_name', e.target.value)}
                         className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                         placeholder="e.g. Chrome"
                       />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Parallel / Color</label>
                       <input 
                         type="text" 
                         value={single.data.parallel}
                         onChange={(e) => updateSingleField(single.id, 'parallel', e.target.value)}
                         className="w-full bg-background border border-border rounded-lg p-3 font-medium text-foreground focus:ring-1 focus:ring-brand focus:border-brand"
                         placeholder="e.g. Refractor"
                       />
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:col-span-2">
                      <div>
                         <label className="text-xs font-bold text-muted uppercase tracking-widest mb-1 block">Number</label>
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
                           <option>Raw (NM)</option>
                           <option>Graded</option>
                           <option>Damaged</option>
                         </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button className="px-8 py-3 bg-foreground text-background font-black rounded-lg hover:bg-foreground/90 transition-colors shadow-md">
                      Save to Database
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {stagedSingles.length === 0 && (
              <div className="text-center py-20 bg-surface border border-border rounded-2xl border-dashed">
                <Crop className="w-10 h-10 text-muted mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">No Cards in Staging</h3>
                <p className="text-muted font-medium mb-6 max-w-md mx-auto">Click below to upload a card manually, or go back to the Binder Upload to auto-crop 9 cards at once.</p>
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
