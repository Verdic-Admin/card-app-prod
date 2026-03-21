'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { Database } from '@/types/database.types';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];

interface CartContextType {
  cartItems: InventoryItem[];
  addToCart: (item: InventoryItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  kickItems: (ids: string[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<InventoryItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Safely hydrate from localStorage on client mount explicitly bypassing server mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem('store_cart');
      if (stored) {
        setCartItems(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Could not load cart from storage", e);
    }
    setIsInitialized(true)
  }, []);

  // Sync to memory instantly on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('store_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isInitialized]);

  const addToCart = (item: InventoryItem) => {
    setCartItems(prev => {
      // Prevent duplicates of 1-of-1 items to protect integrity
      if (prev.find(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
  };
  
  const kickItems = (ids: string[]) => {
    setCartItems(prev => prev.filter(i => !ids.includes(i.id)));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.listed_price ?? item.avg_price ?? 0), 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, cartTotal, isCartOpen, setIsCartOpen, kickItems }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a dynamically mounted CartProvider tree');
  }
  return context;
};
