#!/usr/bin/env bash
# Source-based, no-vendor-lock-in installation. Never prints secrets or deletes volumes.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
envfile="$root/deployment/self-host/.env"
address="${1:-localhost}"
if [[ ! "$address" =~ ^[a-zA-Z0-9.-]+$ ]]; then echo 'Use a domain name without a scheme or path.' >&2; exit 1; fi
if [[ ! -e "$envfile" ]]; then
 umask 077
 if [[ "$address" == localhost ]]; then hostaddress=':80'; origin='http://localhost:8080'; httpport=8080; httpsport=8443; else hostaddress="$address"; origin="https://$address"; httpport=80; httpsport=443; fi
 {
  echo "GRAPHDONE_ADDRESS=$hostaddress"
  echo "PUBLIC_ORIGIN=$origin"
  echo "HTTP_PORT=$httpport"
  echo "HTTPS_PORT=$httpsport"
  echo 'ADMIN_EMAIL=admin@graphdone.local'
  echo "ADMIN_PASSWORD=$(openssl rand -hex 24)"
  echo "NEO4J_PASSWORD=$(openssl rand -hex 24)"
  echo "JWT_SECRET=$(openssl rand -hex 32)"
  echo "SESSION_SECRET=$(openssl rand -hex 32)"
 } > "$envfile"
 chmod 600 "$envfile"
fi
if [[ "${GRAPHDONE_SETUP_ONLY:-0}" != 1 ]]; then
 docker compose --env-file "$envfile" -f "$root/deployment/self-host/compose.yml" up -d --build
fi
echo 'GraphDone configuration is ready. Username: admin.'
echo "Retrieve ADMIN_PASSWORD and PUBLIC_ORIGIN from $envfile. Keep that file private and backed up."
