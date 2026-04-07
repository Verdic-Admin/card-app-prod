'use client'

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { StoreSettings } from '@/app/actions/settings';

export function Navbar({ settings }: { settings: StoreSettings }) {
  const { cartItems, setIsCartOpen } = useCart();

  return (
    <div className="flex flex-col w-full sticky top-0 z-50">
      {settings.site_announcement && (
        <div className="bg-emerald-500 text-zinc-950 text-xs font-black text-center py-2 px-4 shadow-sm relative z-[60] tracking-wide">
          {settings.site_announcement}
        </div>
      )}
      <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md relative z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex flex-col justify-center">
              <span className="font-black text-xl tracking-tight text-white leading-tight">
                Into the Gap Sportscards
              </span>
              <span className="text-xs text-zinc-500 tracking-wide leading-tight">
                by logic_in_the_gap
              </span>
            </Link>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">
                Shop
              </Link>
              <Link href="/sold" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">
                Past Sales
              </Link>
              <Link href="/auction" className="text-sm font-bold text-red-500 hover:text-red-400 transition-colors flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Live Auctions
              </Link>
              <Link href="/faq" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors">
                FAQ
              </Link>
              <div className="h-6 w-px bg-zinc-800 mx-1"></div>
              <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-zinc-400 hover:bg-zinc-900 hover:text-cyan-400 rounded-full transition-all group">
                <ShoppingCart className="w-5 h-5 transition-transform group-hover:scale-110" />
                {cartItems.length > 0 && (
                  <span className="absolute top-0 right-0 w-[18px] h-[18px] bg-cyan-500 text-zinc-950 text-[10px] font-black flex items-center justify-center rounded-full shadow-sm select-none transform translate-x-0.5 -translate-y-0.5 border border-zinc-950">
                    {cartItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
