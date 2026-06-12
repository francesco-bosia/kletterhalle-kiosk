# Raspberry Pi Kiosk Setup

Complete guide for setting up the Kletterhalle Kiosk on a Raspberry Pi 5.

## Hardware Assembly

### Raspberry Pi 5 + Official 7" Touch Display

1. Connect the DSI ribbon cable from display to Pi's DSI port (between USB-C power and mini HDMI)
2. Connect display power cable to Pi's GPIO header (pins 2, 6 for 5V and GND)
3. Mount Pi to back of display using included screws
4. Insert microSD card

### Alternative: External HDMI Touch Display

- Use HDMI cable to connect display
- USB cable from display to Pi for touch input

## Install Raspberry Pi OS

### Step 1: Flash OS to microSD

On your laptop:

```bash
# Download Raspberry Pi Imager from: https://www.raspberrypi.com/software/
# Or use dd on Linux:

# Insert microSD, find device
lsblk

# Flash Raspberry Pi OS with Desktop (64-bit)
# Download from: https://www.raspberrypi.com/software/operating-systems/
sudo dd if=2024-xx-xx-raspios-bookworm-arm64.img of=/dev/sdX bs=4M status=progress conv=fsync
```

### Step 2: Enable SSH (headless setup)

Create empty file on boot partition:

```bash
touch /boot/ssh
```

### Step 3: Configure WiFi (headless)

Create `/boot/wpa_supplicant.conf`:

```conf
country=CH
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="YOUR_WIFI_NAME"
    psk="YOUR_WIFI_PASSWORD"
}
```

## First Boot & Display Setup

### Step 1: Connect via SSH

```bash
ssh pi@raspberrypi.local
# Default password: raspberry
```

### Step 2: Update System

```bash
sudo apt update && sudo apt full-upgrade -y
sudo raspi-config
```

### Step 3: Configure Display in raspi-config

Navigate the menu:

1. `3 Interface Options` > `I2C` > Enable (for touch)
2. `3 Interface Options` > `SPI` > Enable (for some displays)
3. `2 Display Options` > `VNC Resolution` > Set to display resolution
4. `1 System Options` > `Boot / Auto Login` > `Desktop Autologin`

### Step 4: Configure Display (Official 7" DSI)

Edit `/boot/firmware/config.txt`:

```bash
sudo nano /boot/firmware/config.txt
```

Add/modify:

```ini
# Display settings
display_lcd_rotate=2          # Rotate 180° if needed (0, 1, 2, 3)
lcd_framerate=60
disable_splash=1              # Disable rainbow splash
```

### Step 5: Configure Display (HDMI Touch Display)

Edit `/boot/firmware/config.txt`:

```ini
# Force HDMI output
hdmi_force_hotplug=1
hdmi_drive=2                  # Force HDMI mode

# Set resolution (adjust to your display)
hdmi_group=2
hdmi_mode=82                  # 1920x1080 @ 60Hz

# Rotate display if needed
display_hdmi_rotate=2         # 0=0, 1=90, 2=180, 3=270
```

### Step 6: Calibrate Touch

```bash
# Install touchscreen calibration tool
sudo apt install xinput-calibrator

# Run calibration from desktop
xinput_calibrator

# Follow on-screen instructions
# Save output to: /etc/X11/xorg.conf.d/99-calibration.conf
```

### Step 7: Reboot and Verify

```bash
sudo reboot
```

## Install Node.js & Dependencies

```bash
# Install Node.js 20.x (required for Next.js 16)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node --version   # Should be v20.x.x
npm --version

# Install Chromium for kiosk mode
sudo apt install -y chromium-browser

# Install other useful tools
sudo apt install -y git vim ufw unclutter
```

## Configure Firewall

```bash
# Allow SSH (for maintenance)
sudo ufw allow ssh

# Allow local access only (kiosk runs locally)
sudo ufw allow from 127.0.0.1 to any port 3000

# Enable firewall
sudo ufw enable
```

## Deploy Application

### Step 1: Create Kiosk User (optional)

```bash
sudo useradd -m -s /bin/bash kiosk
sudo usermod -a -G lp kiosk      # Printer access
sudo usermod -a -G netdev kiosk  # WiFi access
```

### Step 2: Transfer Application

On your laptop:

> **IMPORTANT:** `NEXT_PUBLIC_*` variables are baked into the JavaScript bundle
> at build time — the Pi's `.env.local` has **no effect** on them at runtime.
> Always build with `npm run build:kiosk` (which sets the kiosk's client-side
> values explicitly); a plain `npm run build` produces a bundle with your
> laptop's dev settings (Terminal simulator mode) regardless of what the Pi's
> env file says.

```bash
# Build the application with the kiosk's client-side env baked in
npm run build:kiosk

# Copy to Raspberry Pi (NOT .env.local — the Pi keeps its own, with the
# live Stripe key and printer config; don't overwrite it with dev settings)
scp -r .next package.json package-lock.json pi@raspberrypi.local:~/kletterhalle-kiosk/

# Or use rsync for updates:
rsync -avz --exclude 'node_modules' --exclude '.env.local' ./ pi@raspberrypi.local:~/kletterhalle-kiosk/
```

### Step 3: Install Dependencies on Pi

```bash
cd ~/kletterhalle-kiosk
npm install --production
```

## Configure Kiosk Mode

### Step 1: Create Kiosk Script

```bash
mkdir -p ~/kiosk
nano ~/kiosk/kiosk.sh
```

Paste:

```bash
#!/bin/bash
# Wait for Next.js to start
sleep 10

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide cursor (optional - uncomment if desired)
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
  http://localhost:3000
```

### Step 2: Make Executable

```bash
chmod +x ~/kiosk/kiosk.sh
```

### Step 3: Auto-start on Desktop Login

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk.desktop
```

Paste:

```ini
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=/home/pi/kiosk/kiosk.sh
X-GNOME-Autostart-enabled=true
```

## Create Systemd Services

### Step 1: Next.js Application Service

```bash
sudo nano /etc/systemd/system/kletterhalle.service
```

Paste:

```ini
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
```

### Step 2: Enable Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable kletterhalle.service
sudo systemctl start kletterhalle.service

# Check status
sudo systemctl status kletterhalle.service
```

### Step 3: Verify

```bash
curl http://localhost:3000
```

## Connect & Test Hardware

### Step 1: Connect USB Printer

```bash
# Check printer is detected
ls -la /dev/usb/lp0

# Add user to lp group
sudo usermod -a -G lp $USER
# Log out and back in

# Test printer
echo "Test print" | sudo tee /dev/usb/lp0
```

### Step 2: Connect WisePOS E to WiFi

1. Power on the reader
2. Follow on-screen WiFi setup
3. Connect to same network as Raspberry Pi

### Step 3: Verify Full Flow

1. Open browser to `http://localhost:3000`
2. Add tickets to cart
3. Test payment with card reader
4. Verify receipt prints

## Power Loss Recovery

The system automatically:

1. Boots to desktop (configured in raspi-config)
2. Starts Next.js service (systemd)
3. Launches kiosk browser (autostart desktop entry)

Test recovery:

```bash
sudo reboot
# Wait ~60 seconds for full boot
# Kiosk should be running automatically
```

## Troubleshooting

### Display not working

```bash
# Check display is detected
tvservice -s
# Or for DSI
dmesg | grep -i dsi
```

### Touch not working

```bash
# List input devices
xinput list
# Check calibration
cat /etc/X11/xorg.conf.d/99-calibration.conf
```

### Application not starting

```bash
# Check service status
sudo systemctl status kletterhalle.service

# View logs
journalctl -u kletterhalle.service -f
```

### Printer permission denied

```bash
# Check groups
groups

# Add to lp group if missing
sudo usermod -a -G lp $USER
# Log out and back in
```
