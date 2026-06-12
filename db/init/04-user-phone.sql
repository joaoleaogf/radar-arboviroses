-- Adiciona campo de celular ao perfil do usuário
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS phone text;
