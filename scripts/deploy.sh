#!/bin/bash
#
# Kletterhalle Kiosk - Deploy Script
#
# Run this over SSH to update the kiosk to the latest version.
# Both services are handed to systemd, so it's safe to disconnect
# immediately after running this script.
#
# Usage:
#   cd ~/Documents/kletterhalle-kiosk
#   ./scripts/deploy.sh
#

set -euo pipefail

cd ~/Documents/kletterhalle-kiosk

echo "Pulling latest code..."
git pull

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build

echo "Restarting services..."
sudo systemctl restart kletterhalle           # server (system service)
systemctl --user restart kiosk-browser         # browser (user service)

echo ""
echo "Deploy complete. Safe to disconnect — services keep running."
