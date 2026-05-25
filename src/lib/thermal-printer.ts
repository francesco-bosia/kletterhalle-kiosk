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
  lang?: 'it' | 'en';
}

const isTestMode = process.env.PRINTER_TEST_MODE === 'true';

export async function printThermalReceipt(options: PrintReceiptOptions): Promise<void> {
  const lang = options.lang || 'it';

  const strings = {
    header: 'SPLÜIA',
    paidWith: lang === 'it' ? 'Pagato con:' : 'Paid with:',
    transaction: lang === 'it' ? 'Transazione:' : 'Transaction:',
    thankYou: lang === 'it' ? 'Grazie!' : 'Thank you!',
    total: lang === 'it' ? 'TOTALE' : 'TOTAL',
  };

  // Test mode: Output to console instead of real printer
  if (isTestMode) {
    console.log('='.repeat(40));
    console.log('TEST MODE - Thermal Receipt Preview');
    console.log('='.repeat(40));
    console.log();
    console.log(`       ${strings.header}`);
    console.log('       ============');
    console.log(new Date().toLocaleString(lang === 'it' ? 'it-CH' : 'en-CH'));
    console.log();

    for (const item of options.items) {
      console.log(`${item.name} x${item.quantity}`);
      console.log(`${' '.repeat(20)}${formatChf(item.price * item.quantity)}`);
    }

    console.log();
    console.log('-------------------');
    console.log(`${strings.total}${' '.repeat(15)}${formatChf(options.total)}`);
    console.log();
    console.log(`${strings.paidWith} ${options.paymentMethod}`);
    console.log(`${strings.transaction} ${options.transactionId.slice(0, 12)}...`);
    console.log();
    console.log(`       ${strings.thankYou}`);
    console.log('       ============');
    console.log();
    console.log('='.repeat(40));
    return;
  }

  // Production mode: Real thermal printer
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
    printer.println(strings.header);
    printer.setTextSize(1, 1);
    printer.println('===================');
    printer.println(new Date().toLocaleString(lang === 'it' ? 'it-CH' : 'en-CH'));
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
      { text: strings.total, width: 0.5, align: 'LEFT' },
      { text: formatChf(options.total), width: 0.5, align: 'RIGHT' }
    ]);

    printer.setTextSize(1, 1);
    printer.newLine();

    // Payment info
    printer.println(`${strings.paidWith} ${options.paymentMethod}`);
    printer.println(`${strings.transaction} ${options.transactionId.slice(0, 12)}...`);
    printer.newLine();

    // Footer
    printer.alignCenter();
    printer.println(strings.thankYou);
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
