'use client'

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import type { StoreSettings } from '@/lib/store-settings';

export function Navbar({ settings }: { settings: StoreSettings }) {
  const { cartItems, setIsCartOpen } = useCart();

  return (
    <div className="flex flex-col w-full sticky top-0 z-50">
      {process.env.NEXT_PUBLIC_IS_MASTER_ORCHESTRATOR === 'true' && (
        <a
          href={process.env.NEXT_PUBLIC_DEPLOY_URL || 'https://railway.com/new/template/playerindex'}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative z-[70] w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-90 transition-opacity"
        >
          <div className="py-2 px-4 text-center">
            <p className="text-white text-xs sm:text-sm font-bold tracking-wide">
              Escape seller fees — own your custom card store starting at $5/month. Live Auctions included. Click to deploy.
            </p>
          </div>
        </a>
      )}
      {settings.site_announcement && (
        <div className="relative z-[60] overflow-hidden bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-600 shadow-md">
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none"></div>
          <div className="py-3 px-4 flex items-center justify-center gap-3 relative">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300"></span>
            </span>
            <p className="text-white text-sm sm:text-base font-black tracking-widest uppercase drop-shadow-md text-center">
              {settings.site_announcement}
            </p>
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300"></span>
            </span>
          </div>
        </div>
      )}
      <nav className="border-b border-border bg-surface/80 backdrop-blur-md relative z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex flex-col justify-center">
              <span className="font-black text-xl tracking-tight text-foreground leading-tight">
                {settings.site_name}
              </span>
              {settings.site_author && (
                <span className="text-xs text-muted tracking-wide leading-tight">
                  by {settings.site_author}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/" className="text-sm font-bold text-muted hover:text-foreground transition-colors">
                Shop
              </Link>
              <Link href="/sold" className="text-sm font-bold text-muted hover:text-foreground transition-colors">
                Past Sales
              </Link>
              <Link href="/auction" className="text-sm font-bold text-red-500 hover:text-red-400 transition-colors flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Live Auctions
              </Link>
              <Link href="/faq" className="text-sm font-bold text-muted hover:text-foreground transition-colors">
                FAQ
              </Link>
              <div className="h-6 w-px bg-border mx-1"></div>
              <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-muted hover:bg-surface-hover hover:text-brand rounded-full transition-all group">
                <ShoppingCart className="w-5 h-5 transition-transform group-hover:scale-110" />
                {cartItems.length > 0 && (
                  <span className="absolute top-0 right-0 w-[18px] h-[18px] bg-brand text-background text-[10px] font-black flex items-center justify-center rounded-full shadow-sm select-none transform translate-x-0.5 -translate-y-0.5 border border-surface">
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
