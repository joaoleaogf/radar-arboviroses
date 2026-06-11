-- Radar de Arboviroses — Sul de Minas
-- Schema de dados do pipeline (o n8n usa o schema "n8n" separado, criado por ele mesmo)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE SCHEMA IF NOT EXISTS n8n;

CREATE TABLE municipio (
  geocode      bigint PRIMARY KEY,          -- código IBGE de 7 dígitos
  nome         text NOT NULL,
  uf           text NOT NULL DEFAULT 'MG',
  mesorregiao  text,
  pop          integer,                     -- preenchido pelo ETL InfoDengue
  geom         geometry(MultiPolygon, 4326),
  centroid     geometry(Point, 4326)
);

CREATE INDEX municipio_geom_gist ON municipio USING gist (geom);

CREATE TABLE caso_semana (
  geocode           bigint NOT NULL REFERENCES municipio (geocode),
  doenca            text   NOT NULL,        -- 'dengue' | 'chikungunya'
  se                integer NOT NULL,       -- semana epidemiológica AAAASS
  data_inise        date,
  casos             integer,
  casos_est         numeric,
  nivel             smallint,               -- 1 verde · 2 amarelo · 3 laranja · 4 vermelho
  rt                numeric,
  p_inc100k         numeric,
  tempmed           numeric,
  umidmed           numeric,
  notif_accum_year  integer,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geocode, doenca, se)
);

CREATE INDEX caso_semana_doenca_se ON caso_semana (doenca, se DESC);

CREATE TABLE etl_run (
  id         serial PRIMARY KEY,
  workflow   text NOT NULL,
  started    timestamptz NOT NULL DEFAULT now(),
  finished   timestamptz,
  status     text NOT NULL DEFAULT 'running',  -- running | success | error
  registros  integer,
  erro       text
);

CREATE TABLE alerta_enviado (
  geocode     bigint NOT NULL,
  doenca      text   NOT NULL,
  se          integer NOT NULL,
  nivel       smallint NOT NULL,
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geocode, doenca, se)
);

-- View usada pela API (WF4) e pelo agente (WF5): última semana disponível por município/doença
CREATE VIEW situacao_atual AS
SELECT DISTINCT ON (c.geocode, c.doenca)
       c.geocode, m.nome, m.pop, c.doenca, c.se, c.data_inise,
       c.casos, c.casos_est, c.nivel, c.rt, c.p_inc100k
FROM caso_semana c
JOIN municipio m USING (geocode)
ORDER BY c.geocode, c.doenca, c.se DESC;
