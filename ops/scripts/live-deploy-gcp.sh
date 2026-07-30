#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=/etc/hoodatm.env
TOKEN_FILE=/tmp/hoodatm-resolver-token.txt
TOKEN="$(cat "$TOKEN_FILE")"

sudo sha256sum /var/lib/hoodatm/players.json /var/lib/hoodatm/access-codes.json /var/lib/hoodatm/x-tokens.json || true
sudo mkdir -p /var/backups
sudo cp -a /var/lib/hoodatm "/var/backups/hoodatm-$(date -u +%Y%m%dT%H%M%SZ)" || true

upsert() {
  local key="$1"
  local value="$2"
  if sudo grep -q "^${key}=" "$ENV_FILE"; then
    sudo sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" | sudo tee -a "$ENV_FILE" >/dev/null
  fi
}

upsert HOODATM_RESOLVER_URL 'http://127.0.0.1:8787/resolve'
upsert HOODATM_RESOLVER_API_TOKEN "$TOKEN"
upsert HOODATM_RESOLVER_STATE_PATH '/var/lib/hoodatm/resolver-actions.json'

sudo systemctl stop hoodatm || true
sudo rm -rf /opt/hoodatm/*
sudo mkdir -p /opt/hoodatm
sudo tar -xf /tmp/hoodatm-deploy.tar -C /opt/hoodatm
sudo chown -R hoodatm:hoodatm /opt/hoodatm
sudo touch /var/lib/hoodatm/resolver-actions.json
sudo chown hoodatm:hoodatm /var/lib/hoodatm/resolver-actions.json
sudo chmod 600 /var/lib/hoodatm/resolver-actions.json
sudo chmod 750 /var/lib/hoodatm

# Ensure service ExecStart uses /opt/hoodatm/server.js
if ! grep -q 'WorkingDirectory=/opt/hoodatm' /etc/systemd/system/hoodatm.service 2>/dev/null; then
  true
fi

sudo systemctl daemon-reload
sudo systemctl restart randomness-resolver
sudo systemctl restart hoodatm
sudo systemctl restart nginx
sleep 3
systemctl is-active hoodatm
systemctl is-active randomness-resolver
curl -s -o /dev/null -w 'app:%{http_code}\n' http://127.0.0.1:3000/ || true
curl -s -o /dev/null -w 'site:%{http_code}\n' https://127.0.0.1/ -k || true
sudo sha256sum /var/lib/hoodatm/players.json /var/lib/hoodatm/access-codes.json /var/lib/hoodatm/x-tokens.json || true
sudo journalctl -u hoodatm -n 40 --no-pager || true
shred -u "$TOKEN_FILE" 2>/dev/null || rm -f "$TOKEN_FILE"
rm -f /tmp/hoodatm-deploy.tar
echo deploy_live_done
