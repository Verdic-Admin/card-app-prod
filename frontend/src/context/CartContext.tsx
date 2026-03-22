'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { Database } from '@/types/database.types';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];

export interface CartItem extends InventoryItem {
  cartItemId: string;
  isTradeProposal?: boolean;
  tradeDetails?: {
    name: string;
    email: string;
    notes: string;
    offerImages: File[];
    offerImageUrls: string[];
  };
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: InventoryItem) => void;
  removeFromCart: (cartItemId: string) => void;
  addTradeToCart: (item: InventoryItem, tradeDetails: NonNullable<CartItem['tradeDetails']>) => void;
  clearCart: () => void;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  kickItems: (ids: string[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('store_cart');
      if (stored) {
        // Strip out volatile properties natively when hydrating
        const hydrated = JSON.parse(stored).filter((i: any) => !i.isTradeProposal);
        setCartItems(hydrated);
      }
    } catch (e) {
      console.warn("Could not load cart from storage", e);
    }
    setIsInitialized(true)
  }, []);

  useEffect(() => {
    if (isInitialized) {
      // Don't save trade bindings natively into localStorage because File[] objects will crash JSON.stringify serialization
      const savable = cartItems.filter(i => !i.isTradeProposal);
      localStorage.setItem('store_cart', JSON.stringify(savable));
    }
  }, [cartItems, isInitialized]);

  const addToCart = (item: InventoryItem) => {
    setCartItems(prev => {
      if (prev.find(i => i.id === item.id && !i.isTradeProposal)) return prev;
      return [...prev, { ...item, cartItemId: Math.random().toString(36).substring(7) }];
    });
  };

  const addTradeToCart = (item: InventoryItem, tradeDetails: NonNullable<CartItem['tradeDetails']>) => {
    setCartItems(prev => [...prev, { 
       ...item, 
       cartItemId: Math.random().toString(36).substring(7), 
       isTradeProposal: true, 
       tradeDetails 
    }]);
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => {
       const target = prev.find(i => i.cartItemId === cartItemId);
       if (target?.tradeDetails?.offerImageUrls) {
          target.tradeDetails.offerImageUrls.forEach(url => URL.revokeObjectURL(url));
       }
       return prev.filter(i => i.cartItemId !== cartItemId);
    });
  };
  
  const kickItems = (ids: string[]) => {
    setCartItems(prev => prev.filter(i => {
       if (i.isTradeProposal) return true; // Bypass Ghost Sweepers physically!
       return !ids.includes(i.id);
    }));
  };

  const clearCart = () => {
    setCartItems(prev => {
       prev.forEach(i => {
          if (i.tradeDetails?.offerImageUrls) {
             i.tradeDetails.offerImageUrls.forEach(url => URL.revokeObjectURL(url));
          }
       });
       return [];
    });
  };

  // Natively exclude Trade targets from Cart Price calculations!
  const cartTotal = cartItems.reduce((sum, item) => {
     if (item.isTradeProposal) return sum;
     return sum + (item.listed_price ?? item.avg_price ?? 0);
  }, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, addTradeToCart, clearCart, cartTotal, isCartOpen, setIsCartOpen, kickItems }}>
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
