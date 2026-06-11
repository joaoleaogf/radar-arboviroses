#!/usr/bin/env bash
# Importa credenciais e workflows no n8n a partir do .env.
# Pré-requisito: `docker compose up -d` já rodando e .env preenchido.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "❌ Crie o .env a partir do .env.example"; exit 1; }
set -a; source .env; set +a

CRED_FILE="n8n/credentials/generated.json"

echo "→ Gerando credenciais a partir do .env (arquivo é gitignored)…"
cat > "$CRED_FILE" <<JSON
[
  {
    "id": "radarpg01",
    "name": "Radar Postgres",
    "type": "postgres",
    "data": {
      "host": "db", "port": 5432, "database": "${POSTGRES_DB:-radar}",
      "user": "${POSTGRES_USER:-radar}", "password": "${POSTGRES_PASSWORD}",
      "ssl": "disable"
    }
  },
  {
    "id": "radartg01",
    "name": "Radar Telegram Bot",
    "type": "telegramApi",
    "data": { "accessToken": "${TELEGRAM_BOT_TOKEN:-}", "baseUrl": "https://api.telegram.org" }
  },
  {
    "id": "radargm01",
    "name": "Radar Gemini",
    "type": "googlePalmApi",
    "data": { "host": "https://generativelanguage.googleapis.com", "apiKey": "${GEMINI_API_KEY:-}" }
  }
]
JSON

echo "→ Importando credenciais no n8n…"
docker compose exec -T n8n n8n import:credentials --input=/credentials/generated.json

echo "→ Importando workflows no n8n…"
docker compose exec -T n8n n8n import:workflow --separate --input=/workflows

echo "✅ Pronto. Abra http://localhost:5678 e ative os workflows."
echo "   Em seguida rode o backfill: WF1 (municípios) e depois WF2 (ETL) manualmente."
