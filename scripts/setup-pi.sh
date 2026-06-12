#!/bin/bash
#
# Kletterhalle Kiosk - Raspberry Pi Setup Script
#
# Run this script on a fresh Raspberry Pi to configure the kiosk system.
# This script installs dependencies and configures the system.
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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run as root. Run as the pi user."
    exit 1
fi

# Update system
echo "Updating system packages..."
sudo apt update
sudo apt full-upgrade -y
print_status "System updated"

# Install Node.js 20.x
echo ""
echo "Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
NODE_VERSION=$(node --version)
print_status "Node.js installed: $NODE_VERSION"

# Install Firefox and utilities
echo ""
echo "Installing Firefox and utilities..."
sudo apt install -y firefox-esr git vim ufw
print_status "Firefox and utilities installed"

# Configure firewall
echo ""
echo "Configuring firewall..."
sudo ufw --force reset
sudo ufw allow ssh
sudo ufw allow from 127.0.0.1 to any port 3000
sudo ufw --force enable
print_status "Firewall configured"


# Create systemd service
echo ""
echo "Creating systemd service..."
sudo tee /etc/systemd/system/kletterhalle.service > /dev/null << 'EOF'
[Unit]
Description=Kletterhalle Next.js App
After=network.target

[Service]
Type=simple
User=francesco
WorkingDirectory=/home/francesco/Documents/kletterhalle-kiosk
# Loopback only: nothing on the LAN may reach the app (kiosk browser + Stripe redirect are local; WisePOS E is outbound-only)
ExecStart=/usr/bin/npm start -- -H 127.0.0.1
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
print_status "Systemd service created"

# Install kiosk browser user service
echo ""
echo "Installing kiosk browser user service..."
mkdir -p ~/.config/systemd/user
cp ~/Documents/kletterhalle-kiosk/scripts/kiosk-browser.service \
   ~/.config/systemd/user/kiosk-browser.service
systemctl --user daemon-reload
systemctl --user enable kiosk-browser.service
print_status "Kiosk browser user service installed"

# Add user to lp group for printer access
echo ""
echo "Adding user to lp group for printer access..."
sudo usermod -a -G lp $USER
print_status "User added to lp group"

# Configure display settings
echo ""
echo "Configuring display settings..."
if [ -f /boot/firmware/config.txt ]; then
    # Backup original
    sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.backup

    # Add display settings if not present
    if ! grep -q "disable_splash=1" /boot/firmware/config.txt; then
        echo "" | sudo tee -a /boot/firmware/config.txt > /dev/null
        echo "# Kiosk display settings" | sudo tee -a /boot/firmware/config.txt > /dev/null
        echo "disable_splash=1" | sudo tee -a /boot/firmware/config.txt > /dev/null
        echo "boot_delay=0" | sudo tee -a /boot/firmware/config.txt > /dev/null
    fi
    print_status "Display settings configured"
else
    print_warning "config.txt not found, skipping display configuration"
fi

# Reload systemd
sudo systemctl daemon-reload

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Copy your application to ~/Documents/kletterhalle-kiosk/"
echo "   scp -r .next package.json package-lock.json .env.local francesco@raspberrypi.local:~/Documents/kletterhalle-kiosk/"
echo ""
echo "2. Install dependencies:"
echo "   cd ~/Documents/kletterhalle-kiosk && npm install --production"
echo ""
echo "3. Enable and start the services:"
echo "   sudo systemctl enable --now kletterhalle.service"
echo "   systemctl --user enable --now kiosk-browser.service"
echo ""
echo "4. Connect hardware:"
echo "   - USB thermal printer"
echo "   - Stripe WisePOS E card reader (same WiFi)"
echo ""
echo "5. Reboot to test kiosk mode:"
echo "   sudo reboot"
echo ""
print_warning "Note: On first boot, you must log in once at the physical screen"
print_warning "for the kiosk browser to start. The server starts automatically."
