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
      className="fixed bottom-6 right-6 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group border-[3px] border-white ring-4 ring-indigo-600/20"
      aria-label="Open Cart"
    >
      <ShoppingCart className="w-6 h-6" />
      <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
        {cartItems.length}
      </span>
    </button>
  )
}
