import { pool } from '../db.js';

export interface AlertJob {
  sub_id: number;
  user_id: string;
  doenca: string;
  nivel_minimo: number;
  email: string;
  name: string;
  geocode: number;
  municipio: string;
  uf: string;
  nivel: number;
  casos_est: number;
  se: number;
}

// Uma linha por assinatura ativa: o município de maior nível que satisfaz os filtros
export async function getAlertJobs(): Promise<AlertJob[]> {
  const { rows } = await pool.query<AlertJob>(`
    SELECT DISTINCT ON (s.id)
           s.id AS sub_id, s.user_id, s.doenca, s.nivel_minimo,
           u.email, u.name,
           sa.geocode, sa.nome AS municipio, sa.uf, sa.nivel, sa.casos_est, sa.se
    FROM user_alert_subscription s
    JOIN app_user u ON u.id = s.user_id
    JOIN situacao_atual sa
      ON sa.doenca = s.doenca
      AND sa.nivel >= s.nivel_minimo
      AND (s.geocode IS NULL OR s.geocode = sa.geocode)
      AND (s.uf IS NULL OR s.uf = sa.uf)
      AND (s.regiao IS NULL OR s.regiao = sa.regiao)
    WHERE s.ativo = true AND s.canal = 'email'
    ORDER BY s.id, sa.nivel DESC
  `);
  return rows;
}
