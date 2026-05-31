# Laptop Testing Setup

This guide covers setting up and testing the kiosk system on your laptop before deploying to production hardware.

## Prerequisites

- Laptop with Node.js 20+ installed
- BBPOS WisePOS E card reader
- Epson TM-T20III thermal printer
- USB cable for printer
- WiFi network (same for laptop and card reader)

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

## Step 3: Register Card Reader

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/terminal)
2. Go to **Terminal > Locations**
3. Create a location if you haven't already
4. Click **Add reader**
5. Power on your WisePOS E
6. Follow on-screen instructions to connect to WiFi
7. The reader should appear in the dashboard for registration

## Step 4: Verify Environment

Ensure these are set in `.env.local`:

```bash
# Stripe Terminal Location ID
STRIPE_TERMINAL_LOCATION_ID=tml_xxx  # Your location ID

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
3. The card reader should activate
4. Tap/insert card to complete payment
5. Verify receipt prints

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

### Card reader not connecting

1. Verify reader is powered on
2. Check WiFi connection (reader and laptop on same network)
3. Verify `STRIPE_TERMINAL_LOCATION_ID` matches your Stripe location
4. Check browser console for connection errors

### Receipt not printing

1. Check `PRINTER_TEST_MODE=false` in `.env.local`
2. Verify printer has paper
3. Check printer is online (LED indicator)
4. Test direct print: `echo "Test" > /dev/usb/lp0`

## Next Steps

Once testing is successful, proceed to [Raspberry Pi Setup](./RASPBERRY-PI-SETUP.md).
