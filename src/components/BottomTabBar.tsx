'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Store, Radio, Clock } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export function BottomTabBar() {
  const pathname = usePathname();
  const { cartItems, setIsCartOpen } = useCart();

  const tabs = [
    { href: '/', label: 'Shop', icon: Store },
    { href: '/auction', label: 'Live', icon: Radio, pulse: true },
    { href: '/sold', label: 'Past Sales', icon: Clock },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {tabs.map(({ href, label, icon: Icon, pulse }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                isActive ? 'text-brand' : 'text-muted hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                {pulse && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-brand' : 'text-muted'}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand rounded-b-full" />
              )}
            </Link>
          );
        })}

        {/* Cart tab */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted hover:text-foreground transition-colors relative"
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5" strokeWidth={2} />
            {cartItems.length > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-brand text-background text-[10px] font-black flex items-center justify-center rounded-full shadow-sm px-1 border border-surface">
                {cartItems.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-wide text-muted">Cart</span>
        </button>
      </div>
    </nav>
  );
}
