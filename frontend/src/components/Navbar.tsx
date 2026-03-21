'use client'

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export function Navbar() {
  const { cartItems, setIsCartOpen } = useCart();

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 flex items-center gap-2">
            The Hobby Merchant
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
              Shop
            </Link>
            <Link href="/sold" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
              Past Sales
            </Link>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-full transition-all group">
              <ShoppingCart className="w-5 h-5 transition-transform group-hover:scale-110" />
              {cartItems.length > 0 && (
                <span className="absolute top-0 right-0 w-[18px] h-[18px] bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-sm select-none transform translate-x-0.5 -translate-y-0.5 border border-white">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
