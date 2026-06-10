#!/bin/bash
#
# Kletterhalle Kiosk Browser Startup Script
# Launches Firefox in kiosk mode pointing to the local Next.js app.
#
# Target: Raspberry Pi OS Desktop on Wayland.
# Launched from ~/.config/autostart/kiosk.desktop or a systemd service.
# (~/.bashrc is NOT read by either, so the display vars are set here.)
#

set -u

URL="http://127.0.0.1:3000"

# Wayland display environment. Already present when launched from the desktop
# session; set explicitly here so a systemd launch also works.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
export MOZ_ENABLE_WAYLAND=1   # run Firefox natively on Wayland, not XWayland

# Wait for the Next.js app to respond (up to ~60s) instead of a blind sleep.
for _ in $(seq 1 30); do
  curl -sf -o /dev/null "$URL" && break
  sleep 2
done

exec firefox --kiosk "$URL"
