'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/context/CartContext'
import { X, ShoppingCart, Trash2, Handshake, Loader2, CheckCircle2, ArrowRight, Copy } from 'lucide-react'
import { submitManualCheckout } from '@/app/actions/checkout'
import { submitTradeOffer } from '@/app/actions/trades'
import { TradeModal } from '@/components/TradeModal'
import type { StoreSettings } from '@/lib/store-settings'
import { paymentUrlWithAmount } from '@/lib/payment-links'
import { price as p } from '@/utils/math'

type CheckoutSuccessPayload = {
  orderId: string
  subtotal: number
  shipping: number
  total: number
  paymentMemo: string
}

export function CartDrawer({ settings }: { settings: StoreSettings }) {
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, clearCart, cartTotal, kickItems, validateCartCompleteness } = useCart()
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [tradeSubmitting, setTradeSubmitting] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
  const [checkoutStage, setCheckoutStage] = useState<'cart' | 'form' | 'success'>('cart')
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', address: '' })
  const [checkoutResult, setCheckoutResult] = useState<CheckoutSuccessPayload | null>(null)
  const [memoCopied, setMemoCopied] = useState(false)

  const cashItems = cartItems.filter(i => !i.isTradeProposal);
  const tradeItems = cartItems.filter(i => i.isTradeProposal);

  const earliestExpiry = cashItems
    .filter(i => i.checkout_expires_at)
    .map(i => new Date(i.checkout_expires_at!).getTime())
    .sort((a, b) => a - b)[0];

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!earliestExpiry) {
      setTimeLeft(null);
      return;
    }
    const updateTime = () => {
      const now = Date.now();
      const diff = earliestExpiry - now;
      setTimeLeft(diff > 0 ? diff : 0);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [earliestExpiry]);

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isCartOpen && cartItems.length > 0) {
      const runPreFlight = async () => {
        try {
          const cashItems = cartItems.filter(i => !i.isTradeProposal);
          if (cashItems.length === 0) return;
          const isValid = await validateCartCompleteness()
          if (!isValid) {
            setCartError("Heads up! Another collector just snagged an item while it was in your cart, but the rest of your stack is ready to go.")
          }
        } catch (e) {
          console.warn("Silent pre-flight validation failed")
        }
      }
      runPreFlight()
    }
  }, [isCartOpen, cartItems])

  useEffect(() => {
    if (!isCartOpen) {
      setCheckoutStage('cart')
      setCheckoutResult(null)
      setMemoCopied(false)
    }
  }, [isCartOpen])

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
    <div key={item.cartItemId} className="flex gap-4 p-3 bg-surface rounded-2xl border border-border shadow-sm relative pr-12 transition-all hover:border-border">
      <div className="w-16 h-16 bg-background rounded-lg overflow-hidden flex-shrink-0 border border-border relative shadow-inner flex items-center justify-center p-0.5">
         <img src={item.image_url!} className="w-full h-full object-cover rounded-md" />
      </div>
      <div className="flex flex-col flex-1 py-1 pr-1">
        <span className="font-extrabold text-sm text-foreground leading-tight">{item.player_name}</span>
        <span className="text-xs font-semibold text-muted mt-0.5 line-clamp-1">{item.card_set}</span>
        <span className="text-[10px] uppercase font-bold text-brand tracking-widest mt-1">{item.parallel_insert_type}</span>
        
        {item.isTradeProposal ? (
           <div className="mt-auto flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[9px] font-black text-foreground bg-brand-hover border-transparent px-2 py-0.5 rounded uppercase tracking-widest leading-none border border-brand shadow-sm">Trade Proposal</span>
              
              {item.tradeDetails && item.tradeDetails.offerImageUrls.length > 0 && (
                 <div className="flex items-center gap-1 opacity-90">
                    {item.tradeDetails.offerImageUrls.map((url: string, idx: number) => (
                       <div key={idx} className="w-5 h-5 rounded hover:scale-150 transition-transform origin-left border border-border overflow-hidden shadow-sm">
                          <img src={url} className="w-full h-full object-cover" />
                       </div>
                    ))}
                 </div>
              )}
           </div>
        ) : (
           <span className="font-black text-foreground mt-auto tracking-tight pt-1">${p(item.listed_price ?? item.avg_price).toFixed(2)}</span>
        )}
      </div>

      <button onClick={() => removeFromCart(item.cartItemId!)} className="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-muted hover:text-red-400 hover:bg-red-950 rounded-xl transition-colors">
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  )

  const handleManualCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCartError(null);
    setCheckoutLoading(true);
    try {
      const isValid = await validateCartCompleteness();
      if (!isValid) {
        setCartError("Whoops! Some items in your bundle just sold. Please review your cart.");
        setCheckoutStage('cart');
        setCheckoutLoading(false);
        return;
      }
      
      const res = await submitManualCheckout(
        cashItems.map(i => i.id),
        checkoutForm.name,
        checkoutForm.email,
        checkoutForm.address,
        { tradeProposalCount: tradeItems.length }
      );
      
      if (res.success) {
        setCheckoutResult({
          orderId: res.orderId,
          subtotal: res.subtotal,
          shipping: res.shipping,
          total: res.total,
          paymentMemo: res.paymentMemo,
        });
        setCheckoutStage('success');
      }
    } catch (err: any) {
      console.error(err);
      setCartError(err.message || "Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setIsCartOpen(false)} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-background shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-300 border-l border-border">
        <div className="flex items-center justify-between p-6 border-b border-border bg-background">
          <h2 className="text-xl font-black flex items-center gap-2 text-foreground tracking-tight">
            <ShoppingCart className="w-5 h-5 text-brand-hover" /> Your Bundle
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-surface-hover rounded-full transition-colors text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted space-y-4">
               <div className="w-20 h-20 bg-surface border border-border rounded-full flex items-center justify-center shadow-inner">
                 <ShoppingCart className="w-10 h-10 text-muted" />
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
                  <h3 className="text-[10px] font-black uppercase text-muted tracking-widest px-2 pb-1 border-b border-border">Cash Purchases</h3>
                  <div className="space-y-4">
                     {cashItems.map(renderItem)}
                  </div>
                </div>
              )}

              {tradeItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase text-brand tracking-widest px-2 pb-1 border-b border-border">Trade Escrow</h3>
                  <div className="space-y-4">
                     {tradeItems.map(renderItem)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-5 bg-background border-t border-border z-20 space-y-4 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
             
             {cashItems.length > 0 && (
                <div className="bg-surface/40 p-5 rounded-2xl border border-border/60 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-muted font-bold uppercase tracking-widest text-[10px]">Cash Total</span>
                    <div className="flex items-center gap-3">
                       {timeLeft !== null && timeLeft > 0 && (
                          <span className={`${timeLeft < 120000 ? 'text-red-400 animate-pulse' : 'text-amber-400'} text-[11px] font-black bg-black/50 px-2 py-1 rounded shadow-inner border border-border`}>
                             ⏳ {formatTime(timeLeft)}
                          </span>
                       )}
                       {timeLeft === 0 && (
                          <span className="text-red-500 animate-pulse text-[11px] font-black bg-black/50 px-2 py-1 rounded shadow-inner border border-border">
                             EXPIRED
                          </span>
                       )}
                       <span className="text-2xl font-black text-foreground tracking-tighter">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {cartTotal < settings.cart_minimum && (
                     <div className="bg-background rounded-xl p-3 border border-border shadow-sm relative overflow-hidden mb-4">
                       <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 flex justify-between items-center">
                         <span>Minimum: ${settings.cart_minimum.toFixed(2)}</span>
                         <span className="text-brand-hover bg-surface px-2 py-0.5 rounded shadow-sm border border-border">${(settings.cart_minimum - cartTotal).toFixed(2)} Away</span>
                       </h4>
                       <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-border">
                          <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (cartTotal / settings.cart_minimum) * 100)}%` }}></div>
                       </div>
                     </div>
                  )}
                  
                  <div className="mt-4 relative z-0">
                    {checkoutStage === 'cart' && (
                      <button 
                        onClick={() => setCheckoutStage('form')}
                        disabled={cartTotal < settings.cart_minimum || checkoutLoading}
                        className="w-full bg-brand hover:bg-brand-hover text-white font-black py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-[15px]"
                      >
                        Proceed to Checkout <ArrowRight className="w-5 h-5" />
                      </button>
                    )}

                    {checkoutStage === 'form' && (
                      <form onSubmit={handleManualCheckout} className="space-y-3 bg-background p-4 rounded-xl border border-border shadow-inner">
                        <input required type="text" placeholder="Full Name" value={checkoutForm.name} onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})} className="w-full bg-surface border border-border rounded outline-none p-2.5 text-foreground placeholder-zinc-500" />
                        <input required type="email" placeholder="Email Address" value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} className="w-full bg-surface border border-border rounded outline-none p-2.5 text-foreground placeholder-zinc-500" />
                        <textarea required placeholder="Shipping Address" value={checkoutForm.address} onChange={e => setCheckoutForm({...checkoutForm, address: e.target.value})} className="w-full bg-surface border border-border rounded outline-none p-2.5 text-foreground placeholder-zinc-500 resize-none h-20" />
                        <div className="flex gap-2 pt-2">
                           <button type="button" onClick={() => setCheckoutStage('cart')} className="flex-1 bg-surface-hover hover:bg-zinc-700 text-foreground font-bold py-3 rounded text-sm transition-colors">Back</button>
                           <button type="submit" disabled={checkoutLoading} className="flex-[2] bg-brand hover:bg-brand-hover text-white font-black py-3 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm">
                             {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Place Order'}
                           </button>
                        </div>
                      </form>
                    )}

                    {checkoutStage === 'success' && checkoutResult && (
                      <div className="bg-emerald-950/30 p-5 rounded-xl border border-emerald-900/50 text-center space-y-4 animate-in fade-in zoom-in-95">
                         <div className="w-12 h-12 bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                         </div>
                         <div>
                            <h3 className="text-emerald-400 font-black text-lg">Order reserved</h3>
                            <p className="text-emerald-200/70 text-[11px] mt-1 font-mono break-all">Ref: {checkoutResult.orderId}</p>
                            <p className="text-emerald-200/80 text-xs mt-2 leading-relaxed text-left">{settings.payment_instructions}</p>
                         </div>
                         <div className="text-left space-y-2">
                            <p className="text-[10px] font-black uppercase text-emerald-300/90 tracking-widest">Payment total</p>
                            <div className="flex justify-between text-xs text-emerald-100/90 font-mono">
                              <span>Subtotal</span><span>${checkoutResult.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-emerald-100/90 font-mono">
                              <span>Shipping</span><span>{checkoutResult.shipping > 0 ? `$${checkoutResult.shipping.toFixed(2)}` : "—"}</span>
                            </div>
                            <div className="flex justify-between text-sm font-black text-emerald-200 pt-1 border-t border-emerald-800/50">
                              <span>Send exactly</span><span>${checkoutResult.total.toFixed(2)}</span>
                            </div>
                         </div>
                         <div className="text-left space-y-2">
                            <p className="text-[10px] font-black uppercase text-emerald-300/90 tracking-widest">Copy into Venmo / PayPal / Cash App note</p>
                            <textarea
                              readOnly
                              rows={4}
                              className="w-full text-[11px] font-mono bg-black/40 border border-emerald-900/60 rounded-lg p-2 text-emerald-100 resize-none"
                              value={checkoutResult.paymentMemo}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(checkoutResult.paymentMemo);
                                  setMemoCopied(true);
                                  setTimeout(() => setMemoCopied(false), 2500);
                                } catch {
                                  setCartError("Could not copy — select the text above and copy manually.");
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-700/50 text-emerald-200 text-xs font-bold hover:bg-emerald-900/40 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              {memoCopied ? "Copied!" : "Copy payment note"}
                            </button>
                            <p className="text-[10px] text-emerald-200/60 leading-snug">
                              Venmo and most apps do not read cart data automatically. Pasting this note lets the seller match your payment to this order. PayPal.me and Cash App links below may pre-fill the amount only.
                            </p>
                         </div>
                         <div className="space-y-2">
                             {settings.payment_venmo && (
                                <a href={settings.payment_venmo} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#008CFF] hover:bg-[#0074D4] text-foreground font-black py-3 rounded-lg transition-colors text-sm shadow-md">
                                   Open Venmo — pay ${checkoutResult.total.toFixed(2)}
                                </a>
                             )}
                             {settings.payment_paypal && (
                                <a href={paymentUrlWithAmount(settings.payment_paypal, checkoutResult.total)} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#003087] hover:bg-[#001C53] text-foreground font-black py-3 rounded-lg transition-colors text-sm shadow-md">
                                   Open PayPal — ${checkoutResult.total.toFixed(2)}
                                </a>
                             )}
                             {settings.payment_cashapp && (
                                <a href={paymentUrlWithAmount(settings.payment_cashapp, checkoutResult.total)} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#00D632] hover:bg-[#00A827] text-foreground font-black py-3 rounded-lg transition-colors text-sm shadow-md">
                                   Open Cash App — ${checkoutResult.total.toFixed(2)}
                                </a>
                             )}
                             {settings.payment_zelle && (
                                <a href={(settings.payment_zelle.includes('@') ? `mailto:${settings.payment_zelle}` : `tel:${settings.payment_zelle}`)} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#7411E2] hover:bg-[#5C0DB3] text-foreground font-black py-3 rounded-lg transition-colors text-sm shadow-md">
                                   Zelle: {settings.payment_zelle} — send ${checkoutResult.total.toFixed(2)}
                                </a>
                             )}
                         </div>
                         <button onClick={() => {
                            clearCart();
                            setIsCartOpen(false);
                            setCheckoutStage('cart');
                         }} className="text-muted text-xs hover:text-foreground underline underline-offset-2 w-full text-center py-2">
                            I've sent the payment. Close window.
                         </button>
                      </div>
                    )}
                  </div>
                </div>
             )}

             {tradeItems.length > 0 && (
                <div className="bg-transparent p-5 rounded-2xl border border-brand/40 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-brand font-black uppercase tracking-widest text-[10px]">Trade Action</span>
                    <span className="text-sm font-black text-brand-hover tracking-tight flex items-center gap-1"><Handshake className="w-4 h-4"/> {tradeItems.length} Proposal{tradeItems.length > 1 ? 's' : ''}</span>
                  </div>
                  
                  <button onClick={handleTradeCheckout} disabled={tradeSubmitting} className="w-full bg-brand hover:bg-brand-hover text-white font-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-[15px]">
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
