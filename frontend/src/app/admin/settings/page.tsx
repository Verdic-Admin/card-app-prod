'use client'

import { useState, useEffect } from 'react'
import { getStoreSettings, updateStoreSettings, StoreSettings } from '@/app/actions/settings'
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getStoreSettings()
        setSettings(data)
      } catch (e: any) {
         setStatusMsg({ type: 'error', text: "Failed to load settings! Make sure you ran the Supabase SQL script." })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    
    setIsSaving(true)
    setStatusMsg(null)
    
    try {
      await updateStoreSettings(settings)
      setStatusMsg({ type: 'success', text: 'Settings updated successfully! The store is now enforcing these new rules.' })
      
      // Clear success message after 4 seconds
      setTimeout(() => setStatusMsg(null), 4000)
    } catch (error: any) {
      setStatusMsg({ type: 'error', text: error.message || 'Failed to save settings' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!settings) {
     return (
        <div className="p-8 max-w-2xl mx-auto mt-12 bg-white rounded-xl shadow-sm border border-red-200">
           <h2 className="text-xl font-bold text-red-700 flex items-center gap-2 mb-2"><AlertCircle /> Database Table Missing</h2>
           <p className="text-slate-600">The <code>store_settings</code> table does not exist in your Supabase database yet. Please copy the contents of <code>setup_settings.sql</code> and run it in your Supabase SQL Editor.</p>
        </div>
     )
  }

  return (
    <div className="max-w-3xl mx-auto my-10 px-6">
      <div className="mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Global Store Settings</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Configure checkout thresholds, announcements, and global platform toggles.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200/60">
        
        {/* Checkout Settings */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span> 
            Checkout & Financials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50 border border-slate-100 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Cart Minimum Spend ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={settings.cart_minimum} 
                  onChange={e => setSettings({...settings, cart_minimum: parseFloat(e.target.value) || 0})}
                  className="w-full pl-7 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                  placeholder="20.00"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Customers cannot checkout via PayPal until their cart total hits this exact amount.</p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">PayPal Receiving Email</label>
              <input 
                type="email" 
                required
                value={settings.paypal_email} 
                onChange={e => setSettings({...settings, paypal_email: e.target.value})}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                placeholder="store@gmail.com"
              />
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">The PayPal merchant account where customer payments and trade offers are routed.</p>
            </div>
          </div>
        </div>

        {/* Global Features */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span> 
            Platform Features
          </h3>
          <div className="space-y-6 p-5 bg-slate-50 border border-slate-100 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Site Announcement Banner</label>
              <input 
                type="text" 
                value={settings.site_announcement} 
                onChange={e => setSettings({...settings, site_announcement: e.target.value})}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                placeholder="e.g. Huge holiday sale on all Topps Chrome singles! Free shipping over $50."
              />
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Displays a highly visible banner at the very top of the store. Leave totally blank to hide the banner.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-white border border-emerald-200/60 rounded-lg shadow-sm">
                <div>
                    <h4 className="text-sm font-bold text-slate-900">Accept Trade Offers Platform-wide</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Toggle this completely off to prevent users from submitting any new trade offers while you are on vacation.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.allow_offers}
                        onChange={e => setSettings({...settings, allow_offers: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
            <div>
                {statusMsg && (
                    <div className={`text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-lg ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {statusMsg.text}
                    </div>
                )}
            </div>
            
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-slate-900 hover:bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
              Force Update Settings
            </button>
        </div>
      </form>
    </div>
  )
}
