#!/usr/bin/env bash
set -euo pipefail

# Usage: ./get_company_urls.sh user@host
# Récupère toutes les companies avec apiKey et génère les URLs d'ingest.

HOST="${1:-}"
BASE_URL="https://react.jipeg-corporation.eu/api/ingest"
BACKEND_DIR="/var/www/devv4/dev/backend"

if [[ -z "$HOST" ]]; then
  echo "Usage: $0 user@host" >&2
  exit 1
fi

data=$(ssh "$HOST" "cd $BACKEND_DIR && node -" << 'JSEOF'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
p.company.findMany({
  where: { apiKey: { not: null } },
  select: { id: true, name: true, apiKey: true, isApiActive: true },
  orderBy: { name: 'asc' }
}).then(cs => {
  cs.forEach(c => {
    process.stdout.write(c.name + '\t' + c.id + '\t' + c.apiKey + '\t' + (c.isApiActive ? 'active' : 'inactive') + '\n');
  });
  return p.$disconnect();
}).catch(e => { console.error(e); process.exit(1); });
JSEOF
)

printf '\n'
while IFS=$'\t' read -r name id apikey status; do
  [[ -z "$name" ]] && continue
  label="$name"
  [[ "$status" == "inactive" ]] && label="$name [INACTIVE]"
  printf '%s\n  %s/%s/%s\n\n' "$label" "$BASE_URL" "$id" "$apikey"
done <<< "$data"
