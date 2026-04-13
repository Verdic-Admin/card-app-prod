'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { Database } from '@/types/database.types';
import { createSupabaseClient } from '@/utils/supabase/client';

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
  validateCartCompleteness: () => Promise<boolean>;
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
        const hydrated = JSON.parse(stored).map((i: any) => {
           if (i.isTradeProposal && i.tradeDetails) {
              return { ...i, tradeDetails: { ...i.tradeDetails, offerImages: [], offerImageUrls: [] } };
           }
           return i;
        });
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
      const savable = cartItems.map(i => {
         if (i.isTradeProposal && i.tradeDetails) {
            return { ...i, tradeDetails: { ...i.tradeDetails, offerImages: [], offerImageUrls: [] } };
         }
         return i;
      });
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

  const validateCartCompleteness = async () => {
    if (cartItems.length === 0) return true;
    
    // Only check items that we are purchasing (not trades)
    const purchaseItems = cartItems.filter(i => !i.isTradeProposal);
    if (purchaseItems.length === 0) return true;

    const supabase = createSupabaseClient();
    const { data } = await (supabase as any)
      .from('inventory')
      .select('id, status, checkout_expires_at')
      .in('id', purchaseItems.map(i => i.id));

    if (data) {
      const now = new Date();
      const invalidIds = (data as any[]).filter(item => {
        if (item.status === 'sold') return true;
        if (item.status === 'pending_checkout') {
          if (item.checkout_expires_at && new Date(item.checkout_expires_at) > now) {
            return true; // Locked by someone else
          }
        }
        return false;
      }).map(i => i.id);

      if (invalidIds.length > 0) {
        kickItems(invalidIds);
        alert("Attention: One or more items in your cart were sold or locked by another user and have been removed.");
        return false;
      }
    }
    return true;
  };

  // Natively exclude Trade targets from Cart Price calculations!
  const cartTotal = cartItems.reduce((sum, item) => {
     if (item.isTradeProposal) return sum;
     return sum + (item.listed_price ?? item.avg_price ?? 0);
  }, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, addTradeToCart, clearCart, cartTotal, isCartOpen, setIsCartOpen, kickItems, validateCartCompleteness }}>
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
