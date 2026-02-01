import { Ticket } from './tickets';

export interface CartItem {
  ticket: Ticket;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  total: number;  // Total in cents
  itemCount: number;  // Total number of tickets
  addItem: (ticket: Ticket) => void;
  removeItem: (ticketId: string) => void;
  updateQuantity: (ticketId: string, quantity: number) => void;
  clearCart: () => void;
}

export interface CartData {
  items: Array<{
    ticketId: string;
    ticketName: string;
    price: number;
    quantity: number;
  }>;
  total: number;
}
