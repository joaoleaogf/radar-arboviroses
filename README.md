# Radar de Arboviroses — Sul de Minas

> Pipeline de dados **orquestrado em n8n** que monitora **dengue e chikungunya** nos municípios da mesorregião Sul/Sudoeste de Minas: coleta semanal do InfoDengue, mapa de alerta interativo, alertas no Telegram e um **agente de IA** que responde sobre os dados em linguagem natural.

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

- 🗺️ **Mapa coroplético** (Leaflet) dos ~146 municípios do Sul de Minas, colorido pelo nível de alerta do InfoDengue (verde → vermelho).
- 📈 **Série histórica** por município (Highcharts) ao clicar no mapa.
- 🔔 **Alertas no Telegram** quando um município entra em nível laranja/vermelho (com deduplicação).
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
| **WF1** `sync-municipios` | manual · mensal | Baixa a lista de municípios de MG (IBGE), filtra a mesorregião Sul/Sudoeste, busca a malha GeoJSON e faz upsert das geometrias no PostGIS. |
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

1. **WF1 — Sync Municípios** → popula `municipio` com geometrias (~146 linhas).
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
├── db/init/01-schema.sql      # schema PostGIS (municipio, caso_semana, etl_run, alerta_enviado, view situacao_atual)
├── n8n/workflows/*.json       # os 5 workflows, versionados
├── scripts/setup.sh           # import automatizado de credenciais + workflows
└── dashboard/                 # Angular 21 (standalone, signals, zoneless) + Leaflet + Highcharts
```

## Stack

`n8n` · `PostgreSQL/PostGIS` · `Angular 21` · `Leaflet` · `Highcharts` · `Google Gemini (AI Agent)` · `Telegram Bot` · `Docker Compose` · `TypeScript`

## Roadmap

- [ ] Deploy em VPS (n8n + Postgres atrás de HTTPS) e dashboard na Vercel
- [ ] Expandir para todo o estado de MG / Brasil
- [ ] Incluir zika e outras arboviroses
- [ ] Canal WhatsApp além do Telegram

## Licença

[MIT](LICENSE) © João Leão — Itajubá, MG
