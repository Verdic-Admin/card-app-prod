'use client'

import { useState } from 'react'
import { Loader2, Upload, ScanLine, DollarSign, Save, Image as ImageIcon, RefreshCw, Wand2 } from 'lucide-react'
import { addCardAction } from '@/app/actions/inventory'
import { getSingleOraclePrice } from '@/app/actions/oracleSync'

export function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [isPricing, setIsPricing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    player_name: '',
    card_set: '',
    parallel_insert_type: '',
    card_number: '',
    oracle_price: '',
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

  const handleEvaluateOracle = async () => {
    if (!formData.player_name) return setError('Need card details to evaluate.')
    setIsPricing(true)
    setError('')
    try {
      const price = await getSingleOraclePrice({
        player_name: formData.player_name,
        card_set: formData.card_set,
        insert_name: formData.parallel_insert_type,
        parallel_name: formData.parallel_insert_type
      })
      if (price !== null) {
        setFormData(prev => ({ ...prev, oracle_price: price.toFixed(2) }))
      } else {
        setError('Oracle evaluation returned no comps.')
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with Oracle.')
    } finally {
      setIsPricing(false)
    }
  }

  const handleSave = async () => {
    if (!file) return setError('Missing image')
    setIsSaving(true)
    setError('')
    
    try {
      const data = new FormData()
      data.append('image', file)
      
      const price = parseFloat(formData.oracle_price) || 0
      const payload = {
        ...formData,
        low_price: price,
        high_price: price,
        avg_price: price,
        listed_price: price
      }
      data.append('data', JSON.stringify(payload))
      
      await addCardAction(data)
      
      // Reset
      setFile(null)
      setPreview('')
      setFormData({
        player_name: '', card_set: '', parallel_insert_type: '', card_number: '',
        oracle_price: '',
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
          <div className="col-span-1">
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
          <button onClick={handleEvaluateOracle} disabled={isPricing || !formData.player_name} className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 transition-colors">
            {isPricing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Auto-Price with Oracle
          </button>
        </label>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Target Price ($)</label>
          <input type="text" inputMode="decimal" value={formData.oracle_price} onChange={e => setFormData({...formData, oracle_price: e.target.value})} className="w-full p-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-mono" />
        </div>
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
