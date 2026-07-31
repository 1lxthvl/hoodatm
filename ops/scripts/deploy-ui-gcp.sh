#!/usr/bin/env bash
set -euo pipefail

# Extract a new /opt/hoodatm release without touching /var/lib/hoodatm or wiping /etc/hoodatm.env.

sudo sha256sum /var/lib/hoodatm/players.json /var/lib/hoodatm/access-codes.json /var/lib/hoodatm/x-tokens.json || true
sudo mkdir -p /var/backups
sudo cp -a /var/lib/hoodatm "/var/backups/hoodatm-$(date -u +%Y%m%dT%H%M%SZ)" || true

sudo systemctl stop hoodatm || true
sudo rm -rf /opt/hoodatm/*
sudo mkdir -p /opt/hoodatm
sudo tar -xf /tmp/hoodatm-deploy.tar -C /opt/hoodatm
if [ -d /opt/hoodatm/standalone ]; then
  sudo mkdir -p /opt/hoodatm/.next
  sudo mv /opt/hoodatm/standalone /opt/hoodatm/.next/standalone
fi
sudo chown -R hoodatm:hoodatm /opt/hoodatm
sudo chmod 750 /opt/hoodatm

sudo systemctl restart hoodatm
sudo systemctl restart nginx
sleep 3
systemctl is-active hoodatm
curl -s -o /dev/null -w 'app:%{http_code}\n' http://127.0.0.1:3000/ || true
curl -s -o /dev/null -w 'site:%{http_code}\n' https://127.0.0.1/ -k || true
sudo sha256sum /var/lib/hoodatm/players.json /var/lib/hoodatm/access-codes.json /var/lib/hoodatm/x-tokens.json || true
sudo journalctl -u hoodatm -n 30 --no-pager || true
echo deploy_ui_done
