# Deployment Guide

Complete guide for deploying the Kletterhalle Kiosk system.

## Quick Start

1. **Test on laptop first** - See [Laptop Testing](./LAPTOP-TESTING.md)
2. **Order hardware** - See [Hardware Recommendations](./HARDWARE.md)
3. **Deploy to Raspberry Pi** - See [Raspberry Pi Setup](./RASPBERRY-PI-SETUP.md)

## Documents

| Document | Purpose |
|----------|---------|
| [HARDWARE.md](./HARDWARE.md) | Recommended hardware and costs |
| [LAPTOP-TESTING.md](./LAPTOP-TESTING.md) | Test the system on your laptop |
| [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) | Full production deployment guide |

## Scripts

The `scripts/` directory contains:

| Script | Purpose |
|--------|---------|
| `kiosk.sh` | Chromium kiosk mode startup |
| `kletterhalle.service` | Systemd service for Next.js app |
| `kiosk-browser.service` | Systemd service for kiosk browser |
| `wpa_supplicant.conf` | WiFi configuration template |

## Architecture

```
+---------------------------------------------+
|              KIOSK COMPUTER                  |
|  +--------------+   +---------------------+ |
|  |   Browser    |   |   Next.js App       | |
|  |  (Kiosk Mode)|-->|   (localhost:3000)  | |
|  +--------------+   +----------+----------+ |
|                                |            |
|                     +----------v----------+ |
|                     |   thermal-printer   | |
|                     |   (node-thermal)    | |
|                     +----------+----------+ |
|                                |            |
+--------------------------------|------------+
                                 | USB
                    +------------v------------+
                    |  Epson TM-T20III        |
                    |  /dev/usb/lp0           |
                    +-------------------------+

                    +-------------------------+
                    |  BBPOS WisePOS E        |
                    |  (WiFi - Stripe Terminal)|
                    +-------------------------+
```

## Verification Checklist

### Laptop Testing
- [ ] Printer detected at `/dev/usb/lp0`
- [ ] User has `lp` group permissions
- [ ] `PRINTER_TEST_MODE=false` in `.env.local`
- [ ] Card reader registered in Stripe Dashboard
- [ ] Card reader connected to WiFi
- [ ] Full payment flow completes
- [ ] Receipt prints with correct format

### Kiosk Deployment
- [ ] Raspberry Pi boots to kiosk mode
- [ ] Next.js app auto-starts
- [ ] Touch display responsive
- [ ] Printer works from Raspberry Pi
- [ ] Card reader connects to Raspberry Pi WiFi
- [ ] System recovers from power loss

## Troubleshooting

### Common Issues

**Printer not detected:**
```bash
ls -la /dev/usb/lp0
sudo usermod -a -G lp $USER
# Log out and back in
```

**Card reader not connecting:**
- Verify reader and kiosk are on same WiFi network
- Check `STRIPE_TERMINAL_LOCATION_ID` in `.env.local`
- Check Stripe Dashboard for reader registration

**Application not starting:**
```bash
sudo systemctl status kletterhalle.service
journalctl -u kletterhalle.service -f
```

**Display issues:**
- Check `/boot/firmware/config.txt` for correct display settings
- Run `xinput_calibrator` to calibrate touch

## Support

For issues with:
- **Stripe Terminal:** [Stripe Support](https://support.stripe.com)
- **Printer hardware:** Check Epson support or retailer
- **Application bugs:** Create an issue in the project repository
