'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle, Play, Save, Check, ExternalLink, Link2, Unlink, RefreshCw, Archive } from 'lucide-react'
import { addCardAction } from '@/app/actions/inventory'
import JSZip from 'jszip'

interface QueuedCard {
  id: string;
  file: File;
  padded_file?: File;
  preview: string;
  back_file?: File;
  back_padded_file?: File;
  back_preview?: string;
  status: 'queued' | 'scanning' | 'ready' | 'saving' | 'saved' | 'error';
  errorMsg?: string;
  data: {
    player_name: string;
    team_name: string;
    year: string;
    card_set: string;
    parallel_insert_type: string;
    card_number: string;
    comp1: string;
    comp2: string;
    comp3: string;
    side: string;
    isFetchingComps?: boolean;
    cost_basis?: number;
    accepts_offers?: boolean;
  }
}

export function BulkIngestionWizard() {
  const [queue, setQueue] = useState<QueuedCard[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [isSubmittingAll, setIsSubmittingAll] = useState(false)
  const [isFetchingAllComps, setIsFetchingAllComps] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [defaultCostBasis, setDefaultCostBasis] = useState<string>('0')
  const [defaultAcceptsOffers, setDefaultAcceptsOffers] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const newCards: QueuedCard[] = [];
    
    // 1. Smart Auto-Pairing logic
    const getBaseName = (filename: string) => filename.replace(/\.[^/.]+$/, "").replace(/(_|-|\s)*(front|back|side_?a|side_?b|1|2)$/i, "");
    const isBack = (filename: string) => /(_|-|\s)*(back|side_?b|2)\.[^/.]+$/i.test(filename);
    const isFront = (filename: string) => /(_|-|\s)*(front|side_?a|1)\.[^/.]+$/i.test(filename);

    const grouped = new Map<string, { front?: File, back?: File, unknown: File[] }>();
    
    fileArray.forEach(f => {
       const base = getBaseName(f.name);
       if (!grouped.has(base)) grouped.set(base, { unknown: [] });
       const group = grouped.get(base)!;
       
       if (isFront(f.name) && !group.front) group.front = f;
       else if (isBack(f.name) && !group.back) group.back = f;
       else group.unknown.push(f);
    });

    // 2. Zero-Touch Default Injection natively into payload
    const createData = (side: string) => ({
        player_name: '', team_name: '', year: '', card_set: '', parallel_insert_type: '', card_number: '',
        comp1: '', comp2: '', comp3: '', side, isFetchingComps: false,
        cost_basis: parseFloat(defaultCostBasis) || 0,
        accepts_offers: defaultAcceptsOffers
    });

    grouped.forEach(group => {
       if (group.front && group.back) {
          newCards.push({
             id: Math.random().toString(36).substring(7),
             file: group.front, preview: URL.createObjectURL(group.front),
             back_file: group.back, back_preview: URL.createObjectURL(group.back),
             status: 'queued', data: createData('Dual')
          });
       } else {
          [...(group.front ? [group.front] : []), ...(group.back ? [group.back] : []), ...group.unknown].forEach(f => {
             newCards.push({
               id: Math.random().toString(36).substring(7),
               file: f, preview: URL.createObjectURL(f),
               status: 'queued', data: createData(isBack(f.name) ? 'Back' : 'Front')
             });
          });
       }
    });

    setQueue(prev => [...prev, ...newCards])
  }

  const [isHardwareSyncing, setIsHardwareSyncing] = useState(false);

  const handleHardwareFiles = async (files: FileList | null) => {
     if (!files || files.length !== 2) return alert("Hardware Sync requires exactly TWO massive flatbed images: A Fronts Scan and a Backs Scan.");
     setIsHardwareSyncing(true);
     
     const fArray = Array.from(files);
     const isBackScan = (f: File) => /back/i.test(f.name);
     const backFile = fArray.find(isBackScan) || fArray[1];
     const frontFile = fArray.find(f => f !== backFile) || fArray[0];

     try {
        const getImgData = async (file: File) => {
           const img = await createImageBitmap(file);
           const canvas = document.createElement('canvas');
           canvas.width = img.width;
           canvas.height = img.height;
           const ctx = canvas.getContext('2d');
           if (!ctx) throw new Error("Canvas 2D context not available");
           ctx.drawImage(img, 0, 0);
           return ctx.getImageData(0, 0, img.width, img.height);
        };

        const frontsData = await getImgData(frontFile);
        const backsData = await getImgData(backFile);

        const worker = new Worker('/opencv_worker.js');

        worker.onmessage = async (e) => {
            if (e.data.type === 'SUCCESS') {
                const json = e.data;
                const generatedFiles: File[] = [];
                
                for (const card of json.cards) {
                    const toFile = async (data: ImageData, name: string): Promise<File> => {
                        const canvas = document.createElement('canvas');
                        canvas.width = data.width;
                        canvas.height = data.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) throw new Error("Canvas 2D context not available");
                        ctx.putImageData(data, 0, 0);
                        
                        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
                        return new File([blob!], name, { type: 'image/jpeg' });
                    };
                    
                    const f1Tight = await toFile(card.frontTightData, `${card.name}_SideA_Tight.jpg`);
                    const f1Padded = await toFile(card.frontPaddedData, `${card.name}_SideA_Padded.jpg`);
                    const f2Tight = await toFile(card.backTightData, `${card.name}_SideB_Tight.jpg`);
                    const f2Padded = await toFile(card.backPaddedData, `${card.name}_SideB_Padded.jpg`);
                    
                    // Directly scaffold the QueuedCard with the hidden Padded backup strings
                    const newCard: QueuedCard = {
                       id: Math.random().toString(36).substring(7),
                       file: f1Tight,
                       padded_file: f1Padded,
                       preview: URL.createObjectURL(f1Tight),
                       back_file: f2Tight,
                       back_padded_file: f2Padded,
                       back_preview: URL.createObjectURL(f2Tight),
                       status: 'queued',
                       data: { player_name: '', team_name: '', year: '', card_set: '', parallel_insert_type: '', card_number: '', comp1: '', comp2: '', comp3: '', side: 'Dual', isFetchingComps: false, cost_basis: parseFloat(defaultCostBasis) || 0, accepts_offers: defaultAcceptsOffers }
                    }
                    setQueue(prev => [...prev, newCard])
                }
                worker.terminate();
            } else if (e.data.type === 'ERROR') {
                setIsHardwareSyncing(false);
                alert("WASM OpenCV Target Error: " + e.data.message);
                worker.terminate();
            }
        };

        worker.postMessage({
            type: 'PROCESS_HARDWARE_SCANS',
            frontsObj: { imageData: frontsData.data.buffer, width: frontsData.width, height: frontsData.height },
            backsObj: { imageData: backsData.data.buffer, width: backsData.width, height: backsData.height }
        }, [frontsData.data.buffer, backsData.data.buffer]);
        
     } catch(e: any) {
        setIsHardwareSyncing(false);
        alert("Hardware WebWorker Pipeline Crash: " + e.message);
     }
  }

  const handleDownloadBackupZip = async () => {
    if (queue.length === 0) return;
    const zip = new JSZip();
    queue.forEach(card => {
       const safeName = card.data.player_name ? `${card.data.player_name}-${card.data.year}-${card.id}` : `raw_crop_${card.id}`;
       zip.file(`Tight_Crops/${safeName}_SideA_Tight.jpg`, card.file);
       if (card.padded_file) zip.file(`Manual_Backups/${safeName}_SideA_Padded.jpg`, card.padded_file);
       if (card.back_file) zip.file(`Tight_Crops/${safeName}_SideB_Tight.jpg`, card.back_file);
       if (card.back_padded_file) zip.file(`Manual_Backups/${safeName}_SideB_Padded.jpg`, card.back_padded_file);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WASM_OpenCV_Backup_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const updateCard = (id: string, updates: Partial<QueuedCard>) => {
    setQueue(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const updateCardData = (id: string, field: keyof QueuedCard['data'], val: string) => {
    setQueue(prev => prev.map(c => c.id === id ? { ...c, data: { ...c.data, [field]: val } } : c))
  }

  const scanCard = async (card: QueuedCard) => {
    updateCard(card.id, { status: 'scanning', errorMsg: undefined })
    try {
      const data = new FormData()
      data.append('image', card.file)
      
      // If manually paired BEFORE scan, inject the back_image right now
      if (card.back_file) {
         data.append('back_image', card.back_file)
      }
      
      const res = await fetch('/api/scan', { method: 'POST', body: data })
      if (!res.ok) throw new Error('AI Scan failed')
      
      const json = await res.json()
      const updatedData = {
        ...card.data,
        player_name: json.player_name || '',
        team_name: json.team_name || '',
        year: json.year || '',
        card_set: json.card_set || '',
        parallel_insert_type: json.parallel_insert_type || '',
        card_number: json.card_number || '',
        side: json.side || (card.back_file ? 'Dual' : 'Front')
      };

      updateCard(card.id, {
        status: 'ready',
        data: updatedData
      });
      
      // 4. Decoupled Async Pricing: Fire fetching right away without awaiting
      if (updatedData.side !== 'Back') {
          fetchComps(card.id, updatedData).catch(console.error);
      }
      return true;
    } catch (err: any) {
      updateCard(card.id, { status: 'error', errorMsg: err.message })
      return false;
    }
  }

  const processAllQueued = async () => {
    setIsProcessingQueue(true);
    const pending = queue.filter(c => c.status === 'queued');
    
    // 3. Concurrent AI Processing (Batch size 3)
    const BATCH_SIZE = 3;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(card => scanCard(card)));
        
        // Brief delay between concurrent batches to respect limits but vastly outpace strict seq
        if (i + BATCH_SIZE < pending.length) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    setIsProcessingQueue(false);
  }

  const manuallyPairBack = (frontId: string, backId: string) => {
    setQueue(prev => {
       const backItem = prev.find(c => c.id === backId)
       if (!backItem) return prev;
       
       return prev.map(c => {
          if (c.id === frontId) {
             return { 
                ...c, 
                back_file: backItem.file, 
                back_preview: backItem.preview,
                data: {
                   ...c.data,
                   year: c.data.year || backItem.data.year,
                   card_number: c.data.card_number || backItem.data.card_number,
                   card_set: c.data.card_set || backItem.data.card_set,
                   side: c.status === 'ready' ? 'Dual' : c.data.side
                }
             }
          }
          return c
       }).filter(c => c.id !== backId)
    })
  }

  const removePairedBack = (frontId: string) => {
     setQueue(prev => {
        const frontItem = prev.find(c => c.id === frontId)
        if (!frontItem || !frontItem.back_file) return prev;
        
        const extractedBack: QueuedCard = {
           id: Math.random().toString(36).substring(7),
           file: frontItem.back_file,
           preview: frontItem.back_preview!,
           status: frontItem.status === 'queued' ? 'queued' : 'ready',
           data: { ...frontItem.data, side: 'Back' }
        }

        return prev.map(c => {
           if (c.id === frontId) {
              const { back_file, back_preview, ...rest } = c;
              rest.data = { ...rest.data, side: rest.status === 'queued' ? '' : 'Front' }
              return rest as QueuedCard;
           }
           return c
        }).concat(extractedBack)
     })
  }

  const swapCardImage = (id: string, newFile: File, side: 'front' | 'back') => {
    setQueue(prev => prev.map(c => {
      if (c.id === id) {
        if (side === 'front') {
           URL.revokeObjectURL(c.preview);
           return { ...c, file: newFile, preview: URL.createObjectURL(newFile) };
        } else {
           if (c.back_preview) URL.revokeObjectURL(c.back_preview);
           return { ...c, back_file: newFile, back_preview: URL.createObjectURL(newFile) };
        }
      }
      return c;
    }))
  }

  const getAvg = (card: QueuedCard) => {
    const prices = [parseFloat(card.data.comp1), parseFloat(card.data.comp2), parseFloat(card.data.comp3)].filter(p => !isNaN(p) && p > 0)
    if (prices.length === 0) return { high: 0, low: 0, avg: 0 }
    return {
      high: Math.max(...prices),
      low: Math.min(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length
    }
  }

  const saveCard = async (card: QueuedCard) => {
    updateCard(card.id, { status: 'saving', errorMsg: undefined })
    try {
      const data = new FormData()
      data.append('image', card.file)
      if (card.back_file) {
         data.append('back_image', card.back_file)
      }
      
      const { high, low, avg } = getAvg(card)
      
      // The user requested smart retail rounding to the nearest .09 cent to boost sales psychology!
      // Example: 1.26 -> 12.6 -> 13 -> 1.30 -> 1.29.
      let retailAvg = avg;
      if (avg > 0) {
        retailAvg = Number((Math.round(avg * 10) / 10 - 0.01).toFixed(2));
        if (retailAvg <= 0) retailAvg = 0.99; // safe floor
      }

      const payload = { 
        ...card.data, 
        high_price: high, 
        low_price: low, 
        avg_price: retailAvg,
        listed_price: retailAvg,
        cost_basis: card.data.cost_basis !== undefined ? card.data.cost_basis : (parseFloat(defaultCostBasis) || 0),
        accepts_offers: card.data.accepts_offers !== undefined ? card.data.accepts_offers : defaultAcceptsOffers
      }
      
      data.append('data', JSON.stringify(payload))
      
      await addCardAction(data)
      updateCard(card.id, { status: 'saved' })
    } catch (err: any) {
      updateCard(card.id, { status: 'error', errorMsg: err.message })
    }
  }

  const submitAllReady = async () => {
    setIsSubmittingAll(true)
    const readyCards = queue.filter(c => c.status === 'ready')
    await Promise.allSettled(readyCards.map(c => saveCard(c)))
    setIsSubmittingAll(false)
  }

  const fetchComps = async (cardId: string, dataToUse: QueuedCard['data']) => {
    updateCardData(cardId, 'isFetchingComps', 'true' as any)
    try {
      const rawParts = [dataToUse.year, dataToUse.player_name, dataToUse.card_set, dataToUse.parallel_insert_type, dataToUse.card_number]
      const parts = rawParts.map(p => String(p || '')).filter(p => p.trim() !== '')
      const searchString = parts.join(' ')
      
      const res = await fetch(`/api/ebay-comps?q=${encodeURIComponent(searchString)}`)
      
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Server returned ${res.status}: ${errorText}`)
      }
        
      const { prices, error } = await res.json()
      
      if (error) {
         throw new Error(`API Error: ${error}`)
      }
      
      // Auto-fill top 3 prices
      if (prices && prices.length > 0) {
        if (prices[0]) updateCardData(cardId, 'comp1', prices[0].toFixed(2))
        if (prices[1]) updateCardData(cardId, 'comp2', prices[1].toFixed(2))
        if (prices[2]) updateCardData(cardId, 'comp3', prices[2].toFixed(2))
        
        // Clear any old error messages if it succeeded
        updateCard(cardId, { errorMsg: undefined })
      } else {
        updateCard(cardId, { errorMsg: `Searched "${searchString}", but SerpApi found zero comp results!` })
      }
    } catch (err: any) {
      console.error(err)
      updateCard(cardId, { errorMsg: 'Fetch Comps Failed: ' + err.message })
    } finally {
      updateCardData(cardId, 'isFetchingComps', '' as any)
    }
  }

  const fetchAllComps = async () => {
    setIsFetchingAllComps(true)
    // Only attempt on ready fronts/duals that don't already have comp1 filled
    const readyCards = queue.filter(c => c.status === 'ready' && c.data.side !== 'Back' && !c.data.comp1)
    
    for (const card of readyCards) {
        await fetchComps(card.id, card.data)
        // Respect eBay API Rate limits
        await new Promise(resolve => setTimeout(resolve, 1500))
    }
    setIsFetchingAllComps(false)
  }

  const queuedCount = queue.filter(c => c.status === 'queued').length;
  const etaSeconds = queuedCount * 4;
  const availableBacks = queue.filter(c => c.status === 'ready' && c.data.side === 'Back')
  const availableQueuedBacks = queue.filter(c => c.status === 'queued')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-t-4 border-t-indigo-500">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
             Bulk Upload Pipeline
           </h2>
           <p className="text-xs font-semibold text-slate-500 mt-1">Select multiple images to securely queue them for delayed bulk AI extraction processing.</p>
           
           <div className="flex items-center gap-6 mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 inline-flex">
              <div className="flex items-center gap-2">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Default Cost Basis $</label>
                 <input type="number" step="0.01" value={defaultCostBasis} onChange={e => setDefaultCostBasis(e.target.value)} className="w-20 p-1.5 text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded outline-none focus:ring-2 focus:ring-indigo-500 text-center" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={defaultAcceptsOffers} onChange={e => setDefaultAcceptsOffers(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                 <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Accept Offers</span>
              </label>
           </div>
        </div>
        <div className="flex gap-3">
          {queue.length > 0 && (
            <button 
              onClick={processAllQueued} 
              disabled={isProcessingQueue || queuedCount === 0}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition shadow-sm"
            >
              {isProcessingQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Scan All Files
            </button>
          )}
          {queue.length > 0 && (
             <button 
                onClick={handleDownloadBackupZip} 
                className="bg-zinc-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-zinc-900 flex items-center gap-2 transition shadow-sm"
             >
                <Archive className="w-4 h-4" />
                Backup Local ZIP
             </button>
          )}
          {queue.filter(c => c.status === 'ready' && c.data.side !== 'Back').length > 0 && (
             <button 
                onClick={fetchAllComps} 
                disabled={isFetchingAllComps}
                className="bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2 transition shadow-sm"
             >
                {isFetchingAllComps ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Fetch All Comps
             </button>
          )}
          {queue.filter(c => c.status === 'ready').length > 0 && (
             <button 
                onClick={submitAllReady} 
                disabled={isSubmittingAll}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition shadow-sm"
             >
                {isSubmittingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Submit All Ready
             </button>
          )}
        </div>
      </div>

      {isProcessingQueue && queuedCount > 0 && (
        <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-lg p-5 flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-full shadow-sm"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
            <div>
              <div className="text-sm font-bold text-indigo-900">AI Batch Processor Active</div>
              <div className="text-xs text-indigo-700 font-medium tracking-wide">Scanning {queuedCount} remaining cards sequentially...</div>
            </div>
          </div>
          <div className="text-right">
             <div className="text-xs text-indigo-500 font-bold uppercase tracking-widest">Estimated Time left</div>
             <div className="text-xl font-black text-indigo-900 font-mono">~{etaSeconds}s</div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 ${isDragging ? 'border-emerald-400 border-dashed bg-emerald-50 scale-[1.01]' : 'border-indigo-200 border-dashed bg-indigo-50/50 hover:bg-indigo-50'} rounded-xl cursor-pointer transition-all`}>
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className={`w-8 h-8 ${isDragging ? 'text-emerald-500' : 'text-indigo-400'}`} />
              <span className={`text-sm font-bold ${isDragging ? 'text-emerald-700' : 'text-indigo-600'}`}>
                 Standard Upload (Single Scans)
              </span>
              <span className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-widest text-center px-4">Drop individual card images here, or click to browse</span>
            </div>
            <input type="file" multiple className="hidden" accept="image/*" ref={fileInputRef} onChange={e => handleFiles(e.target.files)} />
          </label>
        </div>

        <div>
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-emerald-400 hover:border-emerald-500 border-dashed bg-emerald-50 hover:bg-emerald-100 rounded-xl cursor-pointer transition-all ${isHardwareSyncing ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex flex-col items-center justify-center gap-2">
              {isHardwareSyncing ? <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" /> : <RefreshCw className="w-8 h-8 text-emerald-500" />}
              <span className="text-sm font-bold text-emerald-700">
                 {isHardwareSyncing ? 'Executing Native WebAssembly Processor...' : 'Hardware Sync (Native Browser WASM)'}
              </span>
              <span className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-widest text-center px-4 mt-0.5">Select exactly 1 massive Fronts scan & 1 Backs scan to unleash full local edge-automation</span>
            </div>
            <input type="file" multiple className="hidden" accept="image/*" disabled={isHardwareSyncing} onChange={e => handleHardwareFiles(e.target.files)} />
          </label>
        </div>
      </div>

      {/* Staging Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {queue.map(card => (
          <div key={card.id} className={`rounded-xl border flex flex-col overflow-hidden transition-all shadow-sm ${card.status === 'saved' ? 'opacity-50 grayscale border-slate-200 bg-slate-50' : card.status === 'error' ? 'border-red-300 ring-4 ring-red-100/50' : card.status === 'scanning' ? 'border-indigo-400 ring-4 ring-indigo-100/50' : card.status === 'ready' ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'}`}>
            <div className="flex items-stretch p-4 bg-slate-50 border-b border-slate-200/60 gap-4 relative">
              <div className="flex gap-3 relative z-10 flex-shrink-0">
                 <div 
                    draggable={card.status === 'queued' && !card.back_file}
                    onDragStart={e => {
                       e.dataTransfer.effectAllowed = 'move';
                       e.dataTransfer.setData('sourceId', card.id)
                    }}
                    onDragOver={e => {
                       if (card.status === 'queued' && !card.back_file) {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                       }
                    }}
                    onDrop={e => {
                       e.preventDefault();
                       const sourceId = e.dataTransfer.getData('sourceId')
                       if (sourceId && sourceId !== card.id && card.status === 'queued' && !card.back_file) {
                          manuallyPairBack(card.id, sourceId)
                       }
                    }}
                    className={`w-32 h-44 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm relative group ${card.status === 'queued' && !card.back_file ? 'cursor-grab active:cursor-grabbing hover:ring-4 hover:ring-indigo-400/50 transition-all' : ''}`}
                    title={card.status === 'queued' && !card.back_file ? "Drag & Drop onto another image to merge!" : ""}
                 >
                   <img src={card.preview} className="w-full h-full object-contain pointer-events-none" />
                   {card.status === 'scanning' && <div className="absolute inset-0 bg-indigo-900/60 flex items-center justify-center backdrop-blur-[2px] transition-all"><Loader2 className="text-white w-8 h-8 animate-spin" /></div>}
                   {card.status === 'saved' && <div className="absolute inset-0 bg-emerald-900/70 flex items-center justify-center backdrop-blur-[1px] transition-all"><CheckCircle2 className="text-emerald-100 w-10 h-10" /></div>}
                   <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] uppercase tracking-wider font-bold text-center py-1">{card.data.side || 'Front'}</div>
                   <label className="absolute top-1 left-1 bg-white/90 hover:bg-white text-indigo-600 p-1.5 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm" title="Swap Front Image">
                       <Upload className="w-4 h-4" />
                       <input disabled={card.status === 'saved' || card.status === 'scanning'} type="file" className="hidden" accept="image/*" onChange={e => { if (e.target.files?.[0]) swapCardImage(card.id, e.target.files[0], 'front') }} />
                   </label>
                 </div>
                 {card.back_preview && (
                    <div className="w-32 h-44 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm relative group">
                       <img src={card.back_preview} className="w-full h-full object-contain pointer-events-none" />
                       <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] uppercase tracking-wider font-bold text-center py-1">Back</div>
                       <label className="absolute top-1 left-1 bg-white/90 hover:bg-white text-indigo-600 p-1.5 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm" title="Swap Back Image">
                           <Upload className="w-4 h-4" />
                           <input disabled={card.status === 'saved' || card.status === 'scanning'} type="file" className="hidden" accept="image/*" onChange={e => { if (e.target.files?.[0]) swapCardImage(card.id, e.target.files[0], 'back') }} />
                       </label>
                       <button onClick={() => removePairedBack(card.id)} className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Unlink Back Image"><Unlink className="w-4 h-4" /></button>
                    </div>
                 )}
              </div>
              
              <div className="flex-grow flex flex-col justify-center space-y-2 z-10">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Card ID: {card.id.toUpperCase()}</div>
                {card.status === 'queued' && <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-xs font-bold w-max shadow-sm border border-slate-300/50">Queued</span>}
                {card.status === 'scanning' && <span className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-bold w-max shadow-sm border border-indigo-200/50"><Loader2 className="w-3 h-3 animate-spin mr-1.5"/> Scanning...</span>}
                {card.status === 'ready' && <span className="inline-flex items-center px-2.5 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold w-max shadow-sm border border-amber-200/50">Needs Pricing Check</span>}
                {card.status === 'saving' && <span className="inline-flex items-center px-2.5 py-1 rounded bg-sky-100 text-sky-700 text-xs font-bold w-max shadow-sm border border-sky-200/50"><Loader2 className="w-3 h-3 animate-spin mr-1.5"/> Saving...</span>}
                {card.status === 'saved' && <span className="inline-flex items-center px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold w-max shadow-sm border border-emerald-300/50"><Check className="w-3 h-3 mr-1.5 stroke-[3px]"/> Published Live</span>}
                {card.status === 'error' && <span className="inline-flex items-center px-2.5 py-1 rounded bg-red-100 text-red-700 text-xs font-bold w-max shadow-sm border border-red-200/50"><AlertCircle className="w-3 h-3 mr-1.5"/> Error</span>}
                {card.back_file && <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold w-max border border-blue-200/50"><Link2 className="w-3 h-3 mr-1"/> Auto-Paired Dual Sided</span>}
              </div>
            </div>

            <div className="p-4 space-y-2 bg-white flex-grow">
               <div className="flex gap-2">
                 <input disabled={card.status === 'saved' || card.status === 'saving'} type="text" value={card.data.player_name} onChange={e => updateCardData(card.id, 'player_name', e.target.value)} className="w-1/2 p-2 text-sm font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-colors shadow-sm" placeholder="Player Name" />
                 <input disabled={card.status === 'saved' || card.status === 'saving'} type="text" value={card.data.team_name} onChange={e => updateCardData(card.id, 'team_name', e.target.value)} className="w-1/2 p-2 text-sm font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-colors shadow-sm" placeholder="Team Name" />
               </div>
               <div className="flex gap-2">
                 <input disabled={card.status === 'saved'} type="text" value={card.data.year} onChange={e => updateCardData(card.id, 'year', e.target.value)} className="w-1/3 p-2 text-xs font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-colors shadow-sm" placeholder="Year" />
                 <input disabled={card.status === 'saved'} type="text" value={card.data.card_set} onChange={e => updateCardData(card.id, 'card_set', e.target.value)} className="w-2/3 p-2 text-xs font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-colors shadow-sm" placeholder="Card Set" />
               </div>
               <div className="flex gap-2">
                 <input disabled={card.status === 'saved'} type="text" value={card.data.card_number} onChange={e => updateCardData(card.id, 'card_number', e.target.value)} className="w-1/3 p-2 text-xs font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-colors shadow-sm" placeholder="Number" />
                 <input disabled={card.status === 'saved'} type="text" value={card.data.parallel_insert_type} onChange={e => updateCardData(card.id, 'parallel_insert_type', e.target.value)} className="w-2/3 p-2 text-xs font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-colors shadow-sm" placeholder="Parallel/Insert" />
               </div>

               {card.status === 'queued' && !card.back_file && availableQueuedBacks.length > 1 && (
                  <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Select Back Image to Merge Before Scan</label>
                     <select onChange={e => { if (e.target.value) manuallyPairBack(card.id, e.target.value) }} className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                        <option value="">-- Pair with a queued image --</option>
                        {availableQueuedBacks.filter(b => b.id !== card.id && !b.back_file).map(b => (
                           <option key={b.id} value={b.id}>
                              Queued Back Image: ID {b.id.toUpperCase()}
                           </option>
                        ))}
                     </select>
                  </div>
               )}
               
               {card.status === 'ready' && card.data.side !== 'Back' && !card.back_file && availableBacks.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Manual Override: Attach Post-Scan Back</label>
                     <select onChange={e => { if (e.target.value) manuallyPairBack(card.id, e.target.value) }} className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                        <option value="">-- Select a scanned back image --</option>
                        {availableBacks.map(b => (
                           <option key={b.id} value={b.id}>
                              Orphaned Back: {b.data.player_name} #{b.data.card_number}
                           </option>
                        ))}
                     </select>
                  </div>
               )}

               {card.status !== 'queued' && card.status !== 'scanning' && card.data.side !== 'Back' && (
               <div className="pt-3 mt-3 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Pricing Setup</span>
                     <button onClick={() => fetchComps(card.id, card.data)} disabled={!card.data.player_name || card.status === 'saved' || !!card.data.isFetchingComps} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 transition-colors disabled:opacity-50 disabled:grayscale">
                       {card.data.isFetchingComps ? <><Loader2 className="w-3 h-3 animate-spin"/> Fetching...</> : <>Auto-Fetch Comps <ExternalLink className="w-3 h-3" /></>}
                     </button>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input disabled={card.status === 'saved'} inputMode="decimal" type="text" value={card.data.comp1} onChange={e => updateCardData(card.id, 'comp1', e.target.value)} className="w-1/3 p-2 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:bg-indigo-50 focus:border-indigo-500 outline-none disabled:opacity-50 text-center transition-colors shadow-sm" placeholder="C1 $" title="Comp 1" />
                    <input disabled={card.status === 'saved'} inputMode="decimal" type="text" value={card.data.comp2} onChange={e => updateCardData(card.id, 'comp2', e.target.value)} className="w-1/3 p-2 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:bg-indigo-50 focus:border-indigo-500 outline-none disabled:opacity-50 text-center transition-colors shadow-sm" placeholder="C2 $" title="Comp 2"/>
                    <input disabled={card.status === 'saved'} inputMode="decimal" type="text" value={card.data.comp3} onChange={e => updateCardData(card.id, 'comp3', e.target.value)} className="w-1/3 p-2 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal border border-slate-300 rounded focus:bg-indigo-50 focus:border-indigo-500 outline-none disabled:opacity-50 text-center transition-colors shadow-sm" placeholder="C3 $" title="Comp 3" />
                  </div>
                  {card.status !== 'saved' && (
                      <button onClick={() => saveCard(card)} disabled={card.status === 'saving'} className="w-full bg-slate-900 text-white font-bold text-sm py-2.5 rounded shadow-sm hover:bg-emerald-600 flex justify-center items-center gap-2 transition-colors disabled:opacity-50">
                        {card.status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Confirm & Publish
                      </button>
                  )}
               </div>
               )}
            </div>
            {card.errorMsg && <div className="bg-red-50 py-2 px-4 text-xs text-red-700 font-bold break-words border-t border-red-200 flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{card.errorMsg}</div>}
          </div>
        ))}
      </div>
      
    </div>
  )
}
