#!/bin/bash
#
# Kletterhalle Kiosk - Raspberry Pi Setup (orchestrator)
#
# Run on a fresh Raspberry Pi to provision the kiosk. This script handles the
# base OS provisioning (packages, display, printer access) and then delegates:
#
#   - harden-pi.sh     : firewall hardening
#   - setup-systemd.sh : node/npm symlinks + the two systemd services
#
# Usage:
#   chmod +x setup-pi.sh
#   ./setup-pi.sh
#
# Prerequisites:
#   - Raspberry Pi OS with Desktop (64-bit)
#   - Internet connection
#

set -euo pipefail

echo "=============================================="
echo "  Kletterhalle Kiosk - Raspberry Pi Setup"
echo "=============================================="
echo ""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
print_status()  { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error()   { echo -e "${RED}[✗]${NC} $1"; }

if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run as root. Run as the kiosk user."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- System packages --------------------------------------------------------
echo "Updating system packages..."
sudo apt update
sudo apt full-upgrade -y
print_status "System updated"

# --- Node.js ----------------------------------------------------------------
# Prefer an existing install (incl. nvm) before pulling NodeSource, so we don't
# install a second, conflicting Node on a Pi that already uses nvm.
echo ""
echo "Ensuring Node.js is installed..."
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
print_status "Node.js available: $(node --version)"

# --- Firefox + utilities ----------------------------------------------------
echo ""
echo "Installing Firefox and utilities..."
sudo apt install -y firefox-esr git vim
print_status "Firefox and utilities installed"

# --- Printer access ---------------------------------------------------------
echo ""
echo "Adding user to lp group for printer access..."
sudo usermod -a -G lp "$USER"
print_status "User added to lp group (re-login required to take effect)"

# --- Display settings -------------------------------------------------------
echo ""
echo "Configuring display settings..."
if [ -f /boot/firmware/config.txt ]; then
    sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.backup
    if ! grep -q "disable_splash=1" /boot/firmware/config.txt; then
        {
            echo ""
            echo "# Kiosk display settings"
            echo "disable_splash=1"
            echo "boot_delay=0"
        } | sudo tee -a /boot/firmware/config.txt > /dev/null
    fi
    print_status "Display settings configured"
else
    print_warning "config.txt not found, skipping display configuration"
fi

# --- Hardening (delegated) --------------------------------------------------
echo ""
echo "=== Hardening ==="
"$SCRIPT_DIR/harden-pi.sh"

# --- systemd setup (delegated) ----------------------------------------------
echo ""
echo "=== systemd setup ==="
"$SCRIPT_DIR/setup-systemd.sh"

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Install app dependencies and build:"
echo "   cd ~/Documents/kletterhalle-kiosk && npm ci && npm run build"
echo ""
echo "2. Connect hardware:"
echo "   - USB thermal printer"
echo "   - Stripe WisePOS E card reader (same WiFi)"
echo ""
echo "3. Reboot to test kiosk mode:"
echo "   sudo reboot"
echo ""
print_warning "On first boot, log in once at the physical screen for the kiosk"
print_warning "browser to start. The server (kletterhalle.service) starts on boot."
