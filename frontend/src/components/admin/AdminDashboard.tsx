'use client'

import { useState } from 'react'
import { Loader2, Upload, ScanLine, DollarSign, Save, Image as ImageIcon } from 'lucide-react'
import { addCardAction } from '@/app/actions/inventory'

export function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [isPricing, setIsPricing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    player_name: '',
    year: '',
    card_set: '',
    parallel_insert_type: '',
    card_number: '',
    comp1: '',
    comp2: '',
    comp3: '',
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
      setError('')
    }
  }

  const handleScan = async () => {
    if (!file) return setError('Please upload an image first.')
    setIsScanning(true)
    setError('')
    
    try {
      const data = new FormData()
      data.append('image', file)
      
      const res = await fetch('/api/scan', { method: 'POST', body: data })
      if (!res.ok) throw new Error('AI Scan failed')
      
      const json = await res.json()
      setFormData(prev => ({
        ...prev,
        player_name: json.player_name || '',
        year: json.year || '',
        card_set: json.card_set || '',
        parallel_insert_type: json.parallel_insert_type || '',
        card_number: json.card_number || '',
      }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsScanning(false)
    }
  }

  const handleFetchPricing = () => {
    if (!formData.player_name) return setError('Need card details to search eBay.')
    setError('')
    
    const searchString = `${formData.year} ${formData.card_set} ${formData.player_name} ${formData.parallel_insert_type} ${formData.card_number}`.trim().replace(/\s+/g, '+')
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${searchString}&LH_Sold=1&LH_Complete=1`
    
    // Passing window dimensions forces modern browsers to spawn a physical new window instead of a tab
    window.open(ebayUrl, '_blank', 'width=1100,height=800,left=100,top=100')
  }

  const getPrices = () => {
    const prices = [parseFloat(formData.comp1), parseFloat(formData.comp2), parseFloat(formData.comp3)].filter(p => !isNaN(p) && p > 0)
    if (prices.length === 0) return { high: 0, low: 0, avg: 0 }
    return {
      high: Math.max(...prices),
      low: Math.min(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length
    }
  }

  const handleSave = async () => {
    if (!file) return setError('Missing image')
    setIsSaving(true)
    setError('')
    
    try {
      const data = new FormData()
      data.append('image', file)
      
      const { high, low, avg } = getPrices()
      const payload = {
        ...formData,
        low_price: low,
        high_price: high,
        avg_price: avg,
      }
      data.append('data', JSON.stringify(payload))
      
      await addCardAction(data)
      
      // Reset
      setFile(null)
      setPreview('')
      setFormData({
        player_name: '', year: '', card_set: '', parallel_insert_type: '', card_number: '',
        comp1: '', comp2: '', comp3: '',
      })
      alert('Card saved successfully!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
      <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <ScanLine className="h-5 w-5 text-indigo-600" />
        Ingestion Wizard
      </h2>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      {/* Step 1: Upload & Scan */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-2">1. Upload Image</label>
        <div className="flex gap-4 items-start">
          <div className="flex-grow">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-slate-400" />
                <p className="text-sm text-slate-500 font-medium">Click to upload card</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
            {file && (
              <button 
                onClick={handleScan} disabled={isScanning}
                className="mt-3 w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2"
              >
                {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                Auto-Scan with AI
              </button>
            )}
          </div>
          {preview ? (
            <div className="w-24 h-32 relative rounded-lg overflow-hidden border border-slate-200 shadow-sm flex-shrink-0 bg-slate-100">
              <img src={preview} alt="Preview" className="w-full h-full object-contain" />
            </div>
          ) : (
             <div className="w-24 h-32 relative rounded-lg border border-slate-200 border-dashed flex items-center justify-center flex-shrink-0 bg-slate-50">
               <ImageIcon className="h-6 w-6 text-slate-300" />
             </div>
          )}
        </div>
      </div>

      {/* Step 2: Form */}
      <div className="mb-8 space-y-4">
        <label className="block text-sm font-semibold text-slate-700">2. Verify Details</label>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Player Name</label>
            <input type="text" value={formData.player_name} onChange={e => setFormData({...formData, player_name: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
            <input type="text" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Card Set</label>
            <input type="text" value={formData.card_set} onChange={e => setFormData({...formData, card_set: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Parallel / Insert</label>
            <input type="text" value={formData.parallel_insert_type} onChange={e => setFormData({...formData, parallel_insert_type: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Card Number/ID</label>
            <input type="text" value={formData.card_number} onChange={e => setFormData({...formData, card_number: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400" />
          </div>
        </div>
      </div>

      {/* Step 3: Pricing */}
      <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center justify-between">
          3. Determine Value
          <button onClick={handleFetchPricing} disabled={!formData.player_name} className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-md hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 transition-colors">
            <DollarSign className="h-3 w-3" />
            View eBay Comps
          </button>
        </label>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Comp 1 ($)</label>
            <input type="text" inputMode="decimal" value={formData.comp1} onChange={e => setFormData({...formData, comp1: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Comp 2 ($)</label>
            <input type="text" inputMode="decimal" value={formData.comp2} onChange={e => setFormData({...formData, comp2: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Comp 3 ($)</label>
            <input type="text" inputMode="decimal" value={formData.comp3} onChange={e => setFormData({...formData, comp3: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-mono" />
          </div>
        </div>

        {(() => {
           const { high, low, avg } = getPrices();
           return (
             <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <div className="flex flex-col">
                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Low</span>
                  <span className="font-bold font-mono text-sm text-indigo-900">${low.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">High</span>
                  <span className="font-bold font-mono text-sm text-indigo-900">${high.toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Average</span>
                  <span className="font-black font-mono text-xl text-indigo-900 bg-white px-2 py-0.5 rounded shadow-sm border border-indigo-100">${avg.toFixed(2)}</span>
                </div>
             </div>
           )
        })()}
      </div>

      {/* Step 4: Save */}
      <button 
        onClick={handleSave} 
        disabled={isSaving || !file || !formData.player_name}
        className="mt-auto w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-sm"
      >
        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Save to Inventory
      </button>
    </div>
  )
}
