'use client'

import { useState, useEffect } from 'react'
import { price } from '@/utils/math'

interface Item {
  id: string;
  image_url: string;
  video_url?: string;
  coined_image_url?: string;
  player_name: string;
  card_set: string;
  current_bid: number;
  listed_price: number;
  bidder_count: number;
  [key: string]: any;
}

export function LiveAuctionGrid({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [modalImage, setModalImage] = useState<string | null>(null)

  // Polling loop
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { getLiveAuctionStatus } = await import('@/app/actions/polling');
        const updates = await getLiveAuctionStatus();
        setItems(prevItems => 
          prevItems.map(item => {
             const up = updates.find((u: any) => u.id === item.id);
             if (up) {
                return { ...item, current_bid: up.current_bid, bidder_count: up.bidder_count };
             }
             return item;
          })
        );
      } catch (e) {
        console.error("Polling failed", e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="relative aspect-[3/4] bg-zinc-950 flex items-center justify-center overflow-hidden group">
              {item.video_url ? (
                <>
                  <video 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-contain"
                    src={item.video_url}
                  ></video>
                  <div className="absolute top-2 left-2 bg-zinc-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2 py-1 rounded shadow drop-shadow-md flex items-center gap-1 z-10">
                     Surface Audit ✓
                  </div>
                </>
              ) : (
                <img src={item.image_url} alt={item.player_name} className="w-full h-full object-contain" />
              )}
              
              {/* Coined Image Badge */}
              {item.coined_image_url && (
                <button 
                   onClick={() => setModalImage(item.coined_image_url!)}
                   className="absolute bottom-2 right-2 bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg border border-indigo-400/50 transition-all z-20 flex items-center gap-1"
                >
                   <span>🛡️ Verified Possession</span>
                </button>
              )}
            </div>
            
            <div className="p-4">
              <h3 className="font-bold text-lg text-white leading-tight">{item.player_name}</h3>
              <p className="text-zinc-400 text-sm">{item.card_set}</p>
              {(item.is_rookie || item.is_auto || item.is_relic || (item.grading_company && item.grade)) && (
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {item.is_rookie && (
                    <span className="text-[9px] font-black bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">RC</span>
                  )}
                  {item.is_auto && (
                    <span className="text-[9px] font-black bg-blue-400/20 text-blue-400 border border-blue-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">Auto</span>
                  )}
                  {item.is_relic && (
                    <span className="text-[9px] font-black bg-purple-400/20 text-purple-400 border border-purple-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">Relic</span>
                  )}
                  {item.grading_company && item.grade && (
                    <span className="text-[9px] font-black bg-emerald-400/20 text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">{item.grading_company} {item.grade}</span>
                  )}
                </div>
              )}
              
              <div className="text-center font-mono font-black text-3xl text-cyan-400 bg-zinc-950 py-3 rounded-lg mb-2 shadow-inner border border-zinc-800 relative">
                ${price(item.current_bid || item.listed_price).toFixed(2)}
                {item.bidder_count > 0 && (
                   <span className="absolute -top-3 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow border border-red-400">
                      {item.bidder_count} Bids
                   </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button 
                  onClick={async () => {
                     const amt = prompt("Enter bid amount:");
                     if (!amt || isNaN(Number(amt))) return;
                     const email = prompt("Enter your email for confirmation:");
                     if (!email) return;
                     
                     try {
                        const { placeBidAction } = await import('@/app/actions/inventory');
                        await placeBidAction(item.id, email, Number(amt));
                        alert("Bid placed! Poller will update price shortly.");
                     } catch (e: any) {
                        alert(e.message);
                     }
                  }} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-2 rounded text-sm transition-colors shadow-lg"
                >
                  Bid Cash
                </button>
                <button
                  onClick={async () => {
                    const name = prompt('Your name:');
                    if (!name) return;
                    const email = prompt('Your email:');
                    if (!email) return;
                    const offer = prompt('Describe your trade offer (card(s), cash, or combo):');
                    if (!offer) return;
                    try {
                      const { submitTradeOffer } = await import('@/app/actions/trades');
                      const fd = new FormData();
                      fd.append('name', name);
                      fd.append('email', email);
                      fd.append('offer', offer);
                      fd.append('targetItems', JSON.stringify([item.id]));
                      await submitTradeOffer(fd);
                      alert('Trade offer submitted! The seller will reach out via email.');
                    } catch (e: any) {
                      alert(`Failed to submit trade: ${e.message}`);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-2 rounded text-sm transition-colors shadow-lg"
                >
                  Offer Trade
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
           <div className="col-span-full text-zinc-500 text-center py-10 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
             No items currently live on the block.
           </div>
        )}
      </div>

      {modalImage && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setModalImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
               <button onClick={() => setModalImage(null)} className="absolute -top-10 right-0 text-white font-bold text-xl hover:text-red-400">✕ Close</button>
               <img src={modalImage} className="w-full max-h-[85vh] object-contain rounded-xl border border-zinc-700 shadow-2xl" />
            </div>
         </div>
      )}
    </>
  )
}
