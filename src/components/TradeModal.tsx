'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useCart, CartItem, BuiltTradeItem } from '@/context/CartContext'
import { X, Upload, Search, Check, Loader2, Plus, Trash2, Handshake, AlertCircle, HelpCircle } from 'lucide-react'
import { price } from '@/utils/math'

interface TradeModalProps {
  isOpen: boolean
  onClose: () => void
  cartItems: CartItem[]
  onSuccess: () => void
}

const CONTACT_METHODS = ['Email', 'Instagram', 'Twitter (X)', 'Facebook', 'Phone']

export function TradeModal({ isOpen, onClose, cartItems, onSuccess }: TradeModalProps) {
  const { addTradeToCart, setIsCartOpen } = useCart()
  const [name, setName] = useState('')
  const [contactMethod, setContactMethod] = useState('Email')
  const [contactValue, setContactValue] = useState('')
  const [notes, setNotes] = useState('')
  
  const [builtItems, setBuiltItems] = useState<BuiltTradeItem[]>([])
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  // Active form state
  const [activeForm, setActiveForm] = useState({
    playerName: '',
    cardSet: '',
    cardNumber: '',
    insertName: '',
    parallelName: '',
    printRun: '',
    grade: ''
  })
  const [isFetchingComps, setIsFetchingComps] = useState(false)
  const [lastCompFetch, setLastCompFetch] = useState(0)
  const [compError, setCompError] = useState<string | null>(null)
  
  // Comp Results state
  const [compsResult, setCompsResult] = useState<{
    marketPrice: number;
    ebayComps: any[];
    playerIndexUrl: string;
  } | null>(null)

  const [activeImageFile, setActiveImageFile] = useState<File | null>(null)
  const [activeImagePreview, setActiveImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cashItems = cartItems.filter(i => !i.isTradeProposal)
  const targetTotal = cashItems.reduce((sum, item) => sum + price(item.listed_price ?? item.avg_price), 0)
  const offerTotal = builtItems.reduce((sum, item) => sum + item.marketPrice, 0)
  
  const difference = offerTotal - targetTotal
  const diffPercent = targetTotal > 0 ? (difference / targetTotal) * 100 : 0
  
  let statusColor = "text-amber-400" // default yellow
  if (Math.abs(diffPercent) <= 15) {
     statusColor = "text-emerald-400"
  } else if (Math.abs(diffPercent) > 30) {
     statusColor = "text-red-400"
  }

  // Cleanup object URLs on unmount or when removed
  useEffect(() => {
    return () => {
      builtItems.forEach(b => {
        if (b.imagePreviewUrl) URL.revokeObjectURL(b.imagePreviewUrl)
      })
      if (activeImagePreview) URL.revokeObjectURL(activeImagePreview)
    }
  }, [builtItems, activeImagePreview])

  const handleFetchComps = async () => {
    if (!activeForm.playerName || !activeForm.cardSet) {
       setCompError("Player Name and Set are required.")
       return
    }

    const now = Date.now()
    if (now - lastCompFetch < 3000) {
       setCompError("Please wait a few seconds before searching again.")
       return
    }

    setCompError(null)
    setIsFetchingComps(true)
    setLastCompFetch(now)

    try {
       const res = await fetch('/api/trade-comps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             player_name: activeForm.playerName,
             card_set: activeForm.cardSet,
             card_number: activeForm.cardNumber,
             insert_name: activeForm.insertName,
             parallel_name: activeForm.parallelName,
             print_run: activeForm.printRun ? Number(activeForm.printRun) : null,
             grade: activeForm.grade || null
          })
       })

       const data = await res.json()
       if (!data.success) throw new Error(data.error || 'Failed to fetch comps')

       setCompsResult({
          marketPrice: data.market_price,
          ebayComps: data.ebay_comps,
          playerIndexUrl: data.player_index_url
       })
    } catch (e: any) {
       setCompError(e.message)
    } finally {
       setIsFetchingComps(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (activeImagePreview) URL.revokeObjectURL(activeImagePreview)
    setActiveImageFile(file)
    setActiveImagePreview(URL.createObjectURL(file))
  }

  const handleAddBuiltItem = () => {
    if (!compsResult || !activeImageFile) return

    const newItem: BuiltTradeItem = {
       id: Math.random().toString(36).substring(7),
       playerName: activeForm.playerName,
       cardSet: activeForm.cardSet,
       cardNumber: activeForm.cardNumber,
       insertName: activeForm.insertName,
       parallelName: activeForm.parallelName,
       printRun: activeForm.printRun,
       grade: activeForm.grade,
       comps: compsResult.ebayComps,
       marketPrice: compsResult.marketPrice,
       playerIndexUrl: compsResult.playerIndexUrl,
       imageFile: activeImageFile,
       imagePreviewUrl: activeImagePreview || undefined
    }

    setBuiltItems(prev => [...prev, newItem])
    
    // Reset form
    setActiveForm({
      playerName: '',
      cardSet: '',
      cardNumber: '',
      insertName: '',
      parallelName: '',
      printRun: '',
      grade: ''
    })
    setCompsResult(null)
    setActiveImageFile(null)
    setActiveImagePreview(null)
    setCompError(null)
    setIsAddingItem(false)
  }

  const handleRemoveBuiltItem = (id: string) => {
    setBuiltItems(prev => {
       const target = prev.find(i => i.id === id)
       if (target?.imagePreviewUrl) URL.revokeObjectURL(target.imagePreviewUrl)
       return prev.filter(i => i.id !== id)
    })
  }

  const handleQueueTrades = () => {
    // Add trades to cart context for each target item individually, linking the whole offer
    // This allows the user to see them in the cart.
    // Actually, in the old modal, ALL cash items were treated as targets of ONE trade proposal.
    // So we add ONE trade proposal object to the cart, binding the first target item, or we bind all.
    // The previous code did:
    // cartItems.filter(i => !i.isTradeProposal).forEach(target => addTradeToCart(target, { ... }))
    
    cashItems.forEach(target => {
       addTradeToCart(target, {
         name,
         contactMethod,
         contactValue,
         notes,
         builtItems
       })
    })

    onSuccess()
  }

  const canSubmitTrade = name.trim() !== '' && contactValue.trim() !== '' && builtItems.length > 0
  const canAddCard = compsResult !== null && activeImageFile !== null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="bg-background w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
          
          <div className="flex items-center justify-between p-6 border-b border-border bg-surface sticky top-0 z-10">
            <div>
              <h2 className="text-2xl font-black flex items-center gap-2 text-brand">
                <Handshake className="w-6 h-6" /> Trade Proposal
              </h2>
              <p className="text-sm font-bold text-muted mt-1">
                Targeting {cashItems.length} card{cashItems.length !== 1 ? 's' : ''} worth <span className="text-foreground">${targetTotal.toFixed(2)}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors text-muted hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
            
            {/* How it works */}
            <div className="bg-surface-hover border border-border rounded-xl overflow-hidden">
               <button 
                 onClick={() => setShowHowItWorks(!showHowItWorks)}
                 className="w-full flex items-center justify-between p-4 font-bold text-sm text-foreground hover:bg-zinc-800 transition-colors"
               >
                 <span className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-brand"/> How does this work?</span>
                 <span className="text-muted text-xs">{showHowItWorks ? 'Hide' : 'Show'}</span>
               </button>
               {showHowItWorks && (
                 <div className="p-4 pt-0 text-sm text-muted space-y-2 leading-relaxed">
                    <p>1. Add the cards you want to trade by tapping <strong>Add Trade Item</strong>.</p>
                    <p>2. Fill in the card details and tap <strong>Get Comps</strong> to pull real-time eBay sold data. We use this to standardize trade value.</p>
                    <p>3. Upload a <strong>Coined Photo</strong> (a photo of your card next to a piece of paper with your name and today's date).</p>
                    <p>4. Add as many cards as you need to reach the target value. When both parties agree the values are close enough, the trade is finalized!</p>
                 </div>
               )}
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-muted tracking-widest pl-1">Your Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="John Doe"
                  className="w-full bg-surface border border-border rounded-lg p-3 text-foreground focus:border-brand outline-none transition-colors" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-muted tracking-widest pl-1">Contact Method</label>
                <div className="flex gap-2">
                  <select 
                    value={contactMethod} 
                    onChange={e => setContactMethod(e.target.value)}
                    className="bg-surface border border-border rounded-lg p-3 text-foreground focus:border-brand outline-none cursor-pointer"
                  >
                    {CONTACT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input 
                    type="text" 
                    value={contactValue} 
                    onChange={e => setContactValue(e.target.value)} 
                    placeholder={contactMethod === 'Email' ? 'name@example.com' : contactMethod === 'Phone' ? '(555) 555-5555' : '@handle'}
                    className="flex-1 bg-surface border border-border rounded-lg p-3 text-foreground focus:border-brand outline-none transition-colors" 
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-foreground">Your Offer</h3>
                <div className="text-right">
                   <div className="text-xs font-black uppercase text-muted tracking-widest">Total Value</div>
                   <div className={`text-xl font-black ${statusColor}`}>${offerTotal.toFixed(2)}</div>
                </div>
              </div>

              {/* Built Items List */}
              {builtItems.length > 0 && (
                <div className="space-y-3">
                   {builtItems.map((item) => (
                      <div key={item.id} className="flex gap-4 p-3 bg-surface rounded-xl border border-border relative pr-12">
                         <div className="w-16 h-16 bg-background rounded-lg overflow-hidden flex-shrink-0 border border-border">
                            {item.imagePreviewUrl ? (
                              <img src={item.imagePreviewUrl} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted"><Upload className="w-6 h-6"/></div>
                            )}
                         </div>
                         <div className="flex flex-col justify-center">
                            <span className="font-bold text-foreground leading-tight">{item.playerName}</span>
                            <span className="text-xs text-muted mt-0.5">{item.cardSet} {item.cardNumber}</span>
                            <span className="text-brand font-black mt-1">${item.marketPrice.toFixed(2)}</span>
                         </div>
                         <button onClick={() => handleRemoveBuiltItem(item.id)} className="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-muted hover:text-red-400 hover:bg-red-950 rounded-xl transition-colors">
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                   ))}
                </div>
              )}

              {/* Add Trade Item Form or Button */}
              {!isAddingItem ? (
                 <button 
                   onClick={() => setIsAddingItem(true)}
                   className="w-full py-4 rounded-xl border-2 border-dashed border-border hover:border-brand/50 hover:bg-brand/5 text-muted hover:text-brand font-black transition-all flex items-center justify-center gap-2"
                 >
                   <Plus className="w-5 h-5" /> Add Trade Item
                 </button>
              ) : (
                 <div className="bg-surface border border-brand/30 rounded-xl p-4 sm:p-5 shadow-inner space-y-5 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                       <h4 className="font-black text-brand tracking-tight">New Trade Item</h4>
                       <button onClick={() => { setIsAddingItem(false); setCompsResult(null); }} className="text-muted hover:text-foreground text-xs font-bold underline underline-offset-2">Cancel</button>
                    </div>

                    {/* Card Fields */}
                    <div className="grid grid-cols-2 gap-3">
                       <div className="col-span-2 sm:col-span-1 space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">Player Name *</label>
                          <input type="text" value={activeForm.playerName} onChange={e => setActiveForm({...activeForm, playerName: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-foreground outline-none focus:border-brand" placeholder="e.g. Tom Brady" />
                       </div>
                       <div className="col-span-2 sm:col-span-1 space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">Card Set *</label>
                          <input type="text" value={activeForm.cardSet} onChange={e => setActiveForm({...activeForm, cardSet: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-foreground outline-none focus:border-brand" placeholder="e.g. 2000 Bowman Chrome" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">Card #</label>
                          <input type="text" value={activeForm.cardNumber} onChange={e => setActiveForm({...activeForm, cardNumber: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-foreground outline-none focus:border-brand" placeholder="e.g. 236" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">Grade</label>
                          <input type="text" value={activeForm.grade} onChange={e => setActiveForm({...activeForm, grade: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-foreground outline-none focus:border-brand" placeholder="e.g. PSA 10" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">Parallel</label>
                          <input type="text" value={activeForm.parallelName} onChange={e => setActiveForm({...activeForm, parallelName: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-foreground outline-none focus:border-brand" placeholder="e.g. Refractor" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">Print Run</label>
                          <input type="number" value={activeForm.printRun} onChange={e => setActiveForm({...activeForm, printRun: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-foreground outline-none focus:border-brand" placeholder="e.g. /99" />
                       </div>
                    </div>

                    {/* Get Comps */}
                    {!compsResult ? (
                       <div className="pt-2">
                          {compError && <p className="text-red-400 text-xs font-bold mb-2 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {compError}</p>}
                          <button 
                            onClick={handleFetchComps}
                            disabled={isFetchingComps || !activeForm.playerName || !activeForm.cardSet}
                            className="w-full bg-brand/20 text-brand hover:bg-brand hover:text-white border border-brand/50 font-black py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
                          >
                             {isFetchingComps ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Search className="w-4 h-4"/> Get Comps</>}
                          </button>
                       </div>
                    ) : (
                       <div className="space-y-4 pt-2 border-t border-border animate-in fade-in">
                          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4">
                             <div className="flex justify-between items-center mb-3">
                                <span className="text-emerald-400 font-black">Trade Value Derived</span>
                                <span className="text-xl font-black text-emerald-300">${compsResult.marketPrice.toFixed(2)}</span>
                             </div>
                             
                             <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-emerald-500/80 tracking-widest">Recent Sales</p>
                                {compsResult.ebayComps.slice(0, 3).map((comp: any, idx: number) => (
                                   <a key={idx} href={comp.url} target="_blank" rel="noopener noreferrer" className="flex justify-between items-center bg-black/40 p-2 rounded text-xs hover:bg-black/60 transition-colors border border-emerald-900/30">
                                      <span className="text-emerald-100/70 truncate mr-4">{comp.title || 'eBay Listing'}</span>
                                      <span className="text-emerald-300 font-mono font-bold">${comp.price.toFixed(2)}</span>
                                   </a>
                                ))}
                                {compsResult.ebayComps.length === 0 && (
                                   <p className="text-emerald-200/50 text-xs italic">No direct comps found. Valuation uses Oracle AI projection.</p>
                                )}
                             </div>
                             {compsResult.playerIndexUrl && (
                                <div className="mt-3 text-right">
                                   <a href={compsResult.playerIndexUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-black tracking-wider uppercase underline underline-offset-2">
                                      Powered by Player Index ↗
                                   </a>
                                </div>
                             )}
                          </div>

                          {/* Coined Photo Upload */}
                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-muted tracking-widest pl-1">Attach Coined Photo *</label>
                             <p className="text-xs text-muted/80 pl-1 mb-2 leading-tight">Must include the card next to a piece of paper with your name and today's date.</p>
                             
                             {activeImagePreview ? (
                                <div className="relative w-full h-32 bg-black rounded-lg border border-border overflow-hidden group">
                                   <img src={activeImagePreview} className="w-full h-full object-contain" />
                                   <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => fileInputRef.current?.click()} className="bg-surface hover:bg-surface-hover text-foreground text-xs font-bold py-1.5 px-3 rounded shadow-sm">Replace Image</button>
                                   </div>
                                </div>
                             ) : (
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full h-24 border-2 border-dashed border-border hover:border-brand/50 bg-background hover:bg-brand/5 rounded-lg flex flex-col items-center justify-center gap-1 text-muted hover:text-brand transition-colors"
                                >
                                   <Upload className="w-5 h-5 mb-1" />
                                   <span className="text-sm font-bold">Tap to upload photo</span>
                                </button>
                             )}
                             <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                          </div>

                          <button 
                            onClick={handleAddBuiltItem}
                            disabled={!canAddCard}
                            className="w-full bg-brand hover:bg-brand-hover text-white font-black py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm mt-2 shadow-md"
                          >
                             <Check className="w-5 h-5"/> Add This Card
                          </button>
                       </div>
                    )}
                 </div>
              )}
            </div>

            <div className="space-y-1.5">
               <label className="text-xs font-black uppercase text-muted tracking-widest pl-1">Optional Message</label>
               <textarea 
                 value={notes} 
                 onChange={e => setNotes(e.target.value)} 
                 placeholder="Any extra context for the store owner?"
                 className="w-full bg-surface border border-border rounded-lg p-3 text-foreground focus:border-brand outline-none transition-colors h-20 resize-none text-sm" 
               />
            </div>
          </div>

          <div className="p-5 border-t border-border bg-surface-hover mt-auto">
            <button 
              onClick={handleQueueTrades}
              disabled={!canSubmitTrade}
              className="w-full bg-brand hover:bg-brand-hover text-white font-black py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-[15px]"
            >
              Queue Trade Request
            </button>
            <p className="text-[10px] text-center text-muted mt-3 font-medium uppercase tracking-widest">Offers are reviewed by store admins before approval.</p>
          </div>

        </div>
      </div>
    </div>
  )
}
