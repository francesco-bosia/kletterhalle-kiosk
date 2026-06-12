# Raspberry Pi Kiosk Setup

Complete guide for setting up the Kletterhalle Kiosk on a Raspberry Pi 5 running
**Raspberry Pi OS (Bookworm, 64-bit, Desktop)** — a **Wayland** session
(`labwc` compositor) with **Firefox** in kiosk mode.

> **Conventions used below.** The running kiosk uses user `francesco`, host
> `kletterhalle`, and the repo lives at `~/Documents/kletterhalle-kiosk`. Adjust
> if yours differ — but note the systemd unit `kletterhalle.service` hard-codes
> `User=francesco` and that `WorkingDirectory`, so changing them means editing
> `scripts/kletterhalle.service` too.

## Architecture at a glance

| Component                | Unit / mechanism                          | Type   | Started by                                  |
| ------------------------ | ----------------------------------------- | ------ | ------------------------------------------- |
| Next.js server (`:3000`) | `kletterhalle.service`                    | system | systemd at boot (`multi-user.target`)       |
| Firefox kiosk            | `kiosk-browser.service` (`scripts/kiosk.sh`) | user   | **labwc autostart hook** on desktop login   |

Two things worth internalising before you start:

- **The server is loopback-only.** It binds `127.0.0.1:3000`; nothing on the LAN
  can reach it. The kiosk browser and the Stripe redirect are local; the WisePOS
  E reader is outbound-only (see *Card reader* below).
- **The browser is NOT started by a systemd target.** Raspberry Pi OS's Wayland
  session does not activate the user `graphical-session.target`, so a
  `WantedBy=graphical-session.target` unit would never fire. Instead the labwc
  autostart hook (`~/.config/labwc/autostart`) runs
  `systemctl --user start kiosk-browser.service` once the Wayland socket is up.
  The unit keeps `Restart=always` for supervision but has no `[Install]` section.

## Hardware Assembly

### Raspberry Pi 5 + Official 7" Touch Display

1. Connect the DSI ribbon cable from display to the Pi's DSI port (between USB-C power and mini HDMI)
2. Connect display power cable to the Pi's GPIO header (pins 2, 6 for 5V and GND)
3. Mount Pi to the back of the display using the included screws
4. Insert the microSD card

### Alternative: External HDMI Touch Display

- Use an HDMI cable to connect the display
- USB cable from display to Pi for touch input

## Install Raspberry Pi OS

Use **Raspberry Pi Imager** (https://www.raspberrypi.com/software/) and pick
**Raspberry Pi OS (64-bit)** with Desktop. In the Imager's *OS customisation*
settings (gear icon) you can preconfigure everything headless:

- **Hostname:** `kletterhalle`
- **Username/password:** `francesco` / your password
- **Wireless LAN:** SSID + password, country `CH`
- **Enable SSH:** password or public-key auth
- **Locale/timezone:** as appropriate

That removes the need for the old `/boot/ssh` and `wpa_supplicant.conf` files.
Flash, insert the card, and boot the Pi.

## First Boot & Display Setup

### Connect via SSH

```bash
ssh francesco@kletterhalle.local
```

(If you use Tailscale, you can also reach it by its Tailscale name/IP from
anywhere — see *Remote access & screen mirroring* below.)

### Configure boot behaviour with raspi-config

```bash
sudo raspi-config
```

- `1 System Options` → `Boot / Auto Login` → **Desktop Autologin**
  (so the desktop session — and therefore the kiosk browser — comes up without a
  physical login after a reboot/power loss).
- `3 Interface Options` → `I2C` → Enable (for touch, if required by your panel).

### Display orientation / splash (optional)

Edit `/boot/firmware/config.txt` if you need rotation or want to hide the splash.
`scripts/setup-pi.sh` already appends `disable_splash=1` and `boot_delay=0`.

For the official 7" DSI panel:

```ini
# Rotate 180° if mounted upside-down (use the Wayland display settings GUI for
# finer control, or a compositor-level transform).
disable_splash=1
```

For an HDMI panel, set `hdmi_*` options as needed for your resolution.

## Provision the kiosk

The whole provisioning flow lives in `scripts/`. Clone the repo, then run the
orchestrator.

```bash
# Clone to the expected path
mkdir -p ~/Documents && cd ~/Documents
git clone <repo-url> kletterhalle-kiosk
cd kletterhalle-kiosk
```

### One command: `setup-pi.sh`

```bash
./scripts/setup-pi.sh
```

This does base provisioning (apt update, Node, `firefox-esr`, `git`, add user to
the `lp` group for the printer, display settings) and then **delegates** to two
focused scripts:

- **`scripts/harden-pi.sh`** — firewall: `ufw` allowing SSH and loopback-only
  `:3000`, nothing else.
- **`scripts/setup-systemd.sh`** — creates stable `/usr/local/bin/{node,npm}`
  symlinks, installs both service units, and adds the labwc autostart hook.

You can also run those two standalone (both are idempotent), e.g. to re-apply
just the systemd setup after a Node upgrade.

> **Node lives under nvm.** This Pi's Node is an **nvm** install
> (`~/.nvm/versions/node/vX.Y.Z/bin`). A systemd unit pointing at `/usr/bin/npm`
> fails with `status=203/EXEC`. `setup-systemd.sh` solves this by symlinking
> `/usr/local/bin/node` and `/usr/local/bin/npm` to whatever Node is currently on
> PATH, and `kletterhalle.service` uses those symlinks plus
> `Environment=PATH=/usr/local/bin:…` (npm's `#!/usr/bin/env node` shebang needs
> `node` on PATH). **On a Node upgrade, just re-run `./scripts/setup-systemd.sh`**
> to re-point the symlinks — the unit never changes.

### Environment file

The Pi keeps its **own** `.env.local` (it is git-ignored and never overwritten by
a deploy). It must contain the live values:

```bash
# ~/Documents/kletterhalle-kiosk/.env.local  (see .env.local.example)
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_TERMINAL_READER_ID=tmr_…          # the physical live reader
NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3000
# …printer config…
```

> `NEXT_PUBLIC_*` variables are baked into the client bundle **at build time**.
> Because the kiosk **builds on the Pi** (next step), the Pi's `.env.local` is
> read during `npm run build`, so `NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3000`
> ends up in the bundle correctly. (`npm run build:kiosk` pins that value
> explicitly regardless of the env file, if you ever build elsewhere.)

### Build & start

```bash
cd ~/Documents/kletterhalle-kiosk
npm ci
npm run build
sudo systemctl restart kletterhalle      # if it wasn't already started by setup-systemd.sh
```

Verify the server:

```bash
curl -sf -o /dev/null http://127.0.0.1:3000 && echo OK
```

Then reboot so the desktop session starts the kiosk browser via the autostart
hook:

```bash
sudo reboot
```

After it comes back (autologin → desktop → labwc autostart), Firefox should open
full-screen on `http://127.0.0.1:3000` on its own.

## Updating the kiosk (deploy)

`scripts/deploy.sh` is the day-to-day update path. It is safe to run over SSH and
disconnect immediately — both services are supervised by systemd.

```bash
cd ~/Documents/kletterhalle-kiosk
./scripts/deploy.sh
```

It runs `git pull`, `npm ci`, `npm run build`, then
`sudo systemctl restart kletterhalle` and
`systemctl --user restart kiosk-browser`.

## Remote access & screen mirroring (testing)

You can watch the **live kiosk screen** from a remote laptop — useful for testing
without standing at the Pi.

### Enable the built-in VNC server (wayvnc)

On Wayland Raspberry Pi OS the built-in VNC server is **wayvnc**, which *mirrors*
the actual running session (you see exactly what's on the kiosk, same Firefox,
same state — it does not create a separate virtual desktop).

```bash
# 0 = enable (raspi-config's nonint flips the logic)
sudo raspi-config nonint do_vnc 0

# confirm it's listening on :5900
ss -tlnp | grep 5900
```

### Connect from your laptop (over Tailscale)

The Pi and laptop are on the same tailnet, so connect a VNC viewer straight to
the Pi's Tailscale name/IP — Tailscale (WireGuard) already encrypts the link, no
SSH tunnel needed:

```
<pi-tailscale-host>:5900
```

- **On a WSL2 laptop:** run the VNC viewer on the **Windows** side (RealVNC
  Viewer / TightVNC). Tailscale almost certainly runs on the Windows host, so
  Windows can already reach the Pi by name; running the viewer inside WSL2 would
  require mirrored networking (`networkingMode=mirrored` in `.wslconfig`) or a
  separate Tailscale node in the distro, plus WSLg for the GUI — more friction
  for no benefit.

### Two caveats

1. **A desktop session must be active** on the Pi's physical screen for there to
   be anything to mirror (the same precondition as the kiosk browser). With
   Desktop Autologin enabled, this is satisfied after boot.
2. **wayvnc mirrors, it doesn't create** an output — you can't get a headless
   desktop this way without an attached display (or a forced-output config).

## Connect & Test Hardware

### USB thermal printer

```bash
# Check the printer node is present
ls -la /dev/usb/lp0

# The user must be in the lp group (setup-pi.sh does this; re-login to apply)
groups | tr ' ' '\n' | grep -x lp || echo "not in lp group yet — re-login"

# Quick raw test
echo "Test print" | tee /dev/usb/lp0
```

### Card reader (server-driven Terminal)

The kiosk drives the WisePOS E through Stripe's cloud (`process_payment_intent`
on the reader). The reader and the kiosk **never talk over the local network** —
the reader only needs working internet (any network). Requirements:

- Reader registered to the account's Terminal location (Dashboard → Terminal →
  Readers) **in the matching mode** (test/live).
- `STRIPE_TERMINAL_READER_ID` set to that reader's `tmr_…` id in the Pi's
  `.env.local`.
- Reader shows "online" in the Dashboard.

There is no same-network, local-DNS, or browser-permission requirement: this
integration replaced the Terminal JS SDK in 2026-06 (see
`docs/superpowers/specs/2026-06-12-server-driven-terminal-design.md`).

To set the reader up: power it on, follow the on-screen WiFi setup (any network
with internet — it does **not** need the Pi's LAN), confirm it shows **online**
in Terminal → Readers in the correct mode, then set `STRIPE_TERMINAL_READER_ID`
to its `tmr_…` id.

#### One-time cleanup on already-provisioned Pis

The old JS SDK integration required two local workarounds — remove them if
present:

```bash
# 1. hosts-file pin for the reader hostname
sudo sed -i '/stripe-terminal-local-reader\.net/d' /etc/hosts
# 2. Firefox local-network policy (if present)
sudo rm -f /etc/firefox/policies/policies.json
```

### Verify the full flow

1. Open (or mirror) the kiosk on `http://127.0.0.1:3000`
2. Add tickets to the cart
3. Run a payment on the card reader
4. Confirm the receipt prints

## Power Loss Recovery

With Desktop Autologin enabled, recovery is automatic:

1. Pi boots to the desktop session
2. `kletterhalle.service` starts the Next.js server (systemd, `multi-user.target`)
3. The labwc autostart hook starts `kiosk-browser.service`, which launches Firefox

Test it:

```bash
sudo reboot
# Wait ~60s; the kiosk should come up on its own.
```

## Troubleshooting

> Many checks below are **user** systemd services. Over SSH you must point at the
> graphical user's manager first:
>
> ```bash
> export XDG_RUNTIME_DIR=/run/user/$(id -u)
> ```

### Server won't start

```bash
systemctl status kletterhalle --no-pager
journalctl -u kletterhalle -n 50 --no-pager
```

- **`status=203/EXEC`** → the `node`/`npm` path is wrong. Re-run
  `./scripts/setup-systemd.sh` to (re)create the `/usr/local/bin/{node,npm}`
  symlinks, then `sudo systemctl restart kletterhalle`.

### Kiosk browser doesn't appear

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user status kiosk-browser --no-pager
journalctl --user -u kiosk-browser -n 50 --no-pager

# Is the autostart hook present?
grep kiosk-browser ~/.config/labwc/autostart || echo "hook missing — re-run setup-systemd.sh"

# Start it manually to test (Firefox should appear on the screen / VNC mirror):
systemctl --user start kiosk-browser
```

- If `inactive (dead)` with **no journal entries** after a desktop login, the
  autostart hook didn't run — confirm the line in `~/.config/labwc/autostart`
  and that the compositor is labwc (`pgrep -x labwc`). On **wayfire**, the hook
  goes in `~/.config/wayfire.ini` under `[autostart]` instead.

### Printer permission denied

```bash
groups                       # check for 'lp'
sudo usermod -a -G lp $USER  # then log out and back in
```

### Display / touch issues (Wayland)

```bash
# Inputs and outputs are managed by libinput/the compositor. Check kernel detection:
dmesg | grep -i -E 'dsi|hdmi|edid'
# Touch is usually plug-and-play on the official panel under Wayland.
```
