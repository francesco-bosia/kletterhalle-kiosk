# Laptop Testing Setup

This guide covers setting up and testing the kiosk system on your laptop before deploying to production hardware.

## Prerequisites

- Laptop with Node.js 20+ installed
- Epson TM-T20III thermal printer (optional for receipt testing)
- USB cable for printer
- Internet access (card reader communicates with Stripe's cloud, not the laptop directly)

## Step 1: Configure Printer

### Linux

```bash
# Check USB printer is detected
ls -la /dev/usb/lp0

# Add user to lp group for permissions
sudo usermod -a -G lp $USER

# Log out and back in for group changes to take effect

# Test printer connection
echo "Test print" > /dev/usb/lp0
```

### macOS

1. Install printer driver from Epson website
2. System Preferences > Printers & Scanners > Add Printer
3. Note the printer name/URI

### Windows

1. Install printer driver from Epson website
2. Note the COM port in Device Manager

## Step 2: Update Environment Variables

Edit `.env.local`:

```bash
# Disable test mode to use real printer
PRINTER_TEST_MODE=false

# Printer configuration
PRINTER_TYPE=usb
PRINTER_DEVICE=/dev/usb/lp0   # Linux
# PRINTER_DEVICE=/dev/usb/lp0  # Adjust for your OS
```

## Step 3: Configure card reader

The kiosk uses server-driven Terminal — payments are dispatched to the reader
via Stripe's cloud, so the reader does **not** need to be on the same network
as the laptop.

### Option A: simulated reader (no hardware needed)

A simulated WisePOS E has been created in test mode:
`tmr_GikXhw2oN5y6Rd` at location `tml_GXxBaAe9LCuEk1`
(created with `registration_code=simulated-wpe`). Point the dev env at it:

```bash
# .env.local
STRIPE_TERMINAL_READER_ID=tmr_GikXhw2oN5y6Rd
```

Start a card payment in the kiosk, then simulate the customer tapping a
card from your terminal:

```bash
set -a; source .env.local; set +a
READER=tmr_GikXhw2oN5y6Rd
# success (default Visa):
curl -s -u "$STRIPE_SECRET_KEY:" \
  -X POST "https://api.stripe.com/v1/test_helpers/terminal/readers/$READER/present_payment_method"
# decline:
curl -s -u "$STRIPE_SECRET_KEY:" \
  -X POST "https://api.stripe.com/v1/test_helpers/terminal/readers/$READER/present_payment_method" \
  -d "type=card_present" -d "card_present[number]=4000000000000002"
```

### Option B: physical WisePOS E (test mode)

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/terminal)
2. Go to **Terminal > Locations** and create a location if needed
3. Click **Add reader**, power on the WisePOS E, and follow the on-screen
   instructions to connect it to any WiFi with internet access
4. Once it shows **online** in the Dashboard, copy its `tmr_…` id
5. Set `STRIPE_TERMINAL_READER_ID=tmr_…` in `.env.local`

## Step 4: Verify Environment

Ensure these are set in `.env.local`:

```bash
# Server-driven Terminal: reader id (tmr_…)
STRIPE_TERMINAL_READER_ID=tmr_xxx

# Stripe API Keys (test mode for testing)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

## Step 5: Test the Application

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

Open http://localhost:3000 and:

1. Add tickets to cart
2. Proceed to payment
3. The reader activates (or, for simulated reader, use the `curl` command
   above to present a card)
4. Verify the payment completes and a receipt prints

## Troubleshooting

### Printer not detected

```bash
# Check USB devices
lsusb

# Check printer device
ls -la /dev/usb/lp0

# Check permissions
groups $USER  # Should include 'lp'
```

### Card reader not responding

1. Verify reader is powered on and has internet access
2. Check the Dashboard — the reader must show **online** under Terminal → Readers
3. Verify `STRIPE_TERMINAL_READER_ID` in `.env.local` matches the reader's `tmr_…` id
4. Check the Next.js server logs for errors from `/api/pay` or `/api/fulfill`

### Receipt not printing

1. Check `PRINTER_TEST_MODE=false` in `.env.local`
2. Verify printer has paper
3. Check printer is online (LED indicator)
4. Test direct print: `echo "Test" > /dev/usb/lp0`

## Next Steps

Once testing is successful, proceed to [Raspberry Pi Setup](./RASPBERRY-PI-SETUP.md).
