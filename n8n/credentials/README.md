# Credenciais do n8n

Os workflows referenciam 3 credenciais por **ID fixo**. Crie-as no n8n com exatamente estes IDs/nomes (Settings → Credentials), ou rode o script de bootstrap (ver `../../README.md`). As credenciais **não** são versionadas — apenas esta referência.

| ID         | Nome                | Tipo                  | Campos |
|------------|---------------------|-----------------------|--------|
| `radarpg01`| Radar Postgres      | Postgres              | Host `db` · Port `5432` · Database `radar` · User/Senha do `.env` |
| `radartg01`| Radar Telegram Bot  | Telegram API          | Access Token do @BotFather (`TELEGRAM_BOT_TOKEN`) |
| `radargm01`| Radar Gemini        | Google Gemini (PaLM)  | API Key do Google AI Studio (`GEMINI_API_KEY`) |

> Dica: o tipo da credencial do Gemini no n8n aparece como **"Google Gemini(PaLM) Api"** (`googlePalmApi`).
