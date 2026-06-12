#!/bin/bash
#
# Kletterhalle Kiosk - systemd Setup
#
# Installs the two services that run the kiosk:
#   - kletterhalle.service   (system) : the Next.js server, loopback-only
#   - kiosk-browser.service  (user)   : Firefox in kiosk mode, tied to the
#                                       graphical session
#
# It first creates stable /usr/local/bin/{node,npm} symlinks pointing at the
# Node currently on PATH (nvm or system). The units reference those symlinks
# rather than a version-specific nvm path, so a Node upgrade only requires
# re-running this script (it re-points the symlinks); the units never change.
#
# Safe to run standalone or via setup-pi.sh. Idempotent.
#
# Usage:
#   ./scripts/setup-systemd.sh
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Resolve node/npm and create stable symlinks ----------------------------
echo "Resolving Node toolchain..."
# nvm is not loaded in a non-interactive shell; source it if that's the install.
if ! command -v node >/dev/null 2>&1; then
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"
if [ -z "$NODE_BIN" ] || [ -z "$NPM_BIN" ]; then
    print_error "node/npm not found. Install Node (or load nvm) before running this."
    exit 1
fi

sudo ln -sf "$NODE_BIN" /usr/local/bin/node
sudo ln -sf "$NPM_BIN"  /usr/local/bin/npm
print_status "Symlinked /usr/local/bin/node -> $NODE_BIN"
print_status "Symlinked /usr/local/bin/npm  -> $NPM_BIN"

# --- System service: the Next.js server -------------------------------------
echo ""
echo "Installing kletterhalle.service (system)..."
sudo cp "$SCRIPT_DIR/kletterhalle.service" /etc/systemd/system/kletterhalle.service
sudo systemctl daemon-reload
print_status "kletterhalle.service installed"

# --- User service: the kiosk browser ----------------------------------------
# The browser unit is NOT enabled into a target: Raspberry Pi OS's Wayland
# session never activates graphical-session.target. Instead the compositor's
# autostart launches it once the Wayland socket is up. We install the unit (so
# `systemctl --user start/restart/status kiosk-browser` and Restart=always
# work) and add the autostart hook that triggers it on session start.
echo ""
echo "Installing kiosk-browser.service (user)..."
mkdir -p ~/.config/systemd/user
cp "$SCRIPT_DIR/kiosk-browser.service" ~/.config/systemd/user/kiosk-browser.service
systemctl --user daemon-reload
print_status "kiosk-browser.service installed"

echo ""
echo "Adding compositor autostart hook..."
AUTOSTART_LINE='systemctl --user start kiosk-browser.service &'
if pgrep -x wayfire >/dev/null 2>&1; then
    print_warning "wayfire detected. Add to [autostart] in ~/.config/wayfire.ini:"
    print_warning "    kiosk = systemctl --user start kiosk-browser.service"
else
    # labwc (Raspberry Pi OS default): autostart is a shell script it sources.
    mkdir -p ~/.config/labwc
    if grep -qF kiosk-browser ~/.config/labwc/autostart 2>/dev/null; then
        print_status "labwc autostart hook already present"
    else
        echo "$AUTOSTART_LINE" >> ~/.config/labwc/autostart
        print_status "labwc autostart hook added to ~/.config/labwc/autostart"
    fi
fi

# --- Enable + start the server ----------------------------------------------
echo ""
echo "Enabling and starting kletterhalle.service..."
sudo systemctl enable --now kletterhalle.service
print_status "kletterhalle.service enabled and started"

echo ""
print_status "systemd setup complete."
print_warning "The kiosk browser is launched by the compositor autostart hook, so it"
print_warning "starts when the desktop session loads (log in at the physical screen,"
print_warning "or enable autologin). Server is up now —"
print_warning "verify with: curl -sf -o /dev/null http://127.0.0.1:3000 && echo OK"
