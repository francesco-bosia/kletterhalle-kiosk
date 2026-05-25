#!/bin/bash
#
# Kletterhalle Kiosk Browser Startup Script
# Launches Chromium in kiosk mode pointing to the local Next.js app
#
# Installation:
#   1. Copy to ~/kiosk/kiosk.sh
#   2. chmod +x ~/kiosk/kiosk.sh
#   3. Add to autostart via ~/.config/autostart/kiosk.desktop
#

# Wait for Next.js to start
sleep 10

# Disable screen blanking and power management
xset s off         # Disable screen saver
xset -dpms         # Disable DPMS (Display Power Management)
xset s noblank     # Don't blank screen

# Hide cursor when idle (uncomment if desired)
# Requires: sudo apt install unclutter
# unclutter -idle 0.1 &

# Start Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --disable-restore-session-state \
  --no-first-run \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --noerrdialogs \
  --check-for-update-interval=31536000 \
  --touch-events=enabled \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  http://localhost:3000
