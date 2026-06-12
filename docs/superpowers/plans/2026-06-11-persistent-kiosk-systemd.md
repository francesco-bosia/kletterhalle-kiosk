# Persistent Kiosk via systemd — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Next.js server and Firefox kiosk run as systemd services so they survive SSH logout and auto-start on boot/desktop-login.

**Architecture:** Two systemd units — a system service (`kletterhalle.service`) for the Next.js app, and a user service (`kiosk-browser.service`) for the Firefox kiosk. The browser self-synchronizes by polling the server URL.

**Tech Stack:** systemd, bash, Raspberry Pi OS (Wayland), Firefox, Next.js

---

## Task 1: Update `scripts/kletterhalle.service` for correct user/path

**Files:**
- Modify: `scripts/kletterhalle.service`

- [ ] **Step 1: Update User and WorkingDirectory to francesco/Documents**

Replace the entire file content:

```ini
[Unit]
Description=Kletterhalle Next.js App
Documentation=https://github.com/your-org/kletterhalle-kiosk
After=network.target

[Service]
Type=simple
User=francesco
WorkingDirectory=/home/francesco/Documents/kletterhalle-kiosk
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kletterhalle

[Install]
WantedBy=multi-user.target
```

Key changes from the original:
- `User=francesco` (was `pi`)
- `WorkingDirectory=/home/francesco/Documents/kletterhalle-kiosk` (was `/home/pi/kletterhalle-kiosk`)
- Kept `WantedBy=multi-user.target` so it starts on boot before any graphical login

- [ ] **Step 2: Verify the change**

Run: `cat scripts/kletterhalle.service | grep -E "(User|WorkingDirectory)"`

Expected output:
```
User=francesco
WorkingDirectory=/home/francesco/Documents/kletterhalle-kiosk
```

- [ ] **Step 3: Commit**

```bash
git add scripts/kletterhalle.service
git commit -m "fix: update kletterhalle.service user/path for francesco/Documents"
```

---

## Task 2: Rewrite `scripts/kiosk-browser.service` as user service (Wayland)

**Files:**
- Modify: `scripts/kiosk-browser.service`

- [ ] **Step 1: Replace with user service form**

The current file is written as an X11 system service (`DISPLAY=:0`). Replace entirely with a Wayland user service:

```ini
[Unit]
Description=Kletterhalle Kiosk Browser
Documentation=https://github.com/your-org/kletterhalle-kiosk
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=%h/Documents/kletterhalle-kiosk/scripts/kiosk.sh
Restart=always
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kiosk-browser

[Install]
WantedBy=graphical-session.target
```

Key differences from the original:
- Removed `User=pi` (user services run as the invoking user)
- Removed `Environment=DISPLAY=:0` (Wayland uses `XDG_RUNTIME_DIR`/`WAYLAND_DISPLAY`, which `kiosk.sh` already exports)
- Removed `Requires=kletterhalle.service` (user services can't cleanly require system services; `kiosk.sh` polls the server anyway)
- Changed `WantedBy=graphical.target` to `WantedBy=graphical-session.target` (user services track the session, not the seat)
- Added `PartOf=graphical-session.target` so the browser stops when the session ends
- ExecStart uses `%h` (resolves to the user's home) so the unit is username-agnostic
- Removed `After=graphical.target kletterhalle.service` (replaced with `After=graphical-session.target`)

- [ ] **Step 2: Verify the change**

Run: `cat scripts/kiosk-browser.service | grep -E "(After|ExecStart|WantedBy)"`

Expected output:
```
After=graphical-session.target
ExecStart=%h/Documents/kletterhalle-kiosk/scripts/kiosk.sh
WantedBy=graphical-session.target
```

- [ ] **Step 3: Commit**

```bash
git add scripts/kiosk-browser.service
git commit -m "fix: rewrite kiosk-browser.service as Wayland user service"
```

---

## Task 3: Create `scripts/deploy.sh` for remote updates

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Write deploy.sh**

Create a new script that pulls, builds, and restarts both services:

```bash
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
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/deploy.sh`

- [ ] **Step 3: Verify syntax**

Run: `bash -n scripts/deploy.sh`

Expected: no output (syntactically valid)

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: add deploy.sh for remote updates that survive disconnect"
```

---

## Task 4: Clean up `scripts/setup-pi.sh` (remove Chromium/autostart, add user service)

**Files:**
- Modify: `scripts/setup-pi.sh`

- [ ] **Step 1: Remove the stale ~/kiosk/kiosk.sh heredoc block**

Find and remove the block that looks like this (around line 95-115):

```bash
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
```

Delete all of it. The repo's `scripts/kiosk.sh` (Firefox/Wayland) is the single source of truth.

- [ ] **Step 2: Remove the ~/.config/autostart/kiosk.desktop block**

Find and remove the block that looks like this (around line 115-125):

```bash
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
```

Delete all of it. The systemd user service replaces autostart.

- [ ] **Step 3: Remove the mkdir -p ~/kiosk line**

Find and remove this line (around line 85):

```bash
mkdir -p ~/kiosk
```

The `~/kiosk` directory is no longer needed.

- [ ] **Step 4: Update the systemd service creation block to use correct path**

Find the `kletterhalle.service` heredoc block (around line 125-145) and update it:

Before:
```ini
WorkingDirectory=/home/pi/kletterhalle-kiosk
```

After:
```ini
WorkingDirectory=/home/francesco/Documents/kletterhalle-kiosk
```

Also update `User=pi` to `User=francesco`.

The full block should read:

```bash
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
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
print_status "Systemd service created"
```

- [ ] **Step 5: Add the kiosk-browser user service installation block**

After the `kletterhalle.service` block, add:

```bash
# Install kiosk browser user service
echo ""
echo "Installing kiosk browser user service..."
mkdir -p ~/.config/systemd/user
cp ~/Documents/kletterhalle-kiosk/scripts/kiosk-browser.service \
   ~/.config/systemd/user/kiosk-browser.service
systemctl --user daemon-reload
systemctl --user enable kiosk-browser.service
print_status "Kiosk browser user service installed"
```

- [ ] **Step 6: Update the final "Next steps" output**

Find the "Next steps" section (near the end) and update the instructions:

Before:
```bash
echo "3. Enable and start the service:"
echo "   sudo systemctl enable kletterhalle.service"
echo "   sudo systemctl start kletterhalle.service"
```

After:
```bash
echo "3. Enable and start the services:"
echo "   sudo systemctl enable --now kletterhalle.service"
echo "   systemctl --user enable --now kiosk-browser.service"
```

Also add a note about the password requirement:

```bash
print_warning "Note: On first boot, you must log in once at the physical screen"
print_warning "for the kiosk browser to start. The server starts automatically."
```

- [ ] **Step 7: Verify the script syntax**

Run: `bash -n scripts/setup-pi.sh`

Expected: no output

- [ ] **Step 8: Commit**

```bash
git add scripts/setup-pi.sh
git commit -m "fix: remove stale Chromium/autostart, add user service setup"
```

---

## Task 5: Update spec status and commit plan

**Files:**
- Modify: `docs/superpowers/specs/2026-06-11-persistent-kiosk-systemd-design.md`
- Create: `docs/superpowers/plans/2026-06-11-persistent-kiosk-systemd.md`

- [ ] **Step 1: Update spec status**

Edit the spec's status line:

Before:
```markdown
**Status:** Approved (pending spec review)
```

After:
```markdown
**Status:** Approved — plan written
```

- [ ] **Step 2: Commit spec update**

```bash
git add docs/superpowers/specs/2026-06-11-persistent-kiosk-systemd-design.md
git commit -m "docs: mark persistent kiosk spec as approved"
```

- [ ] **Step 3: Add and commit this plan**

```bash
git add docs/superpowers/plans/2026-06-11-persistent-kiosk-systemd.md
git commit -m "docs: add implementation plan for persistent kiosk via systemd"
```

---

## Post-implementation testing (on the Raspberry Pi)

These steps are performed on the Pi after running `setup-pi.sh`:

1. **Verify server starts on boot:**
   ```bash
   sudo systemctl enable --now kletterhalle.service
   curl http://127.0.0.1:3000
   ```
   Should return the app HTML. Reboot and verify it responds before any login.

2. **Verify browser starts on physical login:**
   ```bash
   systemctl --user enable --now kiosk-browser.service
   ```
   Log in at the physical screen → Firefox should open in kiosk mode on the attached display.

3. **Verify browser auto-restart:**
   ```bash
   pkill firefox
   ```
   Firefox should relaunch within ~5 seconds.

4. **Verify deploy.sh:**
   ```bash
   ./scripts/deploy.sh
   # Then disconnect SSH immediately
   ```
   Both services should remain running, kiosk should reflect the new build.

5. **Check logs:**
   ```bash
   journalctl --user -u kiosk-browser
   sudo journalctl -u kletterhalle
   ```

Both should show service logs without errors.
