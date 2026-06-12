# Deploy do Dashboard — radar.joaoleao.fun

## Arquitetura final

```
radar.joaoleao.fun   → Cloudflare Pages (Angular SPA)
api.joaoleao.fun     → Oracle VM : 3001 (auth-api via Nginx)
n8n.joaoleao.fun     → Oracle VM : 5678 (n8n via Nginx)
joaoleao.fun         → Vercel (portfólio — não mexe)
```

---

## 1. Deploy no Cloudflare Pages

1. Acesse **[pages.cloudflare.com](https://pages.cloudflare.com)** → **Create a project** → **Connect to Git**
2. Selecione o repositório `radar-arboviroses`
3. Configure o build:

| Campo | Valor |
|-------|-------|
| **Framework preset** | Angular |
| **Build command** | `npm run build` |
| **Build output directory** | `dist/dashboard/browser` |
| **Root directory** | `dashboard` |
| **Node.js version** | `20` |

> Não precisa de variáveis de ambiente — as URLs já estão compiladas via `environment.prod.ts`.

4. Clique em **Save and Deploy**. Você vai receber uma URL como `radar-arboviroses.pages.dev`.

---

## 2. Domínio customizado no Cloudflare Pages

No projeto do Cloudflare Pages → **Custom domains** → **Add custom domain**:

- Digite `radar.joaoleao.fun` e confirme

O Cloudflare vai te pedir para adicionar um registro **CNAME** no seu registrador:

| Tipo | Nome | Destino |
|------|------|---------|
| CNAME | `radar` | `radar-arboviroses.pages.dev` |

---

## 3. Registros DNS no seu registrador (para o Oracle VM)

Depois de criar a VM Oracle e anotar o **IP público** dela, adicione no seu registrador:

| Tipo | Nome | Destino |
|------|------|---------|
| `A` | `api` | `IP_DA_VM_ORACLE` |
| `A` | `n8n` | `IP_DA_VM_ORACLE` |
| `CNAME` | `radar` | `radar-arboviroses.pages.dev` |

---

## 4. Setup do Oracle VM

Crie a VM no console Oracle Cloud (Ubuntu 22.04, ARM Ampere A1, 2 OCPU + 4 GB RAM),
pegue o IP público e rode:

```bash
bash deploy/setup-oracle.sh joaoleao.fun joaoleao.gf@gmail.com
```

O script instala Docker, Nginx, Certbot, sobe os containers e configura SSL
para `api.joaoleao.fun` e `n8n.joaoleao.fun` automaticamente.

**Atenção Oracle — abrir portas no console:**
Networking → Virtual Cloud Networks → Security Lists → Ingress Rules:
- TCP porta 80  (HTTP)
- TCP porta 443 (HTTPS)

---

## Checklist pós-deploy

- [ ] `https://radar.joaoleao.fun` carrega o dashboard
- [ ] `https://api.joaoleao.fun/health` responde (ou qualquer rota da auth-api)
- [ ] Login/registro funciona
- [ ] Gráficos carregam (n8n webhooks em `https://n8n.joaoleao.fun/webhook/...`)
- [ ] `https://joaoleao.fun` (portfólio) continua funcionando normalmente
