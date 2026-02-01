/**
 * Printer utilities for the kiosk.
 *
 * For production with a thermal printer, you have several options:
 *
 * 1. ESC/POS via Node.js (recommended for free solution)
 *    - Use 'node-thermal-printer' or 'escpos' library
 *    - Connect via USB or Ethernet
 *    - Requires native driver installation
 *
 * 2. QZ Tray (enterprise solution)
 *    - qz.io tray application
 *    - Works with browser JavaScript
 *    - ~CHF 500+ license fee
 *
 * 3. Browser print dialog (simplest for testing)
 *    - Use window.print() with print-specific CSS
 *    - Works with any printer
 *    - Not ideal for unattended kiosk
 *
 * This module provides utilities for browser printing.
 * For production thermal printing, integrate the appropriate library.
 */

export interface ReceiptData {
  ticketName: string;
  ticketPrice: number; // in cents
  transactionId: string;
  date: Date;
}

/**
 * Format price in CHF for receipt
 */
export function formatReceiptPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

/**
 * Format date for receipt
 */
export function formatReceiptDate(date: Date): string {
  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate receipt text content for thermal printing
 * This can be sent to an ESC/POS printer in production
 */
export function generateReceiptText(data: ReceiptData): string {
  const lines: string[] = [];

  // Header
  lines.push('================================');
  lines.push('       KLETTERHALLE');
  lines.push('================================');
  lines.push('');

  // Ticket info
  lines.push('TICKET');
  lines.push('------');
  lines.push(data.ticketName);
  lines.push('');

  // Date
  lines.push('DATUM / ZEIT');
  lines.push('--------------');
  lines.push(formatReceiptDate(data.date));
  lines.push('');

  // Price
  lines.push('BETRAG');
  lines.push('-------');
  lines.push(formatReceiptPrice(data.ticketPrice));
  lines.push('');

  // Transaction ID
  lines.push('TRANSaktion');
  lines.push('-----------');
  lines.push(data.transactionId.slice(0, 16));
  lines.push('');

  // Footer
  lines.push('================================');
  lines.push('     Vielen Dank!');
  lines.push('================================');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

/**
 * Trigger browser print dialog
 * Use this for testing or when no thermal printer is available
 */
export function printReceipt(data: ReceiptData): void {
  // For now, we use browser print
  // The success page has print-specific CSS via @media print
  window.print();
}

/**
 * For production thermal printing, you would implement
 * a function like this using node-thermal-printer:
 *
 * import ThermalPrinter from 'node-thermal-printer';
 *
 * export async function printThermalReceipt(data: ReceiptData): Promise<void> {
 *   const printer = new ThermalPrinter({
 *     type: 'epson', // or 'star'
 *     interface: '/dev/usb/lp0', // USB device path
 *   });
 *
 *   const isConnected = await printer.isPrinterConnected();
 *   if (!isConnected) {
 *     throw new Error('Printer not connected');
 *   }
 *
 *   printer.alignCenter();
 *   printer.println('KLETTERHALLE');
 *   printer.drawLine();
 *   printer.alignLeft();
 *   printer.println('TICKET: ' + data.ticketName);
 *   printer.println('DATUM: ' + formatReceiptDate(data.date));
 *   printer.println('BETRAG: ' + formatReceiptPrice(data.ticketPrice));
 *   printer.drawLine();
 *   printer.println('Vielen Dank!');
 *
 *   await printer.cut();
 *   await printer.execute();
 * }
 */

/**
 * ESC/POS command reference for thermal printers:
 *
 * - Line width: 58mm (common for portable printers)
 * - Character width: ~12 chars per line (standard font)
 * - Font sizes: 0 (standard), 1 (double height), 2 (double width), 3 (double both)
 * - Alignment: left, center, right
 * - Cut paper: GS V (full cut) or GS V m (partial cut)
 * - Feed: ESC d n (feed n lines)
 *
 * Common ESC/POS commands:
 * - ESC @ : Initialize printer
 * - LF : Line feed
 * - ESC a n : Justification (0=left, 1=center, 2=right)
 * - GS V : Cut paper
 * - ESC d n : Feed n lines
 */

/**
 * Example: Convert receipt text to ESC/POS commands
 *
 * For production, use a library like 'escpos':
 *
 * import { Printer, Image } from 'escpos';
 * import USB from 'escpos-usb';
 *
 * const device = new USB(0xXXXX, 0xXXXX); // Vendor/Product ID
 * const printer = new Printer(device);
 *
 * printer
 *   .font('a')
 *   .align('CT')
 *   .text('KLETTERHALLE')
 *   .drawLine()
 *   .align('LT')
 *   .text('TICKET: ' + data.ticketName)
 *   .text('BETRAG: ' + formatReceiptPrice(data.ticketPrice))
 *   .cut()
 *   .close();
 */
