'use client'

import { Database } from '@/types/database.types';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];

interface ProductCardProps {
  item: InventoryItem;
}

export function ProductCard({ item }: ProductCardProps) {
  const isAvailable = item.status === 'available';
  const { addToCart, cartItems } = useCart();
  const isInCart = cartItems.some(i => i.id === item.id);
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <>
      <div className="bg-zinc-900 rounded-xl shadow-md border border-zinc-800 overflow-hidden flex flex-col group transition-all hover:shadow-lg hover:border-zinc-700">
        
        {/* Dual Image Container */}
        <div 
           className="relative aspect-[2.5/3.5] w-full bg-zinc-950 perspective-1000 cursor-pointer"
           onClick={() => { if (item.back_image_url) setIsFlipped(!isFlipped) }}
        >
          <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${item.back_image_url ? 'lg:group-hover:rotate-y-180' : ''} ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* FRONT */}
            <div className="absolute inset-0 backface-hidden flex items-center justify-center p-6 bg-zinc-950">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={`${item.player_name} card`}
                  className={`w-full h-full object-contain drop-shadow-2xl ${!isAvailable ? 'grayscale opacity-50' : ''}`}
                  loading="lazy"
                />
              ) : (
                <div className="text-zinc-600 font-bold tracking-widest uppercase text-xs border border-zinc-800 px-4 py-2 rounded-lg">No Image</div>
              )}
              {item.back_image_url && (
                 <div className="absolute bottom-2 right-2 bg-zinc-950/80 text-cyan-400 text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full backdrop-blur-md lg:hidden pointer-events-none border border-zinc-800">Tap to flip</div>
              )}
            </div>

            {/* BACK */}
            {item.back_image_url && (
              <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center p-6 bg-zinc-950 border-4 border-zinc-900/50">
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
        </div>

        {/* Details Footer */}
        <div className="p-5 flex flex-col flex-grow border-t border-zinc-800 bg-zinc-900">
          <h3 className="font-extrabold text-lg text-white leading-tight tracking-tight">
            {item.player_name}
          </h3>
          <span className="text-xs font-bold text-zinc-500 mt-1 uppercase tracking-widest">
            {item.year} • #{item.card_number}
          </span>
          <p className="text-sm text-zinc-400 mt-2 mb-5 flex-grow font-semibold">
            {item.card_set} • <span className="text-cyan-400">{item.parallel_insert_type}</span>
          </p>

          <div className="flex items-center justify-between mt-auto">
            <span className="font-black text-2xl text-white tracking-tighter">
              ${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}
            </span>
            {isAvailable && (
              <button 
                onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                disabled={isInCart}
                className={`text-sm font-bold py-2.5 px-6 rounded-lg transition-all shadow-md active:scale-95 ${
                  isInCart 
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900 cursor-default shadow-none' 
                    : 'bg-white hover:bg-cyan-500 hover:text-white text-zinc-950 border border-zinc-200 hover:border-cyan-500'
                }`}
              >
                {isInCart ? 'In Cart' : 'Add to Cart'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </>
  );
}
