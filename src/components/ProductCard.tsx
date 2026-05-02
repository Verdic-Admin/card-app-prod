'use client'

import { Database } from '@/types/database.types';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import { TradeModal } from '@/components/TradeModal';
import Link from 'next/link';
import { MarketSparkline } from '@/components/MarketSparkline';
import { price as p } from '@/utils/math';
import { deriveDisplayPricing } from '@/utils/pricing';
import { Share2 } from 'lucide-react';
import { buildPlayerIndexForecasterUrl } from '@/lib/player-index-deeplink';
import { PlayerIndexForecastLink } from '@/components/PlayerIndexForecastLink';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];

interface ProductCardProps {
  item: InventoryItem;
  discountRate?: number;
}

export function ProductCard({ item, discountRate = 0 }: ProductCardProps) {
  const isAvailable = item.status === 'available';
  const isLiveAuction = Boolean((item as any).is_auction) && (item as any).auction_status === 'live';
  const { addToCart, cartItems } = useCart();
  const isInCart = cartItems.some(i => i.id === item.id);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const pricing = deriveDisplayPricing({
    listed_price: item.listed_price,
    avg_price: item.avg_price,
    oracle_projection: (item as any).oracle_projection,
    oracle_discount_percentage: discountRate,
  });
  const playerIndexCalcUrl = buildPlayerIndexForecasterUrl(item as any);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/item/${item.id}`;
    const shareTitle = `${item.player_name} ${item.card_set ? `- ${item.card_set}` : ''}`.trim();

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: `Check out this card: ${shareTitle}`,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      alert('Item link copied.');
    } catch {
      // User canceled or clipboard unavailable.
    }
  };
  
  const attributeMap = [
    { key: 'is_rookie',      label: 'RC',    class: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/40' },
    { key: 'is_1st',         label: '1st',   class: 'bg-sky-400/20 text-sky-400 border-sky-400/40' },
    { key: 'is_short_print', label: 'SP',    class: 'bg-red-400/20 text-red-400 border-red-400/40' },
    { key: 'is_ssp',         label: 'SSP',   class: 'bg-amber-400/30 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(251,191,36,0.3)]' },
    { key: 'is_auto',        label: 'Auto',  class: 'bg-blue-400/20 text-blue-400 border-blue-400/40' },
    { key: 'is_relic',       label: 'Relic', class: 'bg-purple-400/20 text-purple-400 border-purple-400/40' },
  ];

  return (
    <>
      <div className="bg-surface rounded-xl shadow-md border border-border overflow-hidden flex flex-col group transition-all hover:shadow-lg hover:border-muted">
        
        {/* Dual Image Container — outer wrapper so PI promo link is not nested inside the item <Link> */}
        <div className="relative aspect-[2.5/3.5] w-full bg-background perspective-1000 group">
          <Link
            href={`/item/${item.id}`}
            className="absolute inset-0 z-0 block cursor-pointer"
          >
          <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${item.back_image_url ? 'lg:group-hover:rotate-y-180' : ''}`}>
            
            {/* FRONT */}
            <div className="absolute inset-0 backface-hidden flex items-center justify-center p-6 bg-background">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={`${item.player_name} card`}
                  className={`w-full h-full object-contain drop-shadow-2xl ${!isAvailable ? 'grayscale opacity-50' : ''}`}
                  loading="lazy"
                />
              ) : (
                <div className="text-muted font-bold tracking-widest uppercase text-xs border border-border px-4 py-2 rounded-lg">No Image</div>
              )}
              {item.back_image_url && (
                 <div className="absolute bottom-2 right-2 bg-background/80 text-brand-hover text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full backdrop-blur-md lg:hidden pointer-events-none border border-border">Tap to flip</div>
              )}
            </div>

            {/* BACK */}
            {item.back_image_url && (
              <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center p-6 bg-background border-4 border-zinc-900/50">
                 <img 
                    src={item.back_image_url} 
                    alt={`${item.player_name} back`}
                    className={`w-full h-full object-contain drop-shadow-2xl ${!isAvailable ? 'grayscale opacity-50' : ''}`}
                    loading="lazy"
                 />
              </div>
            )}
            
          </div>
          
          {!isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none z-10">
              <span className="bg-red-600 text-white font-black py-2 px-8 rounded-lg tracking-[0.2em] text-sm transform -rotate-12 shadow-2xl border border-red-400 pointer-events-auto">
                SOLD
              </span>
            </div>
          )}
          </Link>
          {isAvailable && !isLiveAuction && pricing.hasProjection && pricing.percentBelowPlayerIndex > 0 && (
            <PlayerIndexForecastLink
              href={playerIndexCalcUrl}
              className="absolute top-2 left-2 z-20 bg-indigo-900 text-indigo-300 text-xs px-2.5 py-1 rounded-full border border-indigo-700 font-bold shadow-[0_0_12px_rgba(79,70,229,0.4)] pointer-events-auto flex items-center gap-1 hover:bg-indigo-800 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              🔥 {pricing.percentBelowPlayerIndex.toFixed(0)}% Below Player Index Forecast
            </PlayerIndexForecastLink>
          )}
        </div>

        {/* Details Footer */}
        <div className="p-3 sm:p-5 flex flex-col flex-grow border-t border-border bg-surface">
          <Link href={`/item/${item.id}`} className="hover:text-brand-hover transition-colors">
            <h3 className="font-extrabold text-sm sm:text-lg text-white leading-tight tracking-tight">
              {item.player_name}
            </h3>
          </Link>
          <span className="text-[10px] sm:text-xs font-bold text-muted mt-1 uppercase tracking-widest leading-tight">
            {item.card_set} • #{item.card_number}{(item as any).print_run ? ` / ${(item as any).print_run}` : ''}
          </span>
          <div className="flex flex-wrap gap-2 mt-2 mb-2 font-semibold">
            {item.insert_name && item.insert_name.toLowerCase() !== 'base' && (
              <span className="text-[10px] text-indigo-300 bg-indigo-900/40 border border-indigo-700/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {item.insert_name}
              </span>
            )}
            {item.parallel_name && item.parallel_name.toLowerCase() !== 'base' && (
              <span className="text-[10px] text-brand bg-brand/20 border border-brand/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {item.parallel_name}
              </span>
            )}
            {(!item.insert_name && !item.parallel_name && item.parallel_insert_type && item.parallel_insert_type.toLowerCase() !== 'base') && (
              <span className="text-[10px] text-muted bg-surface-hover border border-border px-2 py-0.5 rounded-full uppercase tracking-wider">
                {item.parallel_insert_type}
              </span>
            )}
            {attributeMap.map(({ key, label, class: className }) => (
              (item as any)[key] && (
                <span key={key} className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${className}`}>
                  {label}
                </span>
              )
            ))}
            {(item as any).grading_company && (item as any).grade && (
              <span className="text-[9px] font-black bg-emerald-400/20 text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {(item as any).grading_company} {(item as any).grade}
              </span>
            )}
          </div>

          <div className="flex flex-col mt-auto gap-3">
            {isLiveAuction ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  Live on auction
                </p>
                {(item as any).current_bid != null && p((item as any).current_bid) > 0 && (
                  <p className="text-sm text-white mt-1">
                    Current high bid:{' '}
                    <span className="font-mono font-black text-cyan-400">
                      ${p((item as any).current_bid).toFixed(2)}
                    </span>
                  </p>
                )}
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                  Store price is hidden while this card is on the live block — use Live Auctions to bid.
                </p>
              </div>
            ) : pricing.hasProjection ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <PlayerIndexForecastLink
                    href={playerIndexCalcUrl}
                    className="text-[10px] uppercase tracking-widest font-bold text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline"
                  >
                    Player Index Forecast <span className="line-through opacity-70 ml-1">${pricing.playerIndexPrice.toFixed(2)}</span>
                  </PlayerIndexForecastLink>
                  {pricing.discountPercent > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-200 border border-indigo-700/70">
                      {pricing.discountPercent.toFixed(0)}% off
                    </span>
                  )}
                  {(item as any).oracle_trend_percentage != null && (
                    <span className={`text-[10px] font-semibold ${p((item as any).oracle_trend_percentage) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Trend {p((item as any).oracle_trend_percentage) >= 0 ? '+' : '-'}{Math.abs(p((item as any).oracle_trend_percentage)).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-black text-2xl sm:text-3xl text-white tracking-tighter">
                    ${pricing.effectiveStorePrice.toFixed(2)}
                  </span>
                  {(item as any).trend_data && Array.isArray((item as any).trend_data) && (item as any).trend_data.length > 0 && (
                    <MarketSparkline
                       data={(item as any).trend_data}
                       playerIndexUrl={playerIndexCalcUrl}
                    />
                  )}
                </div>
                {pricing.savingsAmount > 0 && (
                  <span className="text-xs font-bold text-emerald-400 mt-0.5">
                    You save ${pricing.savingsAmount.toFixed(2)}
                  </span>
                )}

              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 shrink-0">
                    Store
                  </span>
                  <span className="font-black text-2xl sm:text-3xl text-white tracking-tighter">
                    ${p(item.listed_price ?? item.avg_price).toFixed(2)}
                  </span>
                  {(item as any).trend_data && Array.isArray((item as any).trend_data) && (item as any).trend_data.length > 0 && (
                    <MarketSparkline
                       data={(item as any).trend_data}
                       playerIndexUrl={playerIndexCalcUrl}
                    />
                  )}
                </div>
                <span className="text-[10px] font-semibold text-zinc-500">
                  Direct listing (no Player Index Forecast projection on file)
                </span>
              </div>
            )}
            {isAvailable && (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
                     <button 
                        onClick={(e) => { e.stopPropagation(); setIsTradeModalOpen(true); }}
                        className="w-full text-[10px] sm:text-xs font-bold py-2.5 sm:py-3 rounded-lg transition-all shadow-md active:scale-95 bg-background hover:bg-surface-hover text-foreground border border-border hover:border-muted uppercase tracking-widest flex items-center justify-center"
                     >
                        Trade
                     </button>
                  {isLiveAuction ? (
                    <Link
                      href="/auction"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-sm font-bold py-3 rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black border border-amber-300"
                    >
                      Place Bid
                    </Link>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      disabled={isInCart}
                      className={`w-full text-sm font-bold py-3 rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center ${
                        isInCart 
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900 cursor-default shadow-none' 
                          : 'bg-white hover:bg-brand-hover hover:text-white text-background border border-border hover:border-brand-hover'
                      }`}
                    >
                      {isInCart ? 'In Cart' : 'Add to Cart'}
                    </button>
                  )}
              </div>
            )}
            <button
              onClick={handleShare}
              className="w-full text-xs font-bold py-2.5 rounded-lg transition-all text-zinc-300 border border-zinc-700 hover:text-white hover:bg-zinc-800 flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Item
            </button>
          </div>
        </div>
      </div>

      <TradeModal 
         isOpen={isTradeModalOpen} 
         onClose={() => setIsTradeModalOpen(false)} 
         cartItems={[]} 
         onSuccess={() => setIsTradeModalOpen(false)} 
         targetCard={item} 
      />

      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </>
  );
}
