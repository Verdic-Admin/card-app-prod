'use client'

import { useState } from 'react'
import { Upload, Loader2, Play, Save, CheckCircle2, ChevronRight, Wand2, DollarSign } from 'lucide-react'
import { uploadImagesToScanner, identifyCardPair } from '@/app/actions/visionSync'
import { getBatchOraclePrices, getSingleOraclePrice } from '@/app/actions/oracleSync'
import { createDraftCardsAction, updateDraftCardAction, publishDraftCardsAction } from '@/app/actions/drafts'

export function BulkIngestionWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [frontImages, setFrontImages] = useState<File[]>([])
  const [backImages, setBackImages] = useState<File[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  
  // Tracking
  const [identifiedCount, setIdentifiedCount] = useState<number>(0)
  const [pricedCount, setPricedCount] = useState<number>(0)
  
  // Step 2 & 3 results
  const [croppedPairs, setCroppedPairs] = useState<{ side_a_url: string, side_b_url: string }[]>([])
  const [identifiedResults, setIdentifiedResults] = useState<any[]>([])
  
  // States for UX
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessingSSE, setIsProcessingSSE] = useState(false)
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [isPricing, setIsPricing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const handleFrontsDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) setFrontImages(Array.from(e.dataTransfer.files))
  }
  const handleBacksDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) setBackImages(Array.from(e.dataTransfer.files))
  }

  const handleUpload = async () => {
    if (frontImages.length === 0 || backImages.length === 0 || frontImages.length !== backImages.length) {
      alert("Please upload an equal number of Fronts and Backs")
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      frontImages.forEach(f => formData.append('fronts', f))
      backImages.forEach(f => formData.append('backs', f))
      
      const returnedJobId = await uploadImagesToScanner(formData)
      setJobId(returnedJobId)
      setStep(2)
      startSSE(returnedJobId)
    } catch (e: any) {
      alert("Upload failed: " + e.message)
    } finally {
      setIsUploading(false)
    }
  }

  const startSSE = (id: string) => {
    setIsProcessingSSE(true)
    // Use our secure Next.js proxy — API key is injected server-side, never exposed
    const eventSource = new EventSource(`/api/scanner/stream/${id}`)
    
    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data)
        const pairs: { side_a_url: string, side_b_url: string }[] = []
        
        const finalCards = Array.isArray(data.cards) ? data.cards : []
        for (const p of finalCards) {
          // Ignore orphans that lack either front or back
          if (p.side_a_url && p.side_b_url) {
            pairs.push({ side_a_url: p.side_a_url, side_b_url: p.side_b_url })
          }
        }
        
        eventSource.close()
        setIsProcessingSSE(false)
        setCroppedPairs(pairs)
        setStep(3)
        runIdentification(pairs, id)
      } catch (e) {
        console.error("Parse error on complete", e)
      }
    })

    eventSource.addEventListener('failed', (event) => {
      try {
        const data = JSON.parse(event.data)
        alert('Worker Failed: ' + data.error)
      } catch {}
      eventSource.close()
      setIsProcessingSSE(false)
    })
    
    eventSource.onerror = () => {
      eventSource.close()
      setIsProcessingSSE(false)
    }
  }

  const runIdentification = async (pairs: {side_a_url: string, side_b_url: string}[], qId: string) => {
    setIsIdentifying(true)
    setIdentifiedCount(0)
    try {
      const results: any[] = []
      
      // Process in chunks of 5 to allow React to paint the progress state and prevent slamming the Next.js server action queue
      for (let i = 0; i < pairs.length; i += 5) {
        const chunk = pairs.slice(i, i + 5)
        const chunkPromises = chunk.map(async pair => {
          try {
            const res = await identifyCardPair({ queue_id: qId, side_a_url: pair.side_a_url, side_b_url: pair.side_b_url })
            const details = res.card_details || {}
            const backMeta = res.back_metadata || {}
            const fallback = res.top_match || {}
            
            setIdentifiedCount(prev => prev + 1)
            
            const iName = details.insert_name || '';
            const pName = details.parallel_type || fallback.parallel_type || backMeta.parallel_type || '';

            return { 
              side_a_url: pair.side_a_url,
              side_b_url: pair.side_b_url,
              player_name: details.player_name || fallback.full_name || backMeta.player_name || '',
              card_set: details.card_set || fallback.base_set_name || backMeta.set_name || '',
              card_number: details.card_number || backMeta.card_number || '',
              insert_name: iName,
              parallel_name: iName === pName ? '' : pName,
              price: 0 
            }
          } catch (e) {
            setIdentifiedCount(prev => prev + 1)
            return { side_a_url: pair.side_a_url, side_b_url: pair.side_b_url, player_name: 'AI Error', card_set: 'AI Error', insert_name: '', parallel_name: '', price: 0 }
          }
        })
        
        const chunkResults = await Promise.all(chunkPromises)
        results.push(...chunkResults)
        
        // Yield to browser to ensure the UI repaints the progress tracker
        await new Promise(r => setTimeout(r, 50))
      }

      // Instantly persist these AI drafts heavily to our Database Table
      const dbDrafts = await createDraftCardsAction(results)
      
      const uiResults = dbDrafts.map((d: any) => ({
        db_id: d.id, // Supabase assigned PK
        side_a_url: d.image_url,
        side_b_url: d.back_image_url,
        player_name: d.player_name,
        card_set: d.card_set,
        card_number: d.card_number || '',
        insert_name: d.insert_name || '',
        parallel_name: d.parallel_name || '',
        price: d.listed_price || 0,
        market_price: d.market_price || 0
      }))

      setIdentifiedResults(uiResults)
      setStep(4)
      // Paused here for user to review and edit BEFORE pricing!
    } catch (e: any) {
      alert('Identification failed')
    } finally {
      setIsIdentifying(false)
    }
  }

  const runPricing = async () => {
    setIsPricing(true)
    setStep(5)
    setPricedCount(0)
    try {
      const results: any[] = []
      
      // Process in chunks of 5 to allow React to paint the pricing progress state
      for (let i = 0; i < identifiedResults.length; i += 5) {
        const chunk = identifiedResults.slice(i, i + 5)
        const chunkPromises = chunk.map(async (r) => {
          try {
            const price = await getSingleOraclePrice({ player_name: r.player_name, card_set: r.card_set, card_number: r.card_number, insert_name: r.insert_name, parallel_name: r.parallel_name })
            const generatedPrice = price || 0
            // Write the DB table immediately with the live pricing
            if (r.db_id) updateDraftCardAction(r.db_id, { price: generatedPrice, market_price: generatedPrice }).catch(console.error)
            
            setPricedCount(prev => prev + 1)
            
            return { ...r, price: generatedPrice, market_price: generatedPrice }
          } catch (e: any) {
            setPricedCount(prev => prev + 1)
            return { ...r, price: 0, market_price: 0 }
          }
        })
        
        const chunkResults = await Promise.all(chunkPromises)
        results.push(...chunkResults)
        
        // Yield to browser to ensure the UI repaints the progress tracker
        await new Promise(res => setTimeout(res, 50))
      }
      
      setIdentifiedResults(results)
      setStep(6)
    } catch (e: any) {
      alert('Pricing failed: ' + e.message)
      setStep(4)
    } finally {
      setIsPricing(false)
    }
  }

  const handleCommit = async () => {
    setIsCommitting(true)
    try {
      const idsToPublish = identifiedResults.map(r => r.db_id).filter(Boolean)
      if (idsToPublish.length > 0) {
        await publishDraftCardsAction(idsToPublish)
      }
      alert("Successfully published directly from drafts to live inventory!")
      // Reset
      setStep(1)
      setFrontImages([])
      setBackImages([])
      setCroppedPairs([])
      setIdentifiedResults([])
      setJobId(null)
    } catch (e: any) {
      alert("Commit failed")
    } finally {
      setIsCommitting(false)
    }
  }

  const updateResultField = (idx: number, field: string, value: string | number) => {
    const next = [...identifiedResults]
    next[idx] = { ...next[idx], [field]: value }
    
    setIdentifiedResults(next)
    
    // DB sync magic: every edit re-writes to the table automatically.
    const dbId = next[idx].db_id
    if (dbId) {
      updateDraftCardAction(dbId, { [field]: value, insert_name: next[idx].insert_name, parallel_name: next[idx].parallel_name, market_price: next[idx].market_price }).catch(console.error)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm border border-indigo-100">
          <Wand2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">AI-Powered Bulk Ingestion Wizard</h2>
          <p className="text-sm font-medium text-slate-500">Vision Crop ➔ Identify ➔ Market Price ➔ Publish</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-10 px-4 sm:px-10 relative">
         <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-slate-200 -z-10 translate-y-[-50%]"></div>
         {[
           { num: 1, label: 'Upload' },
           { num: 2, label: 'Process' },
           { num: 3, label: 'Identify' },
           { num: 4, label: 'Review' },
           { num: 5, label: 'Price' },
           { num: 6, label: 'Mint' }
         ].map(s => (
           <div key={s.num} className="flex flex-col items-center bg-white px-2">
             <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${step >= s.num ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-300'}`}>
               {s.num}
             </div>
             <span className={`text-[9px] sm:text-[10px] mt-2 uppercase tracking-wide font-black ${step >= s.num ? 'text-indigo-900' : 'text-slate-400'}`}>{s.label}</span>
           </div>
         ))}
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Drag Fronts</label>
              <div 
                className={`border-2 border-dashed ${frontImages.length > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-indigo-200 bg-indigo-50/30'} rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors shadow-inner group`}
                onDragOver={e => e.preventDefault()}
                onDrop={handleFrontsDrop}
                onClick={() => document.getElementById('fronts-upload')?.click()}
              >
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:shadow transition flex items-center justify-center mb-3">
                  <Upload className={`w-6 h-6 ${frontImages.length > 0 ? 'text-emerald-500' : 'text-indigo-400'}`} />
                </div>
                <span className={`text-sm font-bold ${frontImages.length > 0 ? 'text-emerald-700' : 'text-indigo-700'}`}>
                   {frontImages.length > 0 ? `${frontImages.length} Front Images Selected` : 'Click or Drop Front Image files'}
                </span>
                <input id="fronts-upload" type="file" multiple accept="image/*" className="hidden" onChange={e => {if(e.target.files) setFrontImages(Array.from(e.target.files))}} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Drag Backs</label>
              <div 
                className={`border-2 border-dashed ${backImages.length > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-indigo-200 bg-indigo-50/30'} rounded-2xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors shadow-inner group`}
                onDragOver={e => e.preventDefault()}
                onDrop={handleBacksDrop}
                onClick={() => document.getElementById('backs-upload')?.click()}
              >
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:shadow transition flex items-center justify-center mb-3">
                  <Upload className={`w-6 h-6 ${backImages.length > 0 ? 'text-emerald-500' : 'text-indigo-400'}`} />
                </div>
                <span className={`text-sm font-bold ${backImages.length > 0 ? 'text-emerald-700' : 'text-indigo-700'}`}>
                   {backImages.length > 0 ? `${backImages.length} Back Images Selected` : 'Click or Drop Back Image files'}
                </span>
                <input id="backs-upload" type="file" multiple accept="image/*" className="hidden" onChange={e => {if(e.target.files) setBackImages(Array.from(e.target.files))}} />
              </div>
            </div>
          </div>
          <button 
            onClick={handleUpload}
            disabled={isUploading || frontImages.length === 0 || backImages.length === 0}
            className="w-full bg-indigo-600 text-white font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-indigo-700 hover:shadow-lg transition flex items-center justify-center gap-3"
          >
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />} Start Vision Pipeline
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-20 animate-pulse">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
          <h3 className="text-3xl font-black text-slate-900 mb-3">Cropping Images SSE</h3>
          <p className="text-slate-500 font-medium text-lg mb-8 bg-slate-100 rounded-full px-6 py-2 w-fit mx-auto border border-slate-200 shadow-inner">
             {croppedPairs.length} of {frontImages.length} pairs cropped via high-performance stream...
          </p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap max-w-4xl mx-auto opacity-70">
             {croppedPairs.map((p, i) => (
                <div key={i} className="w-16 h-20 border-2 border-indigo-200 rounded-lg overflow-hidden relative shadow-md shadow-indigo-100">
                   <img src={p.side_a_url} className="w-full h-full object-cover" />
                </div>
             ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-24 animate-in zoom-in duration-500">
          <Wand2 className="w-20 h-20 animate-bounce text-purple-600 mx-auto mb-6 drop-shadow-xl" />
          <h3 className="text-3xl font-black text-slate-900 mb-3">Vision AI Extraction</h3>
          <p className="text-slate-500 font-medium text-lg mb-6">Querying PlayerIndex multi-modal LLM to identify card sets, inserts, and parallels in parallel...</p>
          <div className="bg-purple-50 text-purple-700 font-black text-2xl py-4 px-8 rounded-full border-2 border-purple-200 inline-block">
             {identifiedCount} / {croppedPairs.length} IDENTIFIED
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-24 animate-in slide-in-from-bottom duration-500">
           <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border-4 border-emerald-50">
              <DollarSign className="w-12 h-12 text-emerald-600 animate-pulse" />
           </div>
           <h3 className="text-3xl font-black text-slate-900 mb-3">The AI Pricing Engine</h3>
           <p className="text-slate-500 font-medium text-lg mb-6">Cross-referencing {identifiedResults.length} assets with live market APIs to acquire real-time projection prices...</p>
           <div className="bg-emerald-50 text-emerald-700 font-black text-2xl py-4 px-8 rounded-full border-2 border-emerald-200 inline-block">
              {pricedCount} / {identifiedResults.length} PRICED
           </div>
        </div>
      )}

      {(step === 4 || step === 6) && (
        <div className="space-y-8 animate-in fade-in duration-700">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-2 pb-2">
            {identifiedResults.map((result, idx) => (
              <div key={idx} className="border border-slate-200 rounded-2xl p-5 flex gap-5 bg-white shadow hover:shadow-lg transition hover:border-indigo-200 group">
                <div className="flex-shrink-0 w-28 flex flex-col gap-3">
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm aspect-[3/4]">
                     <img src={result.side_a_url} className="w-full h-full object-cover" />
                     <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] font-black tracking-widest uppercase py-1 text-center">Front</div>
                  </div>
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm aspect-[3/4]">
                     <img src={result.side_b_url} className="w-full h-full object-cover" />
                     <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] font-black tracking-widest uppercase py-1 text-center">Back</div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Player</label>
                      <input type="text" value={result.player_name || ''} onChange={e => updateResultField(idx, 'player_name', e.target.value)} className="w-full py-2 px-3 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Set</label>
                      <input type="text" value={result.card_set || ''} onChange={e => updateResultField(idx, 'card_set', e.target.value)} className="w-full py-2 px-3 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Card #</label>
                      <input type="text" value={result.card_number || ''} onChange={e => updateResultField(idx, 'card_number', e.target.value)} className="w-full py-2 px-3 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition" placeholder="e.g. US-300" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Insert Name</label>
                      <input type="text" value={result.insert_name || ''} onChange={e => updateResultField(idx, 'insert_name', e.target.value)} className="w-full py-2 px-3 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Parallel Color/Type</label>
                      <input type="text" value={result.parallel_name || ''} onChange={e => updateResultField(idx, 'parallel_name', e.target.value)} className="w-full py-2 px-3 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition" />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex items-center justify-between">
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded">
                       <DollarSign className="w-3 h-3"/> Target Retail $
                    </label>
                    <input type="number" step="0.01" value={result.price || ''} onChange={e => updateResultField(idx, 'price', e.target.value)} className="w-24 px-2 py-1 text-sm font-black text-emerald-700 bg-white border border-emerald-200 rounded shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-right" placeholder="0.00" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {step === 4 ? (
            <button 
              onClick={runPricing}
              className="w-full bg-indigo-600 text-white font-black text-lg py-4 rounded-xl hover:bg-indigo-700 hover:shadow-xl transition-all flex items-center justify-center gap-3 drop-shadow-md"
            >
              <DollarSign className="w-6 h-6" /> FETCH ACCURATE MARKET PRICES
            </button>
          ) : (
            <button 
              onClick={handleCommit}
              disabled={isCommitting}
              className="w-full bg-slate-900 text-white font-black text-lg py-4 rounded-xl disabled:opacity-50 hover:bg-emerald-600 hover:shadow-xl transition-all flex items-center justify-center gap-3 drop-shadow-md border border-slate-800"
            >
              {isCommitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6 text-emerald-400" />} 
              {isCommitting ? 'Injecting into Relational Matrix...' : `MINT ALL ${identifiedResults.length} TO INVENTORY DB`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
