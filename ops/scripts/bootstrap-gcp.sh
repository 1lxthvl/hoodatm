#!/usr/bin/env bash
# Bootstrap hoodATM runtime on Ubuntu (GCP / VPS).
# Does not deploy app secrets or source — only Node, nginx, users, dirs.
set -euo pipefail

NODE_VERSION="24.18.0"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo: sudo bash bootstrap-gcp.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx ufw

# Node 24 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

node -v
npm -v

id -u hoodatm >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/hoodatm --shell /usr/sbin/nologin hoodatm

mkdir -p /opt/hoodatm /var/lib/hoodatm /etc/hoodatm
chown -R hoodatm:hoodatm /opt/hoodatm /var/lib/hoodatm
chmod 750 /var/lib/hoodatm

if [[ ! -f /etc/hoodatm.env ]]; then
  cat >/etc/hoodatm.env <<'EOF'
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=3000
HOODATM_APP_URL=https://hoodatm.online
HOODATM_PLAYER_LOG_PATH=/var/lib/hoodatm/players.json
HOODATM_ACCESS_CODE_LOG_PATH=/var/lib/hoodatm/access-codes.json
HOODATM_X_TOKEN_LOG_PATH=/var/lib/hoodatm/x-tokens.json
HOODATM_RESOLVER_STATE_PATH=/var/lib/hoodatm/resolver-actions.json
NEXT_PUBLIC_GAME_LIVE=false
EOF
  chmod 640 /etc/hoodatm.env
  chown root:hoodatm /etc/hoodatm.env
fi

# Symlink node for systemd unit that expects /usr/local/bin/node
if [[ ! -x /usr/local/bin/node ]]; then
  ln -sf "$(command -v node)" /usr/local/bin/node
fi

cat >/etc/systemd/system/hoodatm.service <<'EOF'
[Unit]
Description=HoodATM Next.js application
After=network.target

[Service]
Type=simple
User=hoodatm
Group=hoodatm
WorkingDirectory=/opt/hoodatm
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
EnvironmentFile=-/etc/hoodatm.env
ExecStart=/usr/local/bin/node /opt/hoodatm/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/nginx/sites-available/hoodatm <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name hoodatm.online www.hoodatm.online _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sfn /etc/nginx/sites-available/hoodatm /etc/nginx/sites-enabled/hoodatm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

systemctl daemon-reload
systemctl enable hoodatm.service

echo
echo "Bootstrap complete."
echo "Node: $(node -v)"
echo "Next: deploy app into /opt/hoodatm and fill /etc/hoodatm.env secrets."
echo "Then: systemctl restart hoodatm"
