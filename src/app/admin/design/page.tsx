'use client'

import { useState, useEffect } from 'react'
import { getStoreSettings, updateStoreSettings } from '@/app/actions/settings'
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from '@/lib/store-settings'
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'

export default function DesignPage() {
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
          text: `Could not load settings (${msg}). Showing defaults — try Save or redeploy so init_db.js runs.`,
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
      setStatusMsg({ type: 'success', text: 'Brand and Design updated successfully! The storefront design is now live.' })
      
      // Clear success message after 4 seconds
      setTimeout(() => setStatusMsg(null), 4000)
    } catch (error: any) {
      setStatusMsg({ type: 'error', text: error.message || 'Failed to save design' })
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
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
            <div>
               <a href="/admin" className="text-brand hover:text-brand-hover text-sm font-bold flex items-center gap-1 mb-2 transition-colors">
                  ← Back to Dashboard
               </a>
               <h1 className="text-3xl font-black text-foreground tracking-tight">Brand & Design</h1>
               <p className="text-muted mt-2 font-medium">Configure visuals, themes, layouts, and public descriptions.</p>
               <div className="mt-2 text-left">
                  <InstructionTrigger 
                     title="Theming Engine Rules"
                     steps={[
                        { title: "CSS Variable Architecture", content: "The Edge storefront uses highly optimized CSS variables. Toggling active themes executes live swapping without requiring a hard server rebuild." },
                        { title: "Image Visibility", content: "Make sure all uploaded logos are transparent PNGs or WebP formats, as hard-coded white backgrounds clash aggressively with Dark Mode." }
                     ]}
                  />
               </div>
            </div>
            <div className="bg-brand/10 border border-brand/20 p-3 rounded-lg hidden sm:block">
               <div className="text-xs font-bold text-brand-hover uppercase tracking-wider mb-1">Configuration Status</div>
               <div className="text-sm text-brand flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand/80 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-brand/100"></span>
                  </span>
                  Live & Enforced
               </div>
            </div>
        </div>
        
        <form onSubmit={handleSave} className="space-y-8">
        
        {/* General Identity */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="bg-brand/20 text-brand w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span> 
            Identity Context
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-surface md:bg-surface-hover border border-border rounded-xl">
            <div>
              <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Site Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={settings.site_name}
                onChange={e => setSettings({...settings, site_name: e.target.value})}
                className="w-full px-3 py-2.5 bg-surface border border-border md:border-muted/30 rounded-lg text-foreground font-bold focus:ring-2 focus:ring-brand focus:border-brand outline-none shadow-sm transition-all"
                placeholder="e.g. Into the Gap Sportscards"
              />
              <p className="text-[10px] text-muted mt-1.5 font-medium">Displayed in the Navbar, page titles, and all social share cards.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Author / Subtitle</label>
              <input
                type="text"
                value={settings.site_author ?? ''}
                onChange={e => setSettings({...settings, site_author: e.target.value || null})}
                className="w-full px-3 py-2.5 bg-surface border border-border md:border-muted/30 rounded-lg text-foreground font-medium focus:ring-2 focus:ring-brand focus:border-brand outline-none shadow-sm transition-all"
                placeholder="e.g. by John Doe"
              />
              <p className="text-[10px] text-muted mt-1.5 font-medium">Optional subtitle shown under the site name. Leave blank to hide entirely.</p>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Storefront Global Theme Definition</label>
              <select
                value={settings.site_theme}
                onChange={e => setSettings({...settings, site_theme: e.target.value})}
                className="w-full px-3 py-2.5 bg-surface border border-border md:border-muted/30 rounded-lg text-foreground font-bold focus:ring-2 focus:ring-brand focus:border-brand outline-none shadow-sm transition-all"
              >
                <option value="dark">Dark</option>
                <option value="light">Light (Clean)</option>
                <option value="midnight">Midnight Indigo</option>
                <option value="emerald">Field Green</option>
                <option value="crimson">Ruby Red</option>
                <option value="amber">Amber Sunrise</option>
              </select>
            </div>
          </div>
        </div>

        {/* Global Features */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span> 
            Platform Banners
          </h3>
          <div className="space-y-6 p-5 bg-surface md:bg-surface-hover border border-border rounded-xl">
            <div>
              <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Site Announcement Banner</label>
              <input 
                type="text" 
                value={settings.site_announcement || ''} 
                onChange={e => setSettings({...settings, site_announcement: e.target.value})}
                className="w-full px-3 py-2.5 bg-surface border border-border md:border-muted/30 rounded-lg text-foreground font-medium focus:ring-2 focus:ring-brand focus:border-brand outline-none shadow-sm transition-all"
                placeholder="e.g. Huge holiday sale on all Topps Chrome singles! Free shipping over $50."
              />
              <p className="text-[10px] text-muted mt-1.5 font-medium">Displays a highly visible banner at the very top of the store. Leave totally blank to hide the banner.</p>
            </div>
          </div>
        </div>

        {/* Marketplace Customization */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">3</span> 
            Marketplace Header & Socials
          </h3>
          <div className="space-y-6 p-5 bg-surface md:bg-surface-hover border border-border rounded-xl">
            <div>
              <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Store Description (Hero Text)</label>
              <textarea 
                rows={3}
                value={settings.store_description || ''} 
                onChange={e => setSettings({...settings, store_description: e.target.value})}
                className="w-full px-3 py-2.5 bg-surface border border-border md:border-muted/30 rounded-lg text-foreground font-medium focus:ring-2 focus:ring-brand focus:border-brand outline-none shadow-sm transition-all resize-none"
                placeholder="Prices reflect direct-to-buyer savings..."
              />
              <p className="text-[10px] text-muted mt-1.5 font-medium">This text appears front and center on your main marketplace page.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Instagram URL</label>
                  <input type="url" value={settings.social_instagram || ''} onChange={e => setSettings({...settings, social_instagram: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://instagram.com/..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Twitter/X URL</label>
                  <input type="url" value={settings.social_twitter || ''} onChange={e => setSettings({...settings, social_twitter: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://x.com/..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Facebook URL</label>
                  <input type="url" value={settings.social_facebook || ''} onChange={e => setSettings({...settings, social_facebook: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://facebook.com/..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Discord Server URL</label>
                  <input type="url" value={settings.social_discord || ''} onChange={e => setSettings({...settings, social_discord: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://discord.gg/..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground md:text-muted uppercase tracking-wider mb-2">Threads URL</label>
                  <input type="url" value={settings.social_threads || ''} onChange={e => setSettings({...settings, social_threads: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border md:border-muted/30 rounded-lg text-sm text-foreground focus:ring-2 focus:ring-brand outline-none shadow-sm placeholder:text-muted/40" placeholder="https://threads.net/..." />
                </div>
            </div>
            <p className="text-[10px] text-muted font-medium p-3 bg-surface rounded-lg border border-border">Leave any social link securely blank if you want its icon to automatically hide from the storefront.</p>
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
