'use client'

import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/context/CartContext'

export function FloatingCart() {
  const { cartItems, setIsCartOpen, isCartOpen } = useCart()

  // Visually hide it if the drawer is actively open
  if (isCartOpen || cartItems.length === 0) return null

  return (
    <button
      onClick={() => setIsCartOpen(true)}
      className="fixed bottom-6 right-6 z-40 bg-surface text-brand-hover p-4 rounded-full shadow-2xl hover:bg-surface-hover hover:scale-110 active:scale-95 transition-all flex items-center justify-center group border border-border ring-4 ring-cyan-500/20"
      aria-label="Open Cart"
    >
      <ShoppingCart className="w-6 h-6" />
      <span className="absolute -top-2 -right-2 bg-brand text-zinc-950 text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-zinc-950 shadow-sm">
        {cartItems.length}
      </span>
    </button>
  )
}
