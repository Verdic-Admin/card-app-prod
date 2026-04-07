'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/context/CartContext'
import { X, ShoppingCart, Trash2, Handshake, Loader2, CheckCircle2 } from 'lucide-react'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { createPayPalOrder, capturePayPalOrder } from '@/app/actions/checkout'
import { validateCartCompleteness, submitTradeOffer } from '@/app/actions/trades'
import { TradeModal } from '@/components/TradeModal'
import { StoreSettings } from '@/app/actions/settings'

export function CartDrawer({ settings }: { settings: StoreSettings }) {
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, clearCart, cartTotal, kickItems } = useCart()
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [tradeSubmitting, setTradeSubmitting] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)

  const cashItems = cartItems.filter(i => !i.isTradeProposal);
  const tradeItems = cartItems.filter(i => i.isTradeProposal);

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



  const handleTradeCheckout = async () => {
    setCartError(null)
    setTradeSubmitting(true)
    try {
      if (tradeItems.length > 0) {
         for (const trade of tradeItems) {
            if (!trade.tradeDetails) continue;
            
            const data = new FormData();
            data.append('name', trade.tradeDetails.name);
            data.append('email', trade.tradeDetails.email);
            data.append('offer', trade.tradeDetails.notes);
            
            const { cartItemId, isTradeProposal, tradeDetails, ...cleanInventoryItem } = trade;
            data.append('targetItems', JSON.stringify([cleanInventoryItem]));
            
            trade.tradeDetails.offerImages.forEach(file => {
               data.append('images', file);
            });
            
            const res = await submitTradeOffer(data);
            if (!res.success) {
               setCartError(res.error || "Unknown Server Rejection!")
               setTradeSubmitting(false)
               return;
            }
            removeFromCart(trade.cartItemId!);
         }
      }
      alert("Trade Offers Submitted Successfully! The store owner has been notified.");
      if (cashItems.length === 0) {
         setIsCartOpen(false);
      }
      setTradeSubmitting(false)
    } catch (e: any) {
      console.error("Trade Execution Error:", e);
      setCartError(e.message || "An exception occurred inside the native React loop boundary.")
      setTradeSubmitting(false)
    }
  }

  const renderItem = (item: any) => (
    <div key={item.cartItemId} className="flex gap-4 p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm relative pr-12 transition-all hover:border-zinc-700">
      <div className="w-16 h-16 bg-zinc-950 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 relative shadow-inner flex items-center justify-center p-0.5">
         <img src={item.image_url!} className="w-full h-full object-cover rounded-md" />
      </div>
      <div className="flex flex-col flex-1 py-1 pr-1">
        <span className="font-extrabold text-sm text-white leading-tight">{item.player_name}</span>
        <span className="text-xs font-semibold text-zinc-400 mt-0.5 line-clamp-1">{item.card_set}</span>
        <span className="text-[10px] uppercase font-bold text-cyan-500 tracking-widest mt-1">{item.parallel_insert_type}</span>
        
        {item.isTradeProposal ? (
           <div className="mt-auto flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[9px] font-black text-white bg-cyan-700 px-2 py-0.5 rounded uppercase tracking-widest leading-none border border-cyan-500 shadow-sm">Trade Proposal</span>
              
              {item.tradeDetails && item.tradeDetails.offerImageUrls.length > 0 && (
                 <div className="flex items-center gap-1 opacity-90">
                    {item.tradeDetails.offerImageUrls.map((url: string, idx: number) => (
                       <div key={idx} className="w-5 h-5 rounded hover:scale-150 transition-transform origin-left border border-zinc-700 overflow-hidden shadow-sm">
                          <img src={url} className="w-full h-full object-cover" />
                       </div>
                    ))}
                 </div>
              )}
           </div>
        ) : (
           <span className="font-black text-white mt-auto tracking-tight pt-1">${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}</span>
        )}
      </div>

      <button onClick={() => removeFromCart(item.cartItemId!)} className="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-zinc-600 hover:text-red-400 hover:bg-red-950 rounded-xl transition-colors">
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  )



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
            <div className="space-y-6">
              {cartError && (
                <div className="p-4 bg-red-950/30 text-red-400 text-sm rounded-xl border border-red-900/50 font-bold shadow-sm">
                  {cartError}
                </div>
              )}
              
              {cashItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest px-2 pb-1 border-b border-zinc-800">Cash Purchases</h3>
                  <div className="space-y-4">
                     {cashItems.map(renderItem)}
                  </div>
                </div>
              )}

              {tradeItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-cyan-500 tracking-widest px-2 pb-1 border-b border-zinc-800">Trade Escrow</h3>
                  <div className="space-y-4">
                     {tradeItems.map(renderItem)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-5 bg-zinc-950 border-t border-zinc-800 z-20 space-y-4 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
             
             {cashItems.length > 0 && (
                <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/60 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">Cash Total</span>
                    <span className="text-2xl font-black text-white tracking-tighter">${cartTotal.toFixed(2)}</span>
                  </div>

                  {cartTotal < settings.cart_minimum && (
                     <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 shadow-sm relative overflow-hidden mb-4">
                       <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                         <span>Minimum: ${settings.cart_minimum.toFixed(2)}</span>
                         <span className="text-cyan-400 bg-zinc-900 px-2 py-0.5 rounded shadow-sm border border-zinc-800">${(settings.cart_minimum - cartTotal).toFixed(2)} Away</span>
                       </h4>
                       <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                          <div className="bg-cyan-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (cartTotal / settings.cart_minimum) * 100)}%` }}></div>
                       </div>
                     </div>
                  )}
                  
                  <div className="mt-4 relative z-0">
                    <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test" }}>
                      <PayPalButtons 
                        disabled={cartTotal < settings.cart_minimum || checkoutLoading}
                        style={{ layout: "vertical", shape: "rect", color: "gold" }}
                        createOrder={async () => {
                          setCartError(null);
                          const check = await validateCartCompleteness(cashItems.map(i => i.id));
                          
                          if (!check.valid) {
                            kickItems(check.unavailableIds);
                            setCartError("Whoops! Some items in your bundle just sold to a competitive buyer. Please review your updated cart.");
                            throw new Error("Cart items unavailable");
                          }

                          const { orderId } = await createPayPalOrder(cashItems.map(i => i.id));
                          return orderId;
                        }}
                        onApprove={async (data) => {
                          try {
                            const res = await capturePayPalOrder(data.orderID);
                            if (res.success) {
                               clearCart();
                               setIsCartOpen(false);
                               setCartError(null);
                               alert("Payment Successful! Thank you for your purchase.");
                            }
                          } catch (err: any) {
                            console.error(err);
                            setCartError("Failed to capture funds. Please contact support.");
                          }
                        }}
                        onError={(err) => {
                          console.error(err);
                          setCartError("PayPal Checkout failed or was aborted.");
                        }}
                      />
                    </PayPalScriptProvider>
                  </div>
                </div>
             )}

             {tradeItems.length > 0 && (
                <div className="bg-cyan-950/10 p-5 rounded-2xl border border-cyan-900/20 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-cyan-600 font-black uppercase tracking-widest text-[10px]">Trade Action</span>
                    <span className="text-sm font-black text-cyan-400 tracking-tight flex items-center gap-1"><Handshake className="w-4 h-4"/> {tradeItems.length} Proposal{tradeItems.length > 1 ? 's' : ''}</span>
                  </div>
                  
                  <button onClick={handleTradeCheckout} disabled={tradeSubmitting} className="w-full bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-[15px]">
                    {tradeSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Submit Trade Offers'}
                  </button>
                </div>
             )}
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
