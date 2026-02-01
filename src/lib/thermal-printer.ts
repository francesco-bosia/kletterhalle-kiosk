import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';

export interface PrintReceiptOptions {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  transactionId: string;
  paymentMethod: string;
}

export async function printThermalReceipt(options: PrintReceiptOptions): Promise<void> {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: process.env.PRINTER_TYPE === 'network'
      ? `tcp://${process.env.PRINTER_IP}:${process.env.PRINTER_PORT || 9100}`
      : (process.env.PRINTER_DEVICE || '/dev/usb/lp0'),
    driver: {
      endOfPage: false,
    },
  });

  try {
    await printer.isPrinterConnected();

    // Header
    printer.alignCenter();
    printer.setTextSize(2, 2);
    printer.println('KLETTERHALLE');
    printer.setTextSize(1, 1);
    printer.println('===================');
    printer.println(new Date().toLocaleString('de-CH'));
    printer.newLine();

    // Items
    printer.alignLeft();
    for (const item of options.items) {
      printer.println(`${item.name} x${item.quantity}`);
      printer.tableCustom([
        { text: '', width: 0.5, align: 'LEFT' },
        { text: formatChf(item.price * item.quantity), width: 0.5, align: 'RIGHT' }
      ]);
    }

    printer.newLine();
    printer.println('-------------------');

    // Total
    printer.setTextSize(2, 2);
    printer.tableCustom([
      { text: 'TOTAL', width: 0.5, align: 'LEFT' },
      { text: formatChf(options.total), width: 0.5, align: 'RIGHT' }
    ]);

    printer.setTextSize(1, 1);
    printer.newLine();

    // Payment info
    printer.println(`Bezahlt via: ${options.paymentMethod}`);
    printer.println(`Transaktion: ${options.transactionId.slice(0, 12)}...`);
    printer.newLine();

    // Footer
    printer.alignCenter();
    printer.println('Vielen Dank!');
    printer.println('===================');
    printer.newLine();
    printer.newLine();

    // Cut paper
    printer.cut();

    // Execute print
    await printer.execute();

    console.log('Receipt printed successfully');
  } catch (error) {
    console.error('Printer error:', error);
    throw new Error(`Failed to print receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await printer.clear();
  }
}

function formatChf(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}
