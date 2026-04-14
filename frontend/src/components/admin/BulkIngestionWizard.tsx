'use client'

import { useState, useEffect } from 'react'
import { Upload, Loader2, Play, CheckCircle2, Wand2, DollarSign } from 'lucide-react'
import { vercelBatchInsertInventory, uploadAssetAction } from '@/app/actions/inventory'
import { submitBatchIngestAction, checkBatchStatusAction } from '@/app/actions/oracleAPI'
import { TaxonomySearch } from '@/components/admin/TaxonomySearch'

export function BulkIngestionWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [images, setImages] = useState<File[]>([])
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
    if (images.length === 0) return
    setIsUploading(true)
    try {
       const uploadPromises = images.map(async (img) => {
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm border border-indigo-100">
          <Wand2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Oracle Orchestration Batch Importer</h2>
          <p className="text-sm font-medium text-slate-500">FastAPI Polling ➔ PostgreSQL Commit</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-10 px-4 sm:px-10 relative">
         <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-slate-200 -z-10 translate-y-[-50%]"></div>
         {[
           { num: 1, label: 'Upload Batch' },
           { num: 2, label: 'Orchestrating' },
           { num: 3, label: 'Review & Mint' }
         ].map(s => (
           <div key={s.num} className="flex flex-col items-center bg-white px-2">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${step >= s.num ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-300'}`}>
               {s.num}
             </div>
             <span className={`text-[10px] mt-2 uppercase tracking-wide font-black ${step >= s.num ? 'text-indigo-900' : 'text-slate-400'}`}>{s.label}</span>
           </div>
         ))}
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Drag Files</label>
            <div 
              className={`border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition shadow-inner`}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload className="w-8 h-8 text-indigo-400 mb-3" />
              <span className="text-sm font-bold text-indigo-700">
                 {images.length > 0 ? `${images.length} Files Selected` : 'Click or Drop Image files'}
              </span>
              <input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={e => {if(e.target.files) setImages(Array.from(e.target.files))}} />
            </div>
          </div>
          <button 
            onClick={handleUpload}
            disabled={isUploading || images.length === 0 || creditsExhausted}
            className="w-full bg-indigo-600 text-white font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-indigo-700 hover:shadow transition flex items-center justify-center gap-3"
          >
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />} Submit Batch to AssetProcessor
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-20">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
          <h3 className="text-3xl font-black text-slate-900 mb-3">AI Engine Processing</h3>
          <p className="text-slate-500 font-medium text-lg">Polling Background Tasks every 3 seconds...</p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-bottom">
          <div className="max-h-[600px] overflow-y-auto space-y-6">
            
            {readyResults.length > 0 && (
               <div>
                  <h3 className="font-black text-slate-900 bg-emerald-100 p-2 text-emerald-800 rounded">Ready to Publish ({readyResults.length})</h3>
                  <div className="grid grid-cols-1 mt-3 gap-4">
                     {readyResults.map((r, i) => (
                        <div key={i} className="border p-4 rounded bg-white flex gap-4 items-center shadow-sm">
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
                  <h3 className="font-black text-slate-900 bg-orange-100 p-2 text-orange-800 rounded">Manual Correction Required ({needsCorrection.length})</h3>
                  <div className="grid grid-cols-1 mt-3 gap-4">
                     {needsCorrection.map((r, i) => (
                        <div key={i} className="border p-4 rounded bg-white flex gap-4 items-center shadow-sm border-orange-200">
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
            className="w-full bg-slate-900 text-white font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-emerald-600 transition flex items-center justify-center gap-3 drop-shadow-md"
          >
            {isCommitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />} 
            COMMIT TO POSTGRES DB
          </button>
        </div>
      )}
    </div>
  )
}
