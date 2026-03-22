'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/context/CartContext'
import { X, ShoppingCart, Trash2, Handshake, Loader2, CheckCircle2 } from 'lucide-react'
import { generatePayPalCartUrl } from '@/utils/paypal'
import { validateCartCompleteness, submitTradeOffer } from '@/app/actions/trades'
import { TradeModal } from '@/components/TradeModal'
import { StoreSettings } from '@/app/actions/settings'

export function CartDrawer({ settings }: { settings: StoreSettings }) {
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, clearCart, cartTotal, kickItems } = useCart()
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)

  useEffect(() => {
    if (isCartOpen && cartItems.length > 0) {
      const runPreFlight = async () => {
        try {
          const cashItems = cartItems.filter(i => !i.isTradeProposal);
          if (cashItems.length === 0) return;
          const check = await validateCartCompleteness(cashItems.map(i => i.id))
          if (!check.valid) {
            kickItems(check.unavailableIds)
            setCartError("Heads up! Another collector just snagged an item while it was in your cart, but the rest of your stack is ready to go.")
          }
        } catch (e) {
          console.warn("Silent pre-flight validation failed")
        }
      }
      runPreFlight()
    }
  }, [isCartOpen, cartItems])

  if (!isCartOpen) return null

  const handleCheckout = async () => {
    setCartError(null)
    setCheckoutLoading(true)
    try {
      const cashItems = cartItems.filter(i => !i.isTradeProposal);
      const tradeItems = cartItems.filter(i => i.isTradeProposal);

      // Branch 1: Iteratively parse and push all Local Trade states directly to CRM backend
      if (tradeItems.length > 0) {
         for (const trade of tradeItems) {
            if (!trade.tradeDetails) continue;
            
            const data = new FormData();
            data.append('name', trade.tradeDetails.name);
            data.append('email', trade.tradeDetails.email);
            data.append('offer', trade.tradeDetails.notes);
            
            // Clean local cart DOM scopes safely returning the target strictly to Supabase interfaces
            const { cartItemId, isTradeProposal, tradeDetails, ...cleanInventoryItem } = trade;
            data.append('targetItems', JSON.stringify([cleanInventoryItem]));
            
            trade.tradeDetails.offerImages.forEach(file => {
               data.append('images', file);
            });
            
            await submitTradeOffer(data);
         }
      }
      
      // Branch 2: Immediate checkout escape if there is literally 0 financial logic needed
      if (cashItems.length === 0) {
         clearCart();
         setIsCartOpen(false);
         alert("Trade Offers Submitted Successfully! We have received your sealed proposals and will be reviewing them shortly.");
         setCheckoutLoading(false);
         return;
      }
      
      // Branch 3: Standard Stripe/PayPal Escrow Sweeping
      const check = await validateCartCompleteness(cashItems.map(i => i.id))
      
      if (!check.valid) {
        kickItems(check.unavailableIds)
        setCartError("Whoops! Some items in your bundle just sold to a competitive buyer, so we removed them. Please review your updated cart total.")
        setCheckoutLoading(false)
        return
      }

      const url = generatePayPalCartUrl(cashItems.map(i => ({
        itemName: `${i.year} ${i.card_set} ${i.player_name} ${i.parallel_insert_type} ${i.card_number ? `#${i.card_number}` : ''}`.trim().replace(/\s+/g, ' '),
        amount: i.listed_price ?? i.avg_price ?? 0
      })), settings.paypal_email)
      window.location.href = url
    } catch (e: any) {
      setCartError("Failed to actively validate cart availability. Please refresh.")
      setCheckoutLoading(false)
    }
  }



  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setIsCartOpen(false)} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-zinc-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-300 border-l border-zinc-800">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950">
          <h2 className="text-xl font-black flex items-center gap-2 text-white tracking-tight">
            <ShoppingCart className="w-5 h-5 text-cyan-400" /> Your Bundle
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
               <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-inner">
                 <ShoppingCart className="w-10 h-10 text-zinc-700" />
               </div>
               <p className="font-bold tracking-wide">Your bundle staging area is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartError && (
                <div className="p-4 bg-red-950/30 text-red-400 text-sm rounded-xl border border-red-900/50 font-bold shadow-sm">
                  {cartError}
                </div>
              )}
              {cartItems.map(item => (
                <div key={item.cartItemId} className="flex gap-4 p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm relative pr-12 transition-all hover:border-zinc-700">
                  <div className="w-16 h-20 bg-zinc-950 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 relative shadow-inner flex items-center justify-center p-1">
                     <img src={item.image_url!} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col flex-1 py-1 pr-1">
                    <span className="font-extrabold text-sm text-white leading-tight">{item.player_name}</span>
                    <span className="text-xs font-semibold text-zinc-400 mt-0.5 line-clamp-1">{item.year} {item.card_set}</span>
                    <span className="text-[10px] uppercase font-bold text-cyan-500 tracking-widest mt-1">{item.parallel_insert_type}</span>
                    
                    {item.isTradeProposal ? (
                       <span className="mt-auto inline-block">
                          <span className="text-[9px] font-black text-white bg-cyan-700 px-2 py-0.5 rounded uppercase tracking-widest leading-none border border-cyan-500 shadow-sm">Trade Proposal</span>
                       </span>
                    ) : (
                       <span className="font-black text-white mt-auto tracking-tight">${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}</span>
                    )}
                  </div>

                  {item.isTradeProposal && item.tradeDetails && item.tradeDetails.offerImageUrls.length > 0 && (
                     <div className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-70">
                        {item.tradeDetails.offerImageUrls.map((url, idx) => (
                           <div key={idx} className="w-8 h-8 rounded border border-zinc-700 overflow-hidden shadow-inner hidden sm:block">
                              <img src={url} className="w-full h-full object-cover" />
                           </div>
                        ))}
                     </div>
                  )}

                  <button onClick={() => removeFromCart(item.cartItemId!)} className="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-zinc-600 hover:text-red-400 hover:bg-red-950 rounded-xl transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 bg-zinc-950 border-t border-zinc-800 z-20">
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Bundle Total</span>
                  <span className="text-3xl font-black text-white tracking-tighter">${cartTotal.toFixed(2)}</span>
                </div>

                {cartTotal < settings.cart_minimum && (
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                       <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                         <span>Minimum Spend: ${settings.cart_minimum.toFixed(2)}</span>
                         <span className="text-cyan-400 bg-zinc-950 px-2 py-0.5 rounded shadow-sm text-[10px] border border-zinc-800">${(settings.cart_minimum - cartTotal).toFixed(2)} Away</span>
                       </h4>
                       <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800">
                          <div className="bg-cyan-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (cartTotal / settings.cart_minimum) * 100)}%` }}></div>
                       </div>
                       <p className="text-[10px] font-bold text-zinc-500 mt-2">Add more items to unlock secure checkout.</p>
                    </div>
                  </div>
                )}
                
                <button onClick={handleCheckout} disabled={checkoutLoading || cartTotal < settings.cart_minimum} className="w-full bg-[#FFC439] hover:bg-[#F4B82A] text-zinc-950 font-black py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:grayscale text-lg">
                  {checkoutLoading ? <Loader2 className="w-6 h-6 animate-spin"/> : 'Checkout with PayPal'}
                </button>
                
                {settings.allow_offers && (
                  <>
                    <div className="relative flex items-center py-1">
                      <div className="flex-grow border-t border-zinc-800"></div>
                      <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-black uppercase tracking-widest">OR</span>
                      <div className="flex-grow border-t border-zinc-800"></div>
                    </div>

                    <button onClick={() => setIsTradeModalOpen(true)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black tracking-wide py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm text-sm uppercase">
                      <Handshake className="w-5 h-5" /> Propose a Trade
                    </button>
                  </>
                )}
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
