'use client'

import { useState } from 'react'
import { useCart } from '@/context/CartContext'
import { X, ShoppingCart, Trash2, Handshake, Loader2, CheckCircle2 } from 'lucide-react'
import { generatePayPalCartUrl } from '@/utils/paypal'
import { validateCartCompleteness } from '@/app/actions/trades'
import { TradeModal } from '@/components/TradeModal'

export function CartDrawer() {
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, clearCart, cartTotal, kickItems } = useCart()
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)

  if (!isCartOpen) return null

  const handleCheckout = async () => {
    setCartError(null)
    setCheckoutLoading(true)
    try {
      // User-requested Pre-Flight check directly inside the payment trigger
      const check = await validateCartCompleteness(cartItems.map(i => i.id))
      
      if (!check.valid) {
        kickItems(check.unavailableIds)
        setCartError("Whoops! Some items in your bundle just sold to a competitive buyer, so we removed them. Please review your updated cart total.")
        setCheckoutLoading(false)
        return
      }

      // Automatically construct mass PayPal URL mappings
      const url = generatePayPalCartUrl(cartItems.map(i => ({
        itemName: `${i.year} ${i.card_set} ${i.player_name} ${i.parallel_insert_type} ${i.card_number ? `#${i.card_number}` : ''}`.trim().replace(/\s+/g, ' '),
        amount: i.listed_price ?? i.avg_price ?? 0
      })))
      window.location.href = url
    } catch (e: any) {
      setCartError("Failed to actively validate cart availability. Please refresh.")
      setCheckoutLoading(false)
    }
  }



  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-slate-50 shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 tracking-tight">
            <ShoppingCart className="w-5 h-5 text-indigo-600" /> Your Bundle
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
               <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                 <ShoppingCart className="w-10 h-10 text-slate-300" />
               </div>
               <p className="font-bold">Your bundle staging area is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartError && (
                <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 font-bold shadow-sm">
                  {cartError}
                </div>
              )}
              {cartItems.map(item => (
                <div key={item.id} className="flex gap-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm relative pr-12 transition-all hover:border-slate-300">
                  <div className="w-16 h-20 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100 relative">
                     <img src={item.image_url!} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col flex-1 py-1 pr-1">
                    <span className="font-bold text-sm text-slate-900 leading-tight">{item.player_name}</span>
                    <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.year} {item.card_set}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">{item.parallel_insert_type}</span>
                    <span className="font-mono font-black text-slate-900 mt-auto">${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}</span>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.05)] z-20">
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-sm">Bundle Total</span>
                  <span className="text-3xl font-black text-slate-900 tracking-tight">${cartTotal.toFixed(2)}</span>
                </div>

                {cartTotal < 20 && (
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                       <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                         <span>Minimum Spend: $20.00</span>
                         <span className="text-indigo-600 bg-white px-1.5 py-0.5 rounded shadow-sm text-[10px]">${(20 - cartTotal).toFixed(2)} Away</span>
                       </h4>
                       <div className="w-full bg-indigo-200/50 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (cartTotal / 20) * 100)}%` }}></div>
                       </div>
                       <p className="text-[10px] font-medium text-indigo-700 mt-2">Add more items to unlock secure checkout.</p>
                    </div>
                  </div>
                )}
                
                <button onClick={handleCheckout} disabled={checkoutLoading || cartTotal < 20} className="w-full bg-[#FFC439] hover:bg-[#F4B82A] text-slate-900 font-black py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:grayscale text-lg">
                  {checkoutLoading ? <Loader2 className="w-6 h-6 animate-spin"/> : 'Checkout with PayPal'}
                </button>
                
                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">OR</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button onClick={() => setIsTradeModalOpen(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm text-lg">
                  <Handshake className="w-6 h-6" /> Propose a Trade
                </button>
              </div>
          </div>
        )}
      </div>

      <TradeModal 
        isOpen={isTradeModalOpen} 
        onClose={() => setIsTradeModalOpen(false)} 
        cartItems={cartItems} 
        onSuccess={() => {
          clearCart()
          setIsCartOpen(false)
          setIsTradeModalOpen(false)
        }} 
      />
    </div>
  )
}
