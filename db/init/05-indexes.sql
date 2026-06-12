-- Índices de FK para consultas por usuário
-- Fresh install: roda automaticamente via docker-entrypoint-initdb.d
-- Banco existente (prod): aplicar manualmente — ver seção "Operações" no README

CREATE INDEX IF NOT EXISTS idx_notification_log_user    ON notification_log (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_enviado ON notification_log (enviado_em DESC);
