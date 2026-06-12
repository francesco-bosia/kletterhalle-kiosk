#!/bin/bash
#
# Kletterhalle Kiosk - Host Hardening
#
# Configures the firewall so the kiosk only exposes SSH. The Next.js app
# binds to loopback (see kletterhalle.service), so it is never reachable from
# the LAN; the WisePOS E reader is outbound-only.
#
# Safe to run standalone or via setup-pi.sh. Idempotent.
#
# Usage:
#   ./scripts/harden-pi.sh
#

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
print_status()  { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error()   { echo -e "${RED}[✗]${NC} $1"; }

if [ "$EUID" -eq 0 ]; then
    print_error "Do not run as root. Run as the kiosk user (sudo is invoked where needed)."
    exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
    echo "Installing ufw..."
    sudo apt install -y ufw
fi

echo "Configuring firewall..."
sudo ufw --force reset
sudo ufw allow ssh
# Loopback-only app: only 127.0.0.1 may reach the Next.js port.
sudo ufw allow from 127.0.0.1 to any port 3000
sudo ufw --force enable
print_status "Firewall configured (SSH allowed; port 3000 loopback-only)"

echo ""
sudo ufw status verbose
