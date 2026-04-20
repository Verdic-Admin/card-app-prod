'use client'

import { useState, useEffect } from 'react'
import { getStoreSettings, updateStoreSettings, DEFAULT_STORE_SETTINGS, StoreSettings } from '@/app/actions/settings'
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getStoreSettings()
        setSettings(data)
      } catch (e: unknown) {
        setSettings({ ...DEFAULT_STORE_SETTINGS })
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setStatusMsg({
          type: 'error',
          text: `Could not load settings from the server (${msg}). Showing defaults — try Save after checking your database connection, or redeploy so init_db.js runs.`,
        })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
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
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto my-10 px-6">
      <div className="mb-8 border-b border-border pb-4">
        <a href="/admin" className="text-brand hover:text-brand-hover text-sm font-bold flex items-center gap-1 mb-2 transition-colors">
            &larr; Back to Dashboard
        </a>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            Global Store Settings
            <InstructionTrigger 
              title="Store Operations Policy"
              steps={[
                 { title: "Discount Percentage", content: "This parameter controls your direct-to-buyer pricing structure. It overrides the specific settings." },
                 { title: "Payment Routing", content: "Leaving payment links blank dynamically hides those options from the checkout funnel. We recommend activating Venmo and CashApp strictly, as PayPal incurs commercial merchant fees." }
              ]}
            />
        </h1>
        <p className="text-sm font-medium text-muted mt-1">Configure checkout thresholds, platform toggles, and payment methods.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8 bg-surface p-8 rounded-2xl shadow-sm border border-border">


        {/* Checkout Settings */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span> 
            Checkout & Payments
          </h3>
          <div className="space-y-6 p-5 bg-surface md:bg-surface-hover border border-border rounded-xl">
             <div className="max-w-xs">
               <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Cart Minimum Spend ($)</label>
               <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60 font-bold">$</span>
                 <input 
                   type="number" 
                   step="0.01"
                   required
                   value={settings.cart_minimum} 
                   onChange={e => setSettings({...settings, cart_minimum: parseFloat(e.target.value) || 0})}
                   className="w-full pl-7 pr-3 py-2.5 bg-surface border border-border md:border-muted/30 rounded-lg text-foreground font-mono font-bold focus:ring-2 focus:ring-brand focus:border-brand outline-none shadow-sm transition-all"
                   placeholder="20.00"
                 />
               </div>
               <p className="text-[10px] text-muted mt-1.5 font-medium">Customers cannot checkout until their total hits this minimum.</p>
             </div>

             <div className="border-t border-border pt-5">
                 <h4 className="text-sm font-bold text-foreground mb-4">Payment Methods Config</h4>
                 <p className="text-xs text-muted mb-4 font-medium">Leave any field entirely blank to hide that payment option from your buyers during checkout.</p>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Venmo Target Link</label>
                        <input type="url" value={settings.payment_venmo || ''} onChange={e => setSettings({...settings, payment_venmo: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://venmo.com/u/..." />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">PayPal Target Link</label>
                        <input type="url" value={settings.payment_paypal || ''} onChange={e => setSettings({...settings, payment_paypal: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://paypal.me/..." />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">CashApp Target Link</label>
                        <input type="url" value={settings.payment_cashapp || ''} onChange={e => setSettings({...settings, payment_cashapp: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://cash.app/$..." />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Zelle Number/Email</label>
                        <input type="text" value={settings.payment_zelle || ''} onChange={e => setSettings({...settings, payment_zelle: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="123-456-7890" />
                     </div>
                 </div>
                 
                 <div className="mt-4">
                     <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Instruction Copy</label>
                     <textarea rows={2} value={settings.payment_instructions || ''} onChange={e => setSettings({...settings, payment_instructions: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="Please put your Name in the payment notes..." />
                 </div>
             </div>
          </div>
        </div>

        {/* Global Features */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span> 
            Platform Features
          </h3>
          <div className="space-y-6 p-5 bg-surface md:bg-surface-hover border border-border rounded-xl">


            <div>
              <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Player Index Undercut Percentage (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1"
                  required
                  value={settings.oracle_discount_percentage} 
                  onChange={e => setSettings({...settings, oracle_discount_percentage: parseFloat(e.target.value) || 0})}
                  className="w-full pl-3 pr-8 py-2.5 bg-surface border border-border md:border-muted/30 rounded-lg text-foreground font-mono font-bold focus:ring-2 focus:ring-brand focus:border-brand outline-none shadow-sm transition-all"
                  placeholder="5.0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/60 font-bold">%</span>
              </div>
              <p className="text-[10px] text-muted mt-1.5 font-medium">How far below the Player Index fair value do you want to auto-price? (e.g., 5 for 5% off).</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface border border-emerald-200/60 rounded-lg shadow-sm">
                <div>
                    <h4 className="text-sm font-bold text-foreground">Accept Trade Offers Platform-wide</h4>
                    <p className="text-xs text-muted mt-0.5">Toggle this completely off to prevent users from submitting any new trade offers while you are on vacation.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={!!settings.allow_offers}
                        onChange={e => setSettings({...settings, allow_offers: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-border md:border-muted/30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
            </div>
          </div>
        </div>



        {/* Submit */}
        <div className="pt-6 border-t border-border flex items-center justify-between">
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
              className="bg-foreground hover:bg-brand text-background font-bold py-3 px-8 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
              Update Settings
            </button>
        </div>
      </form>
    </div>
  )
}
