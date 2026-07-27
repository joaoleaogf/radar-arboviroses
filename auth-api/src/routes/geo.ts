import type { FastifyInstance, FastifyReply } from 'fastify';
import { pool } from '../db.js';

interface GeoQuery   { doenca: string; uf: string; regiao: string }
interface SerieQuery { doenca: string; geocode: string }

// Cache em memória: os dados só mudam após o ETL semanal (terça), então
// servir do cache tira o Postgres compartilhado do caminho crítico —
// ele também guarda o histórico do n8n, então cada query poupada alivia a VM.
const CACHE_TTL_MS  = Number(process.env.GEO_CACHE_TTL_MS ?? 15 * 60_000); // 15 min
const CACHE_MAX     = Number(process.env.GEO_CACHE_MAX ?? 40);             // teto de entradas (protege a RAM de 1GB)
const cache = new Map<string, { at: number; body: string }>();

function fromCache(key: string): string | undefined {
  const e = cache.get(key);
  if (e && Date.now() - e.at < CACHE_TTL_MS) return e.body;
  if (e) cache.delete(key); // expirada
  return undefined;
}

function toCache(key: string, body: string): void {
  cache.set(key, { at: Date.now(), body });
  // eviction FIFO: Map preserva ordem de inserção
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

function sendCached(reply: FastifyReply, body: string, hit: boolean): FastifyReply {
  reply.header('Content-Type', 'application/json; charset=utf-8');
  // max-age (browser) curto, s-maxage (CDN/Cloudflare) longo, SWR serve stale enquanto revalida
  reply.header('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400');
  reply.header('X-Cache', hit ? 'HIT' : 'MISS');
  return reply.send(body);
}

// regiao não usa enum: os valores vêm do IBGE via WF1
const geoQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    doenca: { type: 'string', enum: ['dengue', 'chikungunya'], default: 'dengue' },
    uf:     { type: 'string', pattern: '^([A-Z]{2}|\\*)$', default: '*' },
    regiao: { type: 'string', maxLength: 40, default: '*' },
  },
};

const serieQuerySchema = {
  type: 'object',
  required: ['geocode'],
  additionalProperties: false,
  properties: {
    geocode: { type: 'string', pattern: '^[0-9]{7}$' },
    doenca:  { type: 'string', enum: ['dengue', 'chikungunya'], default: 'dengue' },
  },
};

export async function geoRoutes(app: FastifyInstance) {
  // GeoJSON dos municípios com última situação epidemiológica
  app.get<{ Querystring: GeoQuery }>('/municipios', { schema: { querystring: geoQuerySchema } }, async (req, reply) => {
    const { doenca, uf, regiao } = req.query;

    const key = `municipios:${doenca}:${uf}:${regiao}`;
    const cachedBody = fromCache(key);
    if (cachedBody !== undefined) return sendCached(reply, cachedBody, true);

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
       LEFT JOIN situacao_atual s ON s.geocode = m.geocode AND s.doenca = $1::text
       WHERE ($2::text = '*' OR m.uf = $2::text)
         AND ($3::text = '*' OR m.regiao = $3::text)`,
      [doenca, uf, regiao],
    );

    const body = rows[0]?.fc ?? '{"type":"FeatureCollection","features":[]}';
    toCache(key, body);
    return sendCached(reply, body, false);
  });

  // Resumo nacional / filtrado
  app.get<{ Querystring: GeoQuery }>('/resumo', { schema: { querystring: geoQuerySchema } }, async (req, reply) => {
    const { doenca, uf, regiao } = req.query;

    const key = `resumo:${doenca}:${uf}:${regiao}`;
    const cachedBody = fromCache(key);
    if (cachedBody !== undefined) return sendCached(reply, cachedBody, true);

    const { rows } = await pool.query<{ payload: string }>(
      `WITH filtro AS (
         SELECT geocode FROM municipio
         WHERE ($2::text = '*' OR uf = $2::text) AND ($3::text = '*' OR regiao = $3::text)
       ),
       semanal AS (
         SELECT c.se, sum(c.casos_est) AS total
         FROM caso_semana c JOIN filtro f ON f.geocode = c.geocode
         WHERE c.doenca = $1::text
         GROUP BY c.se
       ),
       recentes AS (
         SELECT se, total FROM semanal ORDER BY se DESC LIMIT 12
       )
       SELECT jsonb_build_object(
         'doenca', $1::text,
         'municipios',              (SELECT count(*) FROM filtro),
         'em_alerta',               (SELECT count(*) FROM situacao_atual s JOIN filtro f ON f.geocode = s.geocode WHERE s.doenca = $1::text AND s.nivel >= 3),
         'casos_est_ultima_semana', (SELECT COALESCE(sum(s.casos_est), 0) FROM situacao_atual s JOIN filtro f ON f.geocode = s.geocode WHERE s.doenca = $1::text),
         'ultima_se',               (SELECT max(se) FROM caso_semana WHERE doenca = $1::text),
         'ultima_carga',            (SELECT max(finished) FROM etl_run WHERE status = 'success'),
         'serie_recente', (
           SELECT COALESCE(jsonb_agg(jsonb_build_object('se', se, 'casos_est', total) ORDER BY se), '[]'::jsonb)
           FROM recentes
         ),
         'top_alertas', (
           SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
             SELECT s.geocode, s.nome, s.nivel, s.casos_est, s.rt
             FROM situacao_atual s JOIN filtro f ON f.geocode = s.geocode
             WHERE s.doenca = $1::text
             ORDER BY s.nivel DESC, s.casos_est DESC NULLS LAST LIMIT 5
           ) t
         )
       )::text AS payload`,
      [doenca, uf, regiao],
    );

    const body = rows[0]?.payload ?? 'null';
    toCache(key, body);
    return sendCached(reply, body, false);
  });

  // Série histórica de um município
  app.get<{ Querystring: SerieQuery }>('/serie', { schema: { querystring: serieQuerySchema } }, async (req, reply) => {
    const { doenca, geocode } = req.query;

    const key = `serie:${doenca}:${geocode}`;
    const cachedBody = fromCache(key);
    if (cachedBody !== undefined) return sendCached(reply, cachedBody, true);

    const { rows } = await pool.query<{ payload: string }>(
      `SELECT jsonb_build_object(
         'geocode', $1::bigint,
         'doenca', $2::text,
         'nome', (SELECT nome FROM municipio WHERE geocode = $1::bigint),
         'serie', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'se', se, 'data', data_inise, 'casos', casos, 'casos_est', casos_est,
             'nivel', nivel, 'rt', rt, 'p_inc100k', p_inc100k
           ) ORDER BY se)
           FROM caso_semana WHERE geocode = $1::bigint AND doenca = $2::text
         ), '[]'::jsonb)
       )::text AS payload`,
      [geocode, doenca],
    );

    const body = rows[0]?.payload ?? 'null';
    toCache(key, body);
    return sendCached(reply, body, false);
  });
}
