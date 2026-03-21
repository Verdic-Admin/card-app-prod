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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group transition-all hover:shadow-md">
        
        {/* Dual Image Container */}
        <div 
           className="relative aspect-[2.5/3.5] w-full bg-slate-50 perspective-1000 cursor-pointer"
           onClick={() => { if (item.back_image_url) setIsFlipped(!isFlipped) }}
        >
          <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${item.back_image_url ? 'lg:group-hover:rotate-y-180' : ''} ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* FRONT */}
            <div className="absolute inset-0 backface-hidden flex items-center justify-center p-6 bg-slate-50">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={`${item.player_name} card`}
                  className={`w-full h-full object-contain ${!isAvailable ? 'grayscale opacity-70' : ''}`}
                  loading="lazy"
                />
              ) : (
                <div className="text-slate-400 font-medium">No Image</div>
              )}
              {item.back_image_url && (
                 <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm lg:hidden pointer-events-none">Tap to flip</div>
              )}
            </div>

            {/* BACK */}
            {item.back_image_url && (
              <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center p-6 bg-slate-50 border-4 border-slate-100/50">
                 <img 
                    src={item.back_image_url} 
                    alt={`${item.player_name} back`}
                    className={`w-full h-full object-contain ${!isAvailable ? 'grayscale opacity-70' : ''}`}
                    loading="lazy"
                 />
              </div>
            )}
            
          </div>
          
          {!isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px] pointer-events-none z-10">
              <span className="bg-red-600 text-white font-bold py-1.5 px-6 rounded-md tracking-wider text-sm transform -rotate-12 shadow-sm border-2 border-white/20 pointer-events-auto">
                SOLD
              </span>
            </div>
          )}
        </div>

        {/* Details Footer */}
        <div className="p-5 flex flex-col flex-grow border-t border-slate-100">
          <h3 className="font-bold text-lg text-slate-900 leading-tight">
            {item.player_name}
          </h3>
          <span className="text-sm font-medium text-slate-500 mt-1">
            {item.year} • #{item.card_number}
          </span>
          <p className="text-sm text-slate-600 mt-2 mb-5 flex-grow font-medium">
            {item.card_set} • {item.parallel_insert_type}
          </p>

          <div className="flex items-center justify-between mt-auto">
            <span className="font-black text-xl text-slate-900 tracking-tight">
              ${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}
            </span>
            {isAvailable && (
              <button 
                onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                disabled={isInCart}
                className={`text-sm font-bold py-2.5 px-5 rounded-lg transition-all shadow-sm active:scale-95 ${
                  isInCart 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default' 
                    : 'bg-slate-900 hover:bg-indigo-600 text-white'
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
