'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { CartContextType, CartItem } from '@/lib/cart-types';

// Unique ID for this CartProvider instance (to detect multiple providers)
const providerId = Math.random().toString(36).substring(7);
console.log('[CartProvider] Creating CartProvider with ID:', providerId);

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  const total = items.reduce((sum, item) => sum + (item.ticket.price * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Debug logging
  console.log(`[CartContext ${providerId}] State updated:`, { items, itemCount, total });

  const addItem = useCallback((ticket: any) => {
    console.log(`[CartContext ${providerId}] addItem called:`, ticket);
    setItems(prevItems => {
      const existingItem = prevItems.find(i => i.ticket.id === ticket.id);
      if (existingItem) {
        console.log(`[CartContext ${providerId}] Updating existing item`);
        return prevItems.map(i =>
          i.ticket.id === ticket.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      console.log(`[CartContext ${providerId}] Adding new item`);
      return [...prevItems, { ticket, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((ticketId: string) => {
    setItems(prevItems => prevItems.filter(i => i.ticket.id !== ticketId));
  }, []);

  const updateQuantity = useCallback((ticketId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(ticketId);
      return;
    }
    setItems(prevItems =>
      prevItems.map(i =>
        i.ticket.id === ticketId
          ? { ...i, quantity }
          : i
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <CartContext.Provider value={{ items, total, itemCount, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
