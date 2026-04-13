'use client'

import { useState } from 'react'
import { useCart } from '@/context/CartContext'
import { Database } from '@/types/database.types'
import { submitCoinRequest } from '@/app/actions/coins'
import { Camera, X, Loader2 } from 'lucide-react'

type InventoryItem = Database['public']['Tables']['inventory']['Row']

interface Props {
  item: InventoryItem
}

export function ItemDetailClient({ item }: Props) {
  const { addToCart, cartItems } = useCart()
  const isInCart = cartItems.some(i => i.id === item.id)
  const isAvailable = item.status === 'available'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isAvailable) {
    return (
      <div className="w-full text-center py-4 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-500 font-black uppercase tracking-widest text-sm">
        Sold
      </div>
    )
  }

  const handleCoinRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setIsSubmitting(true)
    try {
      await submitCoinRequest(item.id, email)
      setSuccess(true)
      setTimeout(() => setIsModalOpen(false), 2000)
    } catch {
      alert("Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center -mb-1 mt-1">
          <a href="https://playerindexdata.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold tracking-wide">
            As priced by PlayerIndexData.com
          </a>
        </div>
        <button
          onClick={() => addToCart(item)}
          disabled={isInCart}
          className={`w-full py-4 rounded-xl font-black text-base uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] ${
            isInCart
              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900 cursor-default'
              : 'bg-white hover:bg-cyan-500 hover:text-white text-zinc-950 border border-zinc-200 hover:border-cyan-500'
          }`}
        >
          {isInCart ? '✓ In Cart' : (item.is_lot ? '📦 Add Lot to Cart' : 'Add to Cart')}
        </button>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all text-zinc-400 border border-zinc-700 hover:text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" />
          Request Coined Photo
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full shadow-2xl relative">
             <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors">
               <X className="w-5 h-5"/>
             </button>
             <h3 className="text-xl font-black text-white mb-2">Request Coined Photo</h3>
             <p className="text-zinc-400 text-sm mb-6">
               Enter your email below. I will personally take a new, timestamped photo of this exact card and upload it to this page within 24 hours to prove ownership and condition.
             </p>
             
             {success ? (
               <div className="bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 font-bold p-4 rounded-lg text-center">
                 Request Sent! Check back soon.
               </div>
             ) : (
               <form onSubmit={handleCoinRequest} className="flex flex-col gap-4">
                 <input 
                   type="email" 
                   required
                   value={email}
                   onChange={e => setEmail(e.target.value)}
                   className="bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                   placeholder="your@email.com"
                 />
                 <button 
                   type="submit"
                   disabled={isSubmitting}
                   className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black px-4 py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                 >
                   {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Request'}
                 </button>
               </form>
             )}
           </div>
        </div>
      )}
    </>
  )
}
