import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function geoRoutes(app: FastifyInstance) {
  // GeoJSON dos municípios com última situação epidemiológica
  app.get('/municipios', async (req: any, reply) => {
    const { doenca = 'dengue', uf = '*', regiao = '*' } = req.query as Record<string, string>;

    const { rows } = await pool.query<{ fc: string }>(
      `SELECT jsonb_build_object(
         'type', 'FeatureCollection',
         'features', COALESCE(jsonb_agg(jsonb_build_object(
           'type', 'Feature',
           'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(m.geom,0.05),2)::jsonb,
           'properties', jsonb_build_object(
             'geocode', m.geocode, 'nome', m.nome, 'uf', m.uf, 'regiao', m.regiao, 'pop', m.pop,
             'se', s.se, 'casos', s.casos, 'casos_est', s.casos_est,
             'nivel', s.nivel, 'rt', s.rt, 'p_inc100k', s.p_inc100k
           )
         )), '[]'::jsonb)
       )::text AS fc
       FROM municipio m
       LEFT JOIN situacao_atual s ON s.geocode = m.geocode AND s.doenca = $1
       WHERE ($2 = '*' OR m.uf = $2)
         AND ($3 = '*' OR m.regiao = $3)`,
      [doenca, uf, regiao],
    );

    reply.header('Content-Type', 'application/json; charset=utf-8');
    return reply.send(rows[0]?.fc ?? '{"type":"FeatureCollection","features":[]}');
  });

  // Resumo nacional / filtrado
  app.get('/resumo', async (req: any, reply) => {
    const { doenca = 'dengue', uf = '*', regiao = '*' } = req.query as Record<string, string>;

    const { rows } = await pool.query<{ payload: string }>(
      `WITH filtro AS (
         SELECT geocode FROM municipio
         WHERE ($2 = '*' OR uf = $2) AND ($3 = '*' OR regiao = $3)
       )
       SELECT jsonb_build_object(
         'doenca', $1,
         'municipios',              (SELECT count(*) FROM filtro),
         'em_alerta',               (SELECT count(*) FROM situacao_atual s JOIN filtro f ON f.geocode = s.geocode WHERE s.doenca = $1 AND s.nivel >= 3),
         'casos_est_ultima_semana', (SELECT COALESCE(sum(s.casos_est), 0) FROM situacao_atual s JOIN filtro f ON f.geocode = s.geocode WHERE s.doenca = $1),
         'ultima_se',               (SELECT max(se) FROM caso_semana WHERE doenca = $1),
         'ultima_carga',            (SELECT max(finished) FROM etl_run WHERE status = 'success'),
         'top_alertas', (
           SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
             SELECT s.geocode, s.nome, s.nivel, s.casos_est, s.rt
             FROM situacao_atual s JOIN filtro f ON f.geocode = s.geocode
             WHERE s.doenca = $1
             ORDER BY s.nivel DESC, s.casos_est DESC NULLS LAST LIMIT 5
           ) t
         )
       )::text AS payload`,
      [doenca, uf, regiao],
    );

    reply.header('Content-Type', 'application/json; charset=utf-8');
    return reply.send(rows[0]?.payload ?? 'null');
  });

  // Série histórica de um município
  app.get('/serie', async (req: any, reply) => {
    const { doenca = 'dengue', geocode } = req.query as Record<string, string>;
    if (!geocode) return reply.code(400).send({ error: 'geocode obrigatório' });

    const { rows } = await pool.query<{ payload: string }>(
      `SELECT jsonb_build_object(
         'geocode', $1::bigint,
         'doenca', $2,
         'nome', (SELECT nome FROM municipio WHERE geocode = $1::bigint),
         'serie', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'se', se, 'data', data_inise, 'casos', casos, 'casos_est', casos_est,
             'nivel', nivel, 'rt', rt, 'p_inc100k', p_inc100k
           ) ORDER BY se)
           FROM caso_semana WHERE geocode = $1::bigint AND doenca = $2
         ), '[]'::jsonb)
       )::text AS payload`,
      [geocode, doenca],
    );

    reply.header('Content-Type', 'application/json; charset=utf-8');
    return reply.send(rows[0]?.payload ?? 'null');
  });
}
