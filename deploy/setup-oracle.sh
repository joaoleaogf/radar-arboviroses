#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Setup Oracle Cloud ARM VM — Ubuntu 22.04
# Uso: bash setup-oracle.sh SEU_DOMINIO seu-email@exemplo.com
#
# O que faz:
#   1. Atualiza o sistema
#   2. Instala Docker + Docker Compose v2
#   3. Instala Nginx + Certbot
#   4. Abre as portas no firewall do SO (Oracle também exige abrir no console)
#   5. Clona o repositório
#   6. Configura Nginx e SSL
#   7. Sobe os containers
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMINIO="${1:?Informe o domínio: bash setup-oracle.sh meusite.com email@ex.com}"
EMAIL="${2:?Informe o e-mail para o Certbot}"
REPO="https://github.com/joaoleaogf/radar-arboviroses.git"
APP_DIR="/opt/radar-arboviroses"

echo "==> [1/7] Atualizando sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y

echo "==> [2/7] Instalando Docker..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"

echo "==> [3/7] Instalando Nginx + Certbot..."
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "==> [4/7] Abrindo portas no firewall do SO..."
# Oracle Cloud usa iptables por padrão — regras persistidas via iptables-persistent
sudo apt-get install -y iptables-persistent
sudo iptables -I INPUT -p tcp --dport 80   -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443  -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 3001 -j DROP   # auth-api só via Nginx
sudo iptables -I INPUT -p tcp --dport 5678 -j DROP   # n8n só via Nginx
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null

echo "==> [5/7] Clonando repositório em $APP_DIR..."
sudo git clone "$REPO" "$APP_DIR" || (cd "$APP_DIR" && sudo git pull)
sudo chown -R "$USER":"$USER" "$APP_DIR"
cd "$APP_DIR"

echo "--- Gerando segredos e criando .env..."
JWT=$(openssl rand -hex 32)
N8N_KEY=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 16)
INTERNAL=$(openssl rand -hex 16)

cat > .env <<EOF
POSTGRES_USER=radar
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=radar

JWT_SECRET=${JWT}
N8N_ENCRYPTION_KEY=${N8N_KEY}
INTERNAL_SECRET=${INTERNAL}

CORS_ORIGIN=https://${DOMINIO}
FRONTEND_URL=https://${DOMINIO}
API_BASE_URL=https://api.${DOMINIO}

RESEND_API_KEY=
EMAIL_FROM=noreply@${DOMINIO}
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALERT_CHAT_ID=
GEMINI_API_KEY=
EOF
echo "    .env criado (guarde as senhas geradas!)"
cat .env | grep -E "POSTGRES_PASSWORD|JWT_SECRET|N8N_ENCRYPTION_KEY"

echo "==> [6/7] Configurando Nginx e SSL..."
# Copia config substituindo o domínio
sed "s/SEU_DOMINIO/${DOMINIO}/g" deploy/nginx.conf \
  | sudo tee /etc/nginx/sites-available/radar > /dev/null
sudo ln -sf /etc/nginx/sites-available/radar /etc/nginx/sites-enabled/radar
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Obtém certificados SSL (Let's Encrypt)
sudo certbot --nginx \
  -d "api.${DOMINIO}" \
  -d "n8n.${DOMINIO}" \
  --non-interactive --agree-tos -m "$EMAIL"

sudo systemctl enable --now certbot.timer

echo "==> [7/7] Subindo containers..."
docker compose pull
docker compose up -d --build

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "   auth-api → https://api.${DOMINIO}"
echo "   n8n      → https://n8n.${DOMINIO}"
echo ""
echo "⚠️  Lembre-se de abrir as portas 80 e 443 no console Oracle Cloud:"
echo "   Networking → Virtual Cloud Networks → Security Lists → Ingress Rules"
echo ""
echo "⚠️  Atualize environment.prod.ts no dashboard com os domínios acima"
echo "   e faça o deploy no Cloudflare Pages."
