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

set -e

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

# Install Chromium and tools
echo ""
echo "Installing Chromium and utilities..."
sudo apt install -y chromium-browser git vim ufw unclutter
print_status "Chromium and utilities installed"

# Configure firewall
echo ""
echo "Configuring firewall..."
sudo ufw --force reset
sudo ufw allow ssh
sudo ufw allow from 127.0.0.1 to any port 3000
sudo ufw --force enable
print_status "Firewall configured"

# Create kiosk directories
echo ""
echo "Creating kiosk directories..."
mkdir -p ~/kiosk
mkdir -p ~/kletterhalle-kiosk
mkdir -p ~/.config/autostart
print_status "Directories created"

# Create kiosk script
echo ""
echo "Creating kiosk startup script..."
cat > ~/kiosk/kiosk.sh << 'EOF'
#!/bin/bash
# Wait for Next.js to start
sleep 10

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

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
EOF
chmod +x ~/kiosk/kiosk.sh
print_status "Kiosk script created"

# Create autostart desktop entry
echo ""
echo "Creating autostart entry..."
cat > ~/.config/autostart/kiosk.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=/home/pi/kiosk/kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
print_status "Autostart entry created"

# Create systemd service
echo ""
echo "Creating systemd service..."
sudo tee /etc/systemd/system/kletterhalle.service > /dev/null << 'EOF'
[Unit]
Description=Kletterhalle Next.js App
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/kletterhalle-kiosk
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
print_status "Systemd service created"

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
echo "1. Copy your application to ~/kletterhalle-kiosk/"
echo "   scp -r .next package.json package-lock.json .env.local pi@raspberrypi.local:~/kletterhalle-kiosk/"
echo ""
echo "2. Install dependencies:"
echo "   cd ~/kletterhalle-kiosk && npm install --production"
echo ""
echo "3. Enable and start the service:"
echo "   sudo systemctl enable kletterhalle.service"
echo "   sudo systemctl start kletterhalle.service"
echo ""
echo "4. Connect hardware:"
echo "   - USB thermal printer"
echo "   - Stripe WisePOS E card reader (same WiFi)"
echo ""
echo "5. Reboot to test kiosk mode:"
echo "   sudo reboot"
echo ""
print_warning "Note: You need to log out and back in for group changes to take effect."
