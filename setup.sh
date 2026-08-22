#!/usr/bin/env bash
# setup.sh — ExpertBot Live VPS setup script (run ONCE on a fresh Hostinger VPS)
#
# Usage:
#   ssh root@YOUR_VPS_IP
#   git clone https://github.com/YOUR_USERNAME/expertbot-live.git /var/www/expertbot
#   cd /var/www/expertbot
#   chmod +x setup.sh && ./setup.sh
#
# What this does:
#   1. Installs Node.js, Bun, PM2, Nginx
#   2. Installs dependencies (frontend + expert-service)
#   3. Builds the Next.js app
#   4. Pushes the Prisma schema to SQLite
#   5. Configures Nginx as reverse proxy
#   6. Starts both services with PM2 (auto-restart on crash + reboot)
#
# Prerequisites:
#   - Ubuntu 22.04 / 24.04 VPS (Hostinger VPS default)
#   - A domain name pointed to the VPS IP (A record)
#   - Run as root (or sudo)

set -e

echo "================================================"
echo "  ExpertBot Live — VPS Setup"
echo "================================================"

# --- Config (edit these) ---
DOMAIN="your-domain.com"        # ← CHANGE THIS
REPO_DIR="/var/www/expertbot"

cd "$REPO_DIR" || { echo "ERROR: $REPO_DIR not found. Clone the repo first."; exit 1; }

# --- 1. System packages ---
echo "[1/6] Installing system packages..."
apt-get update -y
apt-get install -y curl git nginx ufw

# --- 2. Node.js 20 LTS ---
echo "[2/6] Installing Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version

# --- 3. Bun ---
echo "[3/6] Installing Bun..."
if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  # Persist for all users
  echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
  echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
fi
bun --version

# --- 4. PM2 ---
echo "[4/6] Installing PM2..."
npm install -g pm2
pm2 --version

# --- 5. App dependencies + build ---
echo "[5/6] Installing app dependencies + building..."
cd "$REPO_DIR"
bun install
cd mini-services/expert-service && bun install && cd "$REPO_DIR"

# Build Next.js for production
bun run build

# Push Prisma schema
bun run db:push

# --- 6. Nginx + PM2 ---
echo "[6/6] Configuring Nginx + starting services..."

# Nginx config
sed "s/your-domain.com/$DOMAIN/g" nginx.conf > /etc/nginx/sites-available/expertbot.conf
ln -sf /etc/nginx/sites-available/expertbot.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Create log dir
mkdir -p /var/log/expertbot

# Start with PM2
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -y

# --- Firewall ---
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# --- SSL (Let's Encrypt) ---
echo ""
echo "================================================"
echo "  Setup complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Point your domain ($DOMAIN) A-record to this VPS IP."
echo "  2. Install SSL: sudo certbot --nginx -d $DOMAIN"
echo "  3. Visit https://$DOMAIN"
echo ""
echo "Logs:"
echo "  pm2 logs"
echo "  tail -f /var/log/expertbot/web-out.log"
echo "  tail -f /var/log/expertbot/service-out.log"
echo ""
