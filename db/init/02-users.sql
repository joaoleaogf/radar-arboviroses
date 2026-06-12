-- Plataforma Radar — tabelas de autenticação e preferências de alerta
-- Roda na inicialização (fresh) ou via migration manual no container existente

-- Adiciona coluna regiao ao municipio se ainda não existir
ALTER TABLE municipio ADD COLUMN IF NOT EXISTS regiao text;
CREATE INDEX IF NOT EXISTS idx_municipio_uf    ON municipio (uf);
CREATE INDEX IF NOT EXISTS idx_municipio_regiao ON municipio (regiao);

-- Recria a view com uf/regiao incluídos
DROP VIEW IF EXISTS situacao_atual;
CREATE VIEW situacao_atual AS
SELECT DISTINCT ON (c.geocode, c.doenca)
       c.geocode, m.nome, m.uf, m.regiao, m.pop,
       c.doenca, c.se, c.data_inise,
       c.casos, c.casos_est, c.nivel, c.rt, c.p_inc100k
FROM caso_semana c
JOIN municipio m USING (geocode)
ORDER BY c.geocode, c.doenca, c.se DESC;

-- Usuários da plataforma
CREATE TABLE IF NOT EXISTS app_user (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text UNIQUE NOT NULL,
  name           text NOT NULL,
  password_hash  text,            -- NULL para usuários OAuth
  google_id      text UNIQUE,
  avatar_url     text,
  role           text NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  email_verified boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login     timestamptz
);

-- Assinaturas de alerta por usuário
CREATE TABLE IF NOT EXISTS user_alert_subscription (
  id            serial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  geocode       bigint REFERENCES municipio(geocode),  -- NULL = toda região/UF
  uf            text,                                   -- NULL = todo Brasil
  regiao        text,                                   -- NULL = todo Brasil
  doenca        text NOT NULL DEFAULT 'dengue',
  nivel_minimo  smallint NOT NULL DEFAULT 3,            -- >= 3 (laranja)
  canal         text NOT NULL DEFAULT 'email',
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON user_alert_subscription (user_id);

-- Log de notificações enviadas
CREATE TABLE IF NOT EXISTS notification_log (
  id          serial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES app_user(id),
  geocode     bigint,
  doenca      text,
  nivel       smallint,
  canal       text NOT NULL,
  assunto     text,
  status      text NOT NULL DEFAULT 'sent',   -- 'sent' | 'error'
  enviado_em  timestamptz NOT NULL DEFAULT now()
);
