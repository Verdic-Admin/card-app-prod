'use client'

import { useState } from 'react'
import { X, Handshake, Loader2, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { submitTradeOffer } from '@/app/actions/trades'

type CardOffer = {
  id: string;
  player: string;
  year: string;
  set: string;
  variation: string;
  isAutographed: boolean;
  autoType: 'sticker' | 'on_card' | null;
  isNumbered: boolean;
  printRun: string;
}

export function TradeModal({ isOpen, onClose, cartItems, onSuccess }: { isOpen: boolean, onClose: () => void, cartItems: any[], onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', notes: '' })
  
  const [cards, setCards] = useState<CardOffer[]>([{
    id: 'initial',
    player: '', year: '', set: '', variation: '',
    isAutographed: false, autoType: null,
    isNumbered: false, printRun: ''
  }])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tradeSuccess, setTradeSuccess] = useState(false)

  if (!isOpen) return null

  const updateCard = (id: string, field: keyof CardOffer, value: any) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const addCard = () => {
    setCards([...cards, {
      id: Date.now().toString() + Math.random(),
      player: '', year: '', set: '', variation: '',
      isAutographed: false, autoType: null,
      isNumbered: false, printRun: ''
    }])
  }

  const removeCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(c => c.id !== id))
    }
  }

  const handleTradeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const eForm = e.currentTarget
      const data = new FormData()
      data.append('name', form.name)
      data.append('email', form.email)
      
      let cardsString = cards.map((c, i) => {
         let autoString = c.isAutographed ? `\n   Autograph: Yes (${c.autoType === 'sticker' ? 'Sticker' : c.autoType === 'on_card' ? 'On-Card' : 'Unknown'})` : ''
         let numberedString = c.isNumbered ? `\n   Numbered: Yes (${c.printRun})` : ''
         return `Card ${i + 1}:\n   Player: ${c.player}\n   Year: ${c.year}\n   Set: ${c.set}\n   Variation: ${c.variation}${autoString}${numberedString}`
      }).join('\n\n')
      
      const combinedOffer = `${cardsString}\n\nAdditional Notes: ${form.notes}`
      
      data.append('offer', combinedOffer)
      data.append('targetItems', JSON.stringify(cartItems))
      
      const fileInput = eForm.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput?.files?.[0]) {
        data.append('image', fileInput.files[0])
      }

      await submitTradeOffer(data)
      setTradeSuccess(true)
      
      setTimeout(() => {
        setTradeSuccess(false)
        onSuccess()
      }, 4000)
    } catch (err) {
      alert("Store Server rejected trade offer. Network connection failed.")
    } finally {
      setIsSubmitting(false)
    }
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
                   Cards You Are Offering
                   <span className="text-[10px] font-black text-cyan-400 bg-cyan-950/50 px-2 py-1 rounded-md tracking-widest uppercase border border-cyan-900/50">Targeting {cartItems.length} items</span>
                </h4>

                {cards.map((card, index) => (
                  <div key={card.id} className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl relative animate-in fade-in slide-in-from-bottom-2 duration-300">
                     {cards.length > 1 && (
                        <button type="button" onClick={() => removeCard(card.id)} className="absolute top-4 right-4 text-zinc-500 hover:text-red-400 hover:bg-red-950 p-1.5 rounded-lg transition-colors">
                           <Trash2 className="w-4 h-4" />
                        </button>
                     )}
                     
                     <h5 className="text-[10px] font-black text-cyan-500/80 uppercase tracking-widest mb-3">Incoming Card #{index + 1}</h5>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="md:col-span-2">
                          <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Player Name</label>
                          <input required type="text" placeholder="e.g. Shohei Ohtani" value={card.player} onChange={e => updateCard(card.id, 'player', e.target.value)} className="w-full p-2.5 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-zinc-950 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
                       </div>
                       <div>
                          <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Year</label>
                          <input required type="text" placeholder="e.g. 2018" value={card.year} onChange={e => updateCard(card.id, 'year', e.target.value)} className="w-full p-2.5 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-zinc-950 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
                       </div>
                       <div>
                          <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Set</label>
                          <input required type="text" placeholder="e.g. Topps Chrome" value={card.set} onChange={e => updateCard(card.id, 'set', e.target.value)} className="w-full p-2.5 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-zinc-950 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
                       </div>
                       <div className="md:col-span-2">
                          <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Card Variation</label>
                          <input required type="text" placeholder="e.g. Base, Refractor, Gold, etc." value={card.variation} onChange={e => updateCard(card.id, 'variation', e.target.value)} className="w-full p-2.5 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-zinc-950 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
                       </div>
                     </div>

                     <div className="pt-4 mt-3 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer group w-max">
                                <input type="checkbox" checked={card.isAutographed} onChange={e => { updateCard(card.id, 'isAutographed', e.target.checked); if(!e.target.checked) updateCard(card.id, 'autoType', null); }} className="w-5 h-5 text-cyan-500 rounded border-zinc-700 bg-zinc-950 focus:ring-cyan-500 focus:ring-offset-zinc-900 cursor-pointer" />
                                <span className="text-sm font-bold text-white select-none">Autographed</span>
                            </label>
                            {card.isAutographed && (
                                <div className="flex items-center gap-4 pl-8 animate-in fade-in slide-in-from-top-2 duration-200">
                                   <label className="flex items-center gap-2 cursor-pointer group">
                                      <input type="radio" value="sticker" checked={card.autoType === 'sticker'} onChange={() => updateCard(card.id, 'autoType', 'sticker')} className="w-4 h-4 text-cyan-500 border-zinc-700 bg-zinc-950 focus:ring-cyan-500 focus:ring-offset-zinc-900 cursor-pointer" />
                                      <span className="text-xs font-bold text-zinc-400 select-none group-hover:text-cyan-400 transition-colors">Sticker</span>
                                   </label>
                                   <label className="flex items-center gap-2 cursor-pointer group">
                                      <input type="radio" value="on_card" checked={card.autoType === 'on_card'} onChange={() => updateCard(card.id, 'autoType', 'on_card')} className="w-4 h-4 text-cyan-500 border-zinc-700 bg-zinc-950 focus:ring-cyan-500 focus:ring-offset-zinc-900 cursor-pointer" />
                                      <span className="text-xs font-bold text-zinc-400 select-none group-hover:text-cyan-400 transition-colors">On-Card</span>
                                   </label>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer group w-max">
                                <input type="checkbox" checked={card.isNumbered} onChange={e => { updateCard(card.id, 'isNumbered', e.target.checked); if(!e.target.checked) updateCard(card.id, 'printRun', ''); }} className="w-5 h-5 text-cyan-500 rounded border-zinc-700 bg-zinc-950 focus:ring-cyan-500 focus:ring-offset-zinc-900 cursor-pointer" />
                                <span className="text-sm font-bold text-white select-none">Numbered</span>
                            </label>
                            {card.isNumbered && (
                                <div className="pl-8 animate-in fade-in slide-in-from-top-2 duration-200">
                                   <input type="text" placeholder="e.g. 1/10" value={card.printRun} onChange={e => updateCard(card.id, 'printRun', e.target.value)} className="w-32 p-1.5 text-xs font-bold border border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none shadow-inner transition-colors text-center" />
                                </div>
                            )}
                        </div>
                     </div>
                  </div>
                ))}

                <button type="button" onClick={addCard} className="w-full border-2 border-dashed border-zinc-800 hover:border-cyan-800 hover:bg-cyan-950/20 rounded-2xl p-4 text-sm font-bold text-zinc-500 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2">
                   <Plus className="w-5 h-5" /> Add Another Card to Trade
                </button>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                 <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Additional Notes / Flaws</label>
                 <textarea placeholder="Any specific issues like centering or soft corners?" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-2.5 text-sm font-medium border border-zinc-800 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none min-h-[80px] resize-none bg-zinc-900 focus:bg-zinc-800 text-white placeholder:text-zinc-600 transition-colors shadow-inner" />
              </div>

              <div>
                 <label className="text-xs font-bold text-zinc-500 ml-1 mb-1 block">Attach Group Photo (Optional)</label>
                 <input type="file" accept="image/*" className="w-full text-sm font-medium text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-zinc-800 file:text-cyan-400 hover:file:bg-zinc-700 cursor-pointer border border-zinc-800 rounded-xl bg-zinc-900 transition-colors" />
              </div>

              <button disabled={isSubmitting} type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-black py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 shadow-xl text-lg tracking-wide z-20 sticky bottom-0">
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin text-zinc-950" /> : 'Lock In Binding Offer'}
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
