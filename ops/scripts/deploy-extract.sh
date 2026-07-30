#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=/etc/hoodatm.env

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo: sudo bash deploy-extract.sh"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<'ENV'
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=3000
HOODATM_APP_URL=https://hoodatm.online
HOODATM_PLAYER_LOG_PATH=/var/lib/hoodatm/players.json
HOODATM_ACCESS_CODE_LOG_PATH=/var/lib/hoodatm/access-codes.json
HOODATM_X_TOKEN_LOG_PATH=/var/lib/hoodatm/x-tokens.json
HOODATM_RESOLVER_STATE_PATH=/var/lib/hoodatm/resolver-actions.json
HOODATM_SESSION_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=
ENV
fi

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

set_env_value NODE_ENV production
set_env_value HOSTNAME 127.0.0.1
set_env_value PORT 3000
set_env_value HOODATM_APP_URL https://hoodatm.online
set_env_value HOODATM_PLAYER_LOG_PATH /var/lib/hoodatm/players.json
set_env_value HOODATM_ACCESS_CODE_LOG_PATH /var/lib/hoodatm/access-codes.json
set_env_value HOODATM_X_TOKEN_LOG_PATH /var/lib/hoodatm/x-tokens.json
set_env_value HOODATM_RESOLVER_STATE_PATH /var/lib/hoodatm/resolver-actions.json

chmod 640 "$ENV_FILE"
chown root:hoodatm "$ENV_FILE"

for required_key in HOODATM_SESSION_SECRET X_CLIENT_ID X_CLIENT_SECRET; do
  if ! grep -q "^${required_key}=." "$ENV_FILE"; then
    echo "Missing required ${required_key} in ${ENV_FILE}; refusing to deploy."
    exit 1
  fi
done

systemctl stop hoodatm || true
rm -rf /opt/hoodatm/*
mkdir -p /opt/hoodatm/.next
tar -xf /tmp/hoodatm-deploy.tar -C /opt/hoodatm
if [ -d /opt/hoodatm/standalone ]; then
  mv /opt/hoodatm/standalone /opt/hoodatm/.next/standalone
fi
chown -R hoodatm:hoodatm /opt/hoodatm
ls -la /opt/hoodatm
ls -la /opt/hoodatm/.next/standalone | head
systemctl restart hoodatm
systemctl restart nginx
sleep 2
systemctl is-active hoodatm
curl -s -o /dev/null -w "app:%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "nginx:%{http_code}\n" http://127.0.0.1/
journalctl -u hoodatm -n 40 --no-pager
