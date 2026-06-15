# Radar de Arboviroses — Brasil

> Pipeline de dados **orquestrado em n8n** que monitora **dengue e chikungunya** nos municípios de **todo o Brasil**: coleta semanal do InfoDengue, dashboard com mapa de alerta interativo e séries históricas, alertas por e-mail (contas de usuário) e no Telegram, e um **agente de IA** que responde sobre os dados em linguagem natural.

![n8n](https://img.shields.io/badge/n8n-orquestração-EA4B71?logo=n8n&logoColor=white)
![PostGIS](https://img.shields.io/badge/PostGIS-16--3.4-336791?logo=postgresql&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![Highcharts](https://img.shields.io/badge/Highcharts-charts-8087E8)
![Leaflet](https://img.shields.io/badge/Leaflet-maps-199900?logo=leaflet&logoColor=white)
![Gemini](https://img.shields.io/badge/AI%20Agent-Gemini-4285F4?logo=googlegemini&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-E0A458)

---

## Visão geral

Um único `docker compose up` sobe **n8n + PostGIS**. O n8n é o protagonista: ele agenda, coleta, trata, alerta, serve a API e conversa. O dashboard Angular e o bot do Telegram são só as pontas visíveis.

- 🗺️ **Mapa coroplético** (Leaflet) dos municípios de todo o Brasil, navegável por região → UF e colorido pelo nível de alerta do InfoDengue (verde → vermelho) ou por incidência/100k.
- 📈 **Série histórica** por município (Highcharts) ao clicar no mapa, com Rt, casos estimados/confirmados e perfil de risco do recorte.
- 🌗 **Dashboard Angular** com tema claro/escuro, layout responsivo e visões compartilháveis por URL.
- 🔔 **Alertas por e-mail** para usuários inscritos e **no Telegram** quando um município entra em nível laranja/vermelho (com deduplicação).
- 🤖 **Agente de IA** (Gemini) no Telegram que responde perguntas como *"como está a dengue em Itajubá?"* consultando o banco via ferramentas SQL parametrizadas.
- ♻️ ETL **idempotente** (upsert por semana epidemiológica), com log de execução, throttle e retry.

## Arquitetura

```
                          ┌──────────────────── n8n ────────────────────┐
   IBGE (malhas/munis) ──▶│ WF1 sync-municipios ─┐                       │
                          │                       ▼                      │
   InfoDengue (semanal) ─▶│ WF2 etl-infodengue ─▶ PostGIS ◀── WF4 api ──▶│──▶ Dashboard Angular
                          │                       │  ▲          (webhooks)│      (Leaflet + Highcharts)
                          │ WF3 alertas ──────────┘  │                    │
                          │   └─▶ Telegram           │                    │
                          │ WF5 ai-agent ◀── tools SQL┘                   │
                          │   └─▶ Telegram (Gemini)                       │
                          └───────────────────────────────────────────────┘
```

| Workflow | Gatilho | O que faz |
|---|---|---|
| **WF1** `sync-municipios` | manual · mensal | Percorre as 27 UFs (IBGE), baixa a lista de municípios e a malha GeoJSON de cada estado e faz upsert das geometrias (com UF/região) no PostGIS. |
| **WF2** `etl-infodengue` | manual · terça 08h | Para cada município × {dengue, chikungunya}, coleta do InfoDengue desde 2024, normaliza e faz upsert em `caso_semana`. Throttle ~5 req/s, retry com backoff, log em `etl_run`. |
| **WF3** `alertas` | terça 09h | Notifica no Telegram municípios que entraram em nível ≥ 3 e ainda não foram alertados (dedupe em `alerta_enviado`). |
| **WF4** `api` | webhooks GET | Serve a API do dashboard: `/municipios` (GeoJSON), `/serie`, `/resumo`. |
| **WF5** `ai-agent` | Telegram | Agente Gemini com 4 ferramentas SQL parametrizadas (buscar município, situação, ranking, resumo) + memória por chat. |

## Fontes de dados

- **InfoDengue** (Fiocruz/FGV) — `https://info.dengue.mat.br/api/alertcity` · casos estimados/confirmados, nível de alerta, Rt, incidência, clima, por semana epidemiológica.
- **IBGE** — lista de municípios e malhas territoriais (GeoJSON).

> Os dados são **públicos e agregados por município** — não há dado pessoal envolvido. O nível de alerta segue a metodologia do InfoDengue (1 verde, 2 amarelo, 3 laranja, 4 vermelho).

## Como rodar

### 1. Subir a infraestrutura

```bash
cp .env.example .env        # preencha as variáveis (veja abaixo)
docker compose up -d        # sobe n8n (localhost:5678) + PostGIS (localhost:5433)
```

### 2. Importar credenciais e workflows

```bash
./scripts/setup.sh          # gera credenciais a partir do .env e importa tudo no n8n
```

Abra `http://localhost:5678`, **crie a conta owner** na tela de primeiro acesso, confira que os 5 workflows foram importados e **ative-os pelo toggle** (a ativação pela UI é o que registra os webhooks da API — ativar só por CLI não basta). WF3/WF5 só ativam depois de preencher Telegram/Gemini no `.env`.

> Os nós de webhook já vêm com `webhookId` fixo no JSON — sem isso o n8n registra o webhook num path interno errado e a API responde 404.

### 3. Carregar os dados

No n8n, execute manualmente, nesta ordem:

1. **WF1 — Sync Municípios** → popula `municipio` com as geometrias dos municípios das 27 UFs (IBGE).
2. **WF2 — ETL InfoDengue** → popula `caso_semana` (backfill desde 2024; leva alguns minutos).

### 4. Subir o dashboard

```bash
cd dashboard
npm install
npm start                   # http://localhost:4200
```

### Variáveis do `.env`

| Variável | Para quê |
|---|---|
| `POSTGRES_USER/PASSWORD/DB` | Banco PostGIS (e persistência do n8n). |
| `N8N_ENCRYPTION_KEY` | Criptografia das credenciais do n8n (`openssl rand -hex 24`). |
| `TELEGRAM_BOT_TOKEN` · `TELEGRAM_ALERT_CHAT_ID` | Bot dos alertas e do agente (crie no [@BotFather](https://t.me/botfather)). |
| `GEMINI_API_KEY` | Agente de IA — free tier no [Google AI Studio](https://aistudio.google.com/apikey). |

> WF3 (alertas) e WF5 (agente) só funcionam após preencher Telegram/Gemini. O ETL, a API e o dashboard funcionam sem eles.

## Estrutura

```
radar-arboviroses/
├── docker-compose.yml        # n8n + postgis
├── db/init/*.sql              # schema PostGIS + migrations (municipio, caso_semana, etl_run, alerta_enviado, usuários/inscrições)
├── n8n/workflows/*.json       # os 5 workflows, versionados
├── scripts/setup.sh           # import automatizado de credenciais + workflows
├── auth-api/                  # API de contas, inscrições e disparo de alertas por e-mail (Node + Fastify, testes Vitest)
└── dashboard/                 # Angular 21 (standalone, signals, zoneless) + Leaflet + Highcharts · tema claro/escuro
```

## Stack

`n8n` · `PostgreSQL/PostGIS` · `Node + Fastify (auth-api)` · `Angular 21` · `Leaflet` · `Highcharts` · `Google Gemini (AI Agent)` · `Telegram Bot` · `Docker Compose` · `TypeScript`

## Operações

### Testes e CI

```bash
cd auth-api
npm ci
npm run typecheck   # tsc --noEmit (src + test)
npm test            # vitest (rotas com pool mockado)
npm run build       # compila para dist/
```

O GitHub Actions (`.github/workflows/ci.yml`) roda typecheck, testes, build e `npm audit` do auth-api (Node 20) e o build do dashboard (Node 22) em todo push para `main`/`feature/plataforma-saude` e pull request.

### Deploy contínuo (VM Oracle)

Após os testes passarem num push, o job `deploy` conecta na VM (152.70.214.49) via SSH, atualiza a branch `deploy` em `/opt/radar` para o commit pushado e reconstrói o `auth-api`. Em seguida valida `https://api.joaoleao.fun/health`.

Requisito: secret `DEPLOY_SSH_KEY` no repositório (chave privada cujo par público está no `~/.ssh/authorized_keys` do usuário `ubuntu` na VM). Sem o secret, o job é pulado com aviso. O dashboard é publicado automaticamente pelo Cloudflare Pages (integração git própria). Migrations de banco (`db/init/0N-*.sql`) seguem manuais — ver seção acima.

### Rotação de segredos (JWT_SECRET / INTERNAL_SECRET)

O `docker compose up` falha se `JWT_SECRET` ou `INTERNAL_SECRET` estiverem ausentes do `.env` — é proposital (fail-fast, sem defaults previsíveis). Para gerar/rotacionar:

```bash
openssl rand -hex 32   # gere um valor para cada segredo
```

1. Edite o `.env` (`/opt/radar-arboviroses/.env` na VM) com os novos valores.
2. Se rotacionar o `INTERNAL_SECRET`, atualize **na mesma janela** o header `x-internal-secret` usado pelo n8n (WF5) na chamada a `/notify/dispatch`.
3. `docker compose up -d auth-api`.
4. Rotação do `JWT_SECRET` invalida as sessões ativas — os usuários precisam logar de novo.

### Topologia de produção (2 VMs Oracle free)

- **VM apps** (152.70.214.49): nginx + auth-api + n8n — domínios api/n8n.joaoleao.fun
- **VM banco** (136.248.114.235 / interna 10.0.0.169): Postgres/PostGIS na porta 5433

As VMs se falam pela rede privada da VCN (10.0.0.0/24). A Security List precisa de uma regra de ingress TCP 5433 com origem 10.0.0.0/24. O `.env` da VM de apps define `DB_HOST`/`DB_PORT`; sem essas vars o compose usa o container local `db` (dev: `docker compose --profile db up -d` — sem o `depends_on`, o n8n pode reiniciar 1–2× até o Postgres ficar pronto).

### Migrations em banco existente

Os scripts `db/init/0N-*.sql` só rodam automaticamente em instalação nova (volume vazio). Em banco já provisionado, aplique manualmente — todos são idempotentes (`IF NOT EXISTS`):

```bash
docker exec -i radar-db psql -U radar -d radar < db/init/05-indexes.sql
```

## Roadmap

- [x] Deploy em produção (n8n + auth-api atrás de HTTPS na Oracle Cloud, dashboard no Cloudflare Pages)
- [x] Expandir a cobertura para todo o Brasil (27 UFs)
- [x] Contas de usuário e alertas por e-mail
- [ ] Incluir zika e outras arboviroses
- [ ] Canal WhatsApp além do Telegram

## Licença

[MIT](LICENSE) © João Leão — Itajubá, MG
