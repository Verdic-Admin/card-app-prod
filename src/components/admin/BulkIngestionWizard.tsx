'use client'
import { useState, useEffect } from 'react'
import { Upload, Loader2, Play, CheckCircle2, Wand2, DollarSign } from 'lucide-react'
import { vercelBatchInsertInventory, uploadAssetAction } from '@/app/actions/inventory'
import { submitBatchIngestAction, checkBatchStatusAction } from '@/app/actions/oracleAPI'
import { TaxonomySearch } from '@/components/admin/TaxonomySearch'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'

export function BulkIngestionWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [images, setImages] = useState<File[]>([])
  const [uploadMode, setUploadMode] = useState<'batch' | 'single'>('batch')
  const [singleFront, setSingleFront] = useState<File | null>(null)
  const [singleBack, setSingleBack] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  
  // Results
  const [readyResults, setReadyResults] = useState<any[]>([])
  const [needsCorrection, setNeedsCorrection] = useState<any[]>([])
  
  // UX State
  const [isUploading, setIsUploading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [creditsExhausted, setCreditsExhausted] = useState(false)

  useEffect(() => {
    const handleExhaustion = () => setCreditsExhausted(true)
    window.addEventListener("api-credits-exhausted", handleExhaustion)
    return () => window.removeEventListener("api-credits-exhausted", handleExhaustion)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) setImages(Array.from(e.dataTransfer.files))
  }

  const handleUpload = async () => {
    const filesToProcess = uploadMode === 'batch' ? images : ([singleFront, singleBack].filter(Boolean) as File[]);
    if (filesToProcess.length === 0) return;
    setIsUploading(true)
    try {
       const uploadPromises = filesToProcess.map(async (img) => {
         const formData = new FormData()
         formData.append('file', img)
         const res = await uploadAssetAction(formData)
         return res.url
       })
       const mockUrls = await Promise.all(uploadPromises)

       // Submit array to orchestrator's batch route
       const response = await submitBatchIngestAction('local_shop', mockUrls);

       if (response.error === 'credits_exhausted') {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("api-credits-exhausted"));
              window.location.href = "/admin/billing";
            }
            throw new Error("API Credits Exhausted")
       }

       if (!response.success) throw new Error("Batch ingestion rejected: " + response.statusText)
       const data = response.data
       setJobId(data.job_id)
       setStep(2)
       startPolling(data.job_id)
    } catch (e: any) {
       alert("Failed to upload: " + e.message)
    } finally {
       setIsUploading(false)
    }
  }

  const startPolling = (id: string) => {
    setIsPolling(true)
    const interval = setInterval(async () => {
       try {
         const response = await checkBatchStatusAction(id)
         if (response.error === 'credits_exhausted') {
            clearInterval(interval)
            setIsPolling(false)
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("api-credits-exhausted"));
              window.location.href = "/admin/billing";
            }
            return
         }
         if (!response.success) {
           clearInterval(interval)
           setIsPolling(false)
           return
         }
         const data = response.data
         if (data.status === "completed") {
            clearInterval(interval)
            setIsPolling(false)
            setReadyResults(data.summary.ready_to_publish || [])
            setNeedsCorrection(data.summary.manual_correction_required || [])
            setStep(3)
         }
       } catch (err) {
          console.error(err)
       }
    }, 3000)
  }

  const handleCommit = async () => {
    setIsCommitting(true)
    try {
      const allCards = [...readyResults, ...needsCorrection]
      if (allCards.length > 0) {
        await vercelBatchInsertInventory(allCards)
      }
      setStep(1)
      setImages([])
      setReadyResults([])
      setNeedsCorrection([])
      setJobId(null)
    } catch (e: any) {
      alert("Failed to commit: " + e.message)
    } finally {
      setIsCommitting(false)
    }
  }

  const updateResultField = (idx: number, field: string, value: string, isCorrection: boolean) => {
     if (isCorrection) {
         const next = [...needsCorrection]
         next[idx] = { ...next[idx], [field]: value }
         setNeedsCorrection(next)
     } else {
         const next = [...readyResults]
         next[idx] = { ...next[idx], [field]: value }
         setReadyResults(next)
     }
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-6 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2 bg-brand/10 text-brand rounded-lg shadow-sm border border-brand/20">
          <Wand2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
             Player Index Batch Importer
             <InstructionTrigger 
                title="AI Ingestion Instructions"
                steps={[
                   { title: "Step 1: Scans & Photographs", content: "To ensure maximum OCR accuracy, use clear scans or photographs. A bright green background works best, as long as the background is non-reflective and the card stands out cleanly against it. Always ensure lighting prevents flash glare on the card surface." },
                   { title: "Step 2: Layout & Capacity", content: "You can include up to 9 cards in each photo/scan with at least an inch of space between each card. You must upload both the fronts and backs of the cards. CRITICAL: The fronts and backs MUST be placed in the exact same location in the image so the AI can map them together properly." },
                   { title: "Step 3: Understanding the API", content: "Once uploaded, your photos are sent to the Vision API queue. A background GPU node aligns the front/back crops across the 9 card matrix, isolates the card structure, and matches it against the Player Index to assign dynamic arbitrage models." },
                   { title: "Step 4: Verification & Editing", content: "Perfect matches land in your 'Ready to Commit' tab immediately. For cards missing card details (due to glare or Mojo/Shimmer parallels), use the manual search in the Correction Queue to manually force a pricing match." }
                ]}
             />
          </h2>
          <p className="text-sm font-medium text-muted">FastAPI Polling → PostgreSQL Commit</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-10 px-4 sm:px-10 relative">
         <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-border -z-10 translate-y-[-50%]"></div>
         {[
           { num: 1, label: 'Upload Batch' },
           { num: 2, label: 'Orchestrating' },
           { num: 3, label: 'Review & Mint' }
         ].map(s => (
           <div key={s.num} className="flex flex-col items-center bg-surface px-2">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${step >= s.num ? 'bg-brand text-brand-foreground border-brand shadow-md' : 'bg-surface text-muted border-border'}`}>
               {s.num}
             </div>
             <span className={`text-[10px] mt-2 uppercase tracking-wide font-black ${step >= s.num ? 'text-foreground' : 'text-muted'}`}>{s.label}</span>
           </div>
         ))}
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex bg-surface border border-border rounded-lg p-1 w-full max-w-sm mx-auto mb-2">
            <button 
               onClick={() => setUploadMode('batch')} 
               className={`flex-1 py-2 text-sm font-bold rounded-md transition ${uploadMode === 'batch' ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}`}>
               Batch Matrix
            </button>
            <button 
               onClick={() => setUploadMode('single')} 
               className={`flex-1 py-2 text-sm font-bold rounded-md transition ${uploadMode === 'single' ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}`}>
               Single Pair
            </button>
          </div>

          {uploadMode === 'batch' ? (
            <div>
              <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wider text-center">Batch Dropzone (9 Cards per scan)</label>
              <div 
                className={`border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if(e.dataTransfer.files) setImages(Array.from(e.dataTransfer.files));
                }}
                onClick={() => document.getElementById('file-upload-batch')?.click()}
              >
                <Upload className="w-8 h-8 text-brand/70 mb-3" />
                <span className="text-sm font-bold text-brand">
                   {images.length > 0 ? `${images.length} Files Selected` : 'Click or Drop Matrices'}
                </span>
                <input id="file-upload-batch" type="file" multiple accept="image/*" className="hidden" onChange={e => {if(e.target.files) setImages(Array.from(e.target.files))}} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wider text-center">Front Side</label>
                  <div 
                    className={`border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if(e.dataTransfer.files?.[0]) setSingleFront(e.dataTransfer.files[0]);
                    }}
                    onClick={() => document.getElementById('file-upload-front')?.click()}
                  >
                    <Upload className="w-8 h-8 text-brand/70 mb-3" />
                    <span className="text-sm font-bold text-brand text-center px-4">
                       {singleFront ? singleFront.name : '+ Drop Front'}
                    </span>
                    <input id="file-upload-front" type="file" accept="image/*" className="hidden" onChange={e => {if(e.target.files?.[0]) setSingleFront(e.target.files[0])}} />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wider text-center">Back Side</label>
                  <div 
                    className={`border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if(e.dataTransfer.files?.[0]) setSingleBack(e.dataTransfer.files[0]);
                    }}
                    onClick={() => document.getElementById('file-upload-back')?.click()}
                  >
                    <Upload className="w-8 h-8 text-brand/70 mb-3" />
                    <span className="text-sm font-bold text-brand text-center px-4">
                       {singleBack ? singleBack.name : '+ Drop Back'}
                    </span>
                    <input id="file-upload-back" type="file" accept="image/*" className="hidden" onChange={e => {if(e.target.files?.[0]) setSingleBack(e.target.files[0])}} />
                  </div>
               </div>
            </div>
          )}

          <button 
            onClick={handleUpload}
            disabled={isUploading || creditsExhausted || (uploadMode === 'batch' ? images.length === 0 : (!singleFront || !singleBack))}
            className="w-full bg-brand text-background font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-brand-hover hover:shadow transition flex items-center justify-center gap-3"
          >
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />} Submit
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-20">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
          <h3 className="text-3xl font-black text-foreground mb-3">AI Engine Processing</h3>
          <p className="text-muted font-medium text-lg">Polling Background Tasks every 3 seconds...</p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-bottom">
          <div className="max-h-[600px] overflow-y-auto space-y-6">
            
            {readyResults.length > 0 && (
               <div>
                  <h3 className="font-black text-foreground bg-emerald-500/20 p-2 text-emerald-500 rounded">Ready to Publish ({readyResults.length})</h3>
                  <div className="grid grid-cols-1 mt-3 gap-4">
                     {readyResults.map((r, i) => (
                        <div key={i} className="border p-4 rounded bg-surface flex gap-4 items-center shadow-sm">
                           <div className="flex-1 space-y-2">
                             <input value={r.player_name || ''} onChange={e => updateResultField(i, 'player_name', e.target.value, false)} className="block w-full border rounded p-1"/>
                             <input value={r.card_set || ''} onChange={e => updateResultField(i, 'card_set', e.target.value, false)} className="block w-full border rounded p-1"/>
                           </div>
                           <div className="bg-slate-100 p-3 text-right">
                              $ <input type="number" value={r.pricing?.listed_price || 0} onChange={()=>{}} className="w-20 rounded border p-1" readOnly/>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {needsCorrection.length > 0 && (
               <div>
                  <h3 className="font-black text-foreground bg-orange-100 p-2 text-orange-800 rounded">Manual Correction Required ({needsCorrection.length})</h3>
                  <div className="grid grid-cols-1 mt-3 gap-4">
                     {needsCorrection.map((r, i) => (
                        <div key={i} className="border p-4 rounded bg-surface flex gap-4 items-center shadow-sm border-orange-200">
                           <div className="flex-1 space-y-3">
                             <TaxonomySearch 
                               onSelect={(data) => {
                                 updateResultField(i, 'player_name', data.player_name, true)
                                 updateResultField(i, 'card_set', data.card_set, true)
                                 updateResultField(i, 'card_number', data.card_number, true)
                               }} 
                             />
                             <div className="flex gap-2">
                               <input value={r.player_name || ''} onChange={e => updateResultField(i, 'player_name', e.target.value, true)} className="block w-full border border-orange-300 rounded p-2 text-sm" placeholder="Player Name" />
                               <input value={r.card_set || ''} onChange={e => updateResultField(i, 'card_set', e.target.value, true)} className="block w-full border border-orange-300 rounded p-2 text-sm" placeholder="Card Set" />
                               <input value={r.card_number || ''} onChange={e => updateResultField(i, 'card_number', e.target.value, true)} className="block w-24 border border-orange-300 rounded p-2 text-sm" placeholder="#" />
                             </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

          </div>
          
          <button 
            onClick={handleCommit}
            disabled={isCommitting || creditsExhausted}
            className="w-full bg-slate-900 text-background font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-emerald-600 transition flex items-center justify-center gap-3 drop-shadow-md"
          >
            {isCommitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />} 
            COMMIT TO POSTGRES DB
          </button>
        </div>
      )}
    </div>
  )
}
