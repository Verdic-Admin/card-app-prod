'use client'

import { useState } from 'react'
import { X, Handshake, Loader2, CheckCircle2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'

export function TradeModal({ isOpen, onClose, cartItems, onSuccess, targetCard }: { isOpen: boolean, onClose: () => void, cartItems: any[], onSuccess: () => void, targetCard?: any }) {
  const { addTradeToCart } = useCart()
  const [form, setForm] = useState({ name: '', email: '', notes: '' })
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tradeSuccess, setTradeSuccess] = useState(false)

  if (!isOpen) return null



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(f => URL.createObjectURL(f));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  }
  
  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  const handleTradeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Pass everything natively to the Shopping Cart explicitly replacing Server dispatches
    const targets = targetCard ? [targetCard] : cartItems;
    
    targets.forEach(target => {
       addTradeToCart(target, {
          name: form.name,
          email: form.email,
          notes: form.notes,
          offerImages: images,
          offerImageUrls: previews
       });
    });
    
    // Clear out base items from standard cart to migrate them wholly to trade items
    // Wait, let's let success callback handle that if needed, since TradeModal just initiates Add to Cart
    
    setImages([]); setPreviews([]); setForm({ name: '', email: '', notes: '' });
    
    setTradeSuccess(true)
    setTimeout(() => {
      setTradeSuccess(false)
      onSuccess()
    }, 2000)
    
    setIsSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden flex items-center justify-center p-4 md:py-10">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-zinc-950 rounded-2xl shadow-2xl flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-200 border border-zinc-800 overflow-hidden">
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-zinc-900 bg-zinc-950/95 backdrop-blur z-20 sticky top-0">
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3 tracking-tight">
            <Handshake className="w-6 h-6 text-cyan-400" /> Propose a Trade
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors focus:ring-2 focus:ring-cyan-500 outline-none">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 md:p-6 overflow-y-auto z-10 custom-scrollbar bg-zinc-950">
          {tradeSuccess ? (
            <div className="text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
              <h3 className="text-2xl font-black text-white mb-2">Offer Binding Successful!</h3>
              <p className="text-zinc-400 font-medium text-lg">The store owner has received your exact trade parameters. We'll be in touch soon.</p>
            </div>
          ) : (
            <form onSubmit={handleTradeSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-black text-zinc-500 ml-1 mb-1 block uppercase tracking-widest">Your Name</label>
                   <input required type="text" placeholder="John Doe" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-3 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-zinc-900 focus:bg-zinc-800 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-zinc-500 ml-1 mb-1 block uppercase tracking-widest">Email Address</label>
                   <input required type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full p-3 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-zinc-900 focus:bg-zinc-800 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="flex items-center justify-between text-sm font-black text-white border-b border-zinc-800 pb-2">
                   Trade Offer Attachment
                   {targetCard ? (
                      <span className="text-xs font-black text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-md tracking-wide border border-cyan-800 flex-shrink-0 ml-2 text-right">Targeting: {targetCard.year} {targetCard.player_name}</span>
                   ) : (
                      <span className="text-[10px] font-black text-cyan-400 bg-cyan-950/50 px-2 py-1 rounded-md tracking-widest uppercase border border-cyan-900/50 whitespace-nowrap ml-2">Targeting {cartItems.length} items</span>
                   )}
                </h4>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                 <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Offer Details / Trade Components</label>
                 <textarea required placeholder="What are you offering? (e.g., '2023 Bowman Chrome Draft Paul Skenes Base for your Ohtani')" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-2.5 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none min-h-[80px] resize-none bg-zinc-900 focus:bg-zinc-800 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
              </div>

              <div>
                 <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Attach Photos (Optional but recommended)</label>
                 <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="w-full text-sm font-medium text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-zinc-800 file:text-cyan-400 hover:file:bg-zinc-700 cursor-pointer border border-zinc-800 rounded-xl bg-zinc-900 transition-colors" />
                 
                 {previews.length > 0 && (
                   <div className="flex gap-3 overflow-x-auto py-3 custom-scrollbar">
                     {previews.map((src, idx) => (
                        <div key={idx} className="relative w-20 h-20 flex-shrink-0 bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden shadow-inner group transition-all">
                           <img src={src} className="w-full h-full object-cover" />
                           <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-3 h-3" />
                           </button>
                        </div>
                     ))}
                   </div>
                 )}
              </div>

              <button disabled={isSubmitting || !form.name || !form.email || !form.notes} type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-black py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 shadow-xl text-lg tracking-wide z-20 sticky bottom-0">
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin text-zinc-950" /> : 'Add Trade to Cart'}
              </button>
            </form>
          )}
        </div>
      </div>
{/* To ensure the inner scroll works perfectly */}
<style dangerouslySetInnerHTML={{__html: `
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #3f3f46; border-radius: 20px; }
`}} />
    </div>
  )
}
