-- Adiciona campos extras à tabela de assinaturas (frequência e Rt mínimo)
ALTER TABLE user_alert_subscription
  ADD COLUMN IF NOT EXISTS frequencia text NOT NULL DEFAULT 'imediato',
  ADD COLUMN IF NOT EXISTS rt_minimo  numeric(4,2);
