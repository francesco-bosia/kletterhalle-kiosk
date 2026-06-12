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
| `setup-pi.sh` | Base provisioning orchestrator; delegates to the two below |
| `harden-pi.sh` | Firewall hardening (`ufw`: SSH + loopback-only `:3000`) |
| `setup-systemd.sh` | `/usr/local/bin/{node,npm}` symlinks + installs both units + labwc autostart hook |
| `deploy.sh` | Day-to-day update: `git pull` → `npm ci` → `npm run build` → restart services |
| `kiosk.sh` | Launches Firefox in kiosk mode (Wayland) pointing at `127.0.0.1:3000` |
| `kletterhalle.service` | systemd **system** service for the Next.js app |
| `kiosk-browser.service` | systemd **user** service for the kiosk browser (started by the labwc autostart hook, not a target) |
| `wpa_supplicant.conf` | WiFi template (legacy; prefer configuring WiFi in Raspberry Pi Imager) |

See [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) for the full setup, the
nvm/symlink rationale, and the labwc autostart mechanism.

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
- [ ] `STRIPE_TERMINAL_READER_ID` set to reader's `tmr_…` id in `.env.local`
- [ ] Card reader shows **online** in Stripe Dashboard
- [ ] System recovers from power loss

## Troubleshooting

### Common Issues

**Printer not detected:**
```bash
ls -la /dev/usb/lp0
sudo usermod -a -G lp $USER
# Log out and back in
```

**Card reader not responding:**
- Verify reader is powered on and has internet access
- Check Stripe Dashboard — reader must show **online** under Terminal → Readers
- Verify `STRIPE_TERMINAL_READER_ID` in `.env.local` matches the reader's `tmr_…` id

**Application not starting:**
```bash
sudo systemctl status kletterhalle.service
journalctl -u kletterhalle.service -f
```
If you see `status=203/EXEC`, the `node`/`npm` path is wrong (nvm) — re-run
`./scripts/setup-systemd.sh` to re-point the `/usr/local/bin/{node,npm}` symlinks.

**Kiosk browser not appearing** (it's a *user* service started by the labwc
autostart hook, not a systemd target):
```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user status kiosk-browser --no-pager
grep kiosk-browser ~/.config/labwc/autostart || echo "hook missing — re-run setup-systemd.sh"
```

**Display issues (Wayland):**
- Check `/boot/firmware/config.txt` for correct display settings
- Touch is plug-and-play under Wayland/libinput on the official panel; check
  detection with `dmesg | grep -i -E 'dsi|hdmi|edid'`

### Payment fulfillment & receipt recovery

Receipts and the transaction log are produced server-side by the fulfillment
engine, not by the browser. Every paid payment is fulfilled either by the
synchronous fast-path (card: the kiosk calls `/api/fulfill` right after the
reader approves; TWINT: the server-rendered `/success` page) **or**, if that
path is interrupted, by a reconciliation sweep that polls Stripe roughly every
60 seconds. This means a paid-but-unprinted payment — printer out of paper, an
abandoned TWINT redirect, a brief reboot — is **auto-recovered within ~60s**
once the kiosk is healthy again. The sweep runs in-process (started from
`src/instrumentation.ts`); the poll interval is overridable with
`FULFILL_RECONCILE_INTERVAL_MS`.

- **Force a sweep now:** `curl -X POST http://127.0.0.1:3000/api/fulfill/reconcile`
  (returns `{attempted, fulfilled}`, or `{skipped:true}` if one is already running).
- **Fulfillment markers** live in `data/fulfilled/` (gitignored):
  - `<stripeId>.done` — fulfilled successfully.
  - `<stripeId>.needs-attention` — **paid but could not be fulfilled** (e.g. a
    product id was removed from the catalog after the sale). The sweep will not
    retry these. Open the file to read the reason, then resolve manually
    (reprint by hand or refund). Glance for `.needs-attention` files when
    reconciling the till.

**Loopback binding (security):** the app now starts with `-H 127.0.0.1`, so the
Next.js server is reachable only from the Pi itself — the kiosk browser, the
TWINT redirect, and the reader flow are all local or outbound, and the LAN
cannot reach the payment/print/fulfillment routes. To reach the app from your
laptop for debugging, use an SSH port-forward:
```bash
ssh -L 3000:127.0.0.1:3000 francesco@<kiosk-host>
# then open http://localhost:3000 on your laptop
```
To watch the **live kiosk screen** instead (not just the app), enable the
built-in VNC mirror — see *Remote access & screen mirroring* in
[RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md).

## Support

For issues with:
- **Stripe Terminal:** [Stripe Support](https://support.stripe.com)
- **Printer hardware:** Check Epson support or retailer
- **Application bugs:** Create an issue in the project repository
