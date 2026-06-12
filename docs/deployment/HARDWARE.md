# Hardware Recommendations

This document outlines the recommended hardware for the Kletterhalle Kiosk system.

## Overview

The kiosk system requires three main hardware components:

1. **Card Reader** - Stripe Terminal compatible for accepting payments
2. **Thermal Printer** - ESC/POS compatible for printing receipts
3. **Kiosk Computer** - Runs the webapp in kiosk mode

## 1. Card Reader (Stripe Terminal)

### Recommended: BBPOS WisePOS E

**Price:** ~CHF 199 (excl. VAT)

| Criteria | Assessment |
|----------|------------|
| Stripe compatibility | Pre-certified, fully supported in Switzerland |
| Ease of connection | WiFi/Ethernet - needs internet only, no LAN with kiosk required |
| Ease of implementation | Server-driven Terminal (`process_payment_intent`), no browser SDK |
| Confidence in working system | Stripe-manufactured, widely deployed |
| No recurring costs | One-time purchase from Stripe Dashboard |

**Why WisePOS E over alternatives:**
- **Countertop design** - sits on the kiosk counter
- **WiFi connectivity** - works with laptop during testing, no pairing needed
- **Built-in screen** - customer-facing display for payment confirmation
- **Standalone** - doesn't require a phone/tablet to host

**Order from:** Stripe Dashboard > Terminal > Devices

## 2. Thermal Receipt Printer

### Recommended: Epson TM-T20III USB

**Price:** ~CHF 150-200

| Criteria | Assessment |
|----------|------------|
| ESC/POS compatibility | Full support - works with `node-thermal-printer` |
| Ease of connection | USB - plug into laptop or kiosk computer |
| Ease of implementation | Code configured: `type: PrinterTypes.EPSON` |
| Confidence in working system | Industry standard, millions deployed |
| No recurring costs | One-time purchase |

**Why TM-T20III:**
- **USB connectivity** - simplest setup, matches codebase config `/dev/usb/lp0`
- **80mm paper** - standard receipt width
- **Energy efficient** - low power consumption
- **Reliable** - Epson is the gold standard for POS printers
- **Available in Europe** - easy to source

**Where to buy (Switzerland):**
- [Digitec/Galaxus](https://www.digitec.ch) - Search "Epson TM-T20"
- [Conrad.ch](https://www.conrad.ch)
- Amazon.de (ships to CH)

**Alternative:** Epson TM-T88VI (~CHF 250-300) - faster printing for high-volume use

## 3. Kiosk Computer (Production)

### Recommended: Raspberry Pi 5 (8GB)

**Price:** ~CHF 120 + accessories

| Criteria | Assessment |
|----------|------------|
| Cost | Low cost, no recurring fees |
| Reliability | Proven in kiosk deployments |
| Touch display support | Official 7" touch display available |
| USB ports | 2x USB 3.0 for printer + peripherals |
| Network | WiFi + Ethernet |

**Required accessories:**
- Official Raspberry Pi 7" Touch Display (~CHF 90)
- USB-C power supply (~CHF 15)
- MicroSD card 32GB+ (~CHF 15)
- Case with display mount (~CHF 30)

**Total kiosk computer:** ~CHF 270

**Alternative options:**
- **Intel NUC** (~CHF 300-500) - more powerful, x86 architecture
- **Used mini PC** (Lenovo Tiny/Dell Micro) - ~CHF 150-250

## Total Hardware Cost

| Item | Price (CHF, excl. VAT) |
|------|------------------------|
| BBPOS WisePOS E | 199 |
| Epson TM-T20III | ~175 |
| Raspberry Pi 5 (8GB) | 120 |
| RPi 7" Touch Display | 90 |
| Power supply + SD card + case | ~60 |
| Receipt paper rolls (10x) | ~20 |
| **Total** | **~664** |

## Testing Setup (Laptop)

For initial testing, you only need:
1. **BBPOS WisePOS E** - connects via WiFi to your laptop
2. **Epson TM-T20III** - connects via USB to your laptop

The printer requires:
- Linux: USB device appears as `/dev/usb/lp0`
- macOS: May need driver installation
- Windows: COM port assignment
