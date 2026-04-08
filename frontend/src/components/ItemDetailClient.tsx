'use client'

import { useCart } from '@/context/CartContext'
import { Database } from '@/types/database.types'

type InventoryItem = Database['public']['Tables']['inventory']['Row']

interface Props {
  item: InventoryItem
}

/**
 * Client-side Add-to-Cart button used on the /item/[id] detail page.
 * Kept minimal — the full PayPal checkout lives in CartDrawer.
 */
export function ItemDetailClient({ item }: Props) {
  const { addToCart, cartItems } = useCart()
  const isInCart = cartItems.some(i => i.id === item.id)
  const isAvailable = item.status === 'available'

  if (!isAvailable) {
    return (
      <div className="w-full text-center py-4 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-500 font-black uppercase tracking-widest text-sm">
        Sold
      </div>
    )
  }

  return (
    <button
      onClick={() => addToCart(item)}
      disabled={isInCart}
      className={`w-full py-4 rounded-xl font-black text-base uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] ${
        isInCart
          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900 cursor-default'
          : 'bg-white hover:bg-cyan-500 hover:text-white text-zinc-950 border border-zinc-200 hover:border-cyan-500'
      }`}
    >
      {isInCart ? '✓ In Cart' : (item.is_lot ? '📦 Add Lot to Cart' : 'Add to Cart')}
    </button>
  )
}
