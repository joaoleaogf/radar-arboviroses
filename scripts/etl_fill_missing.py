#!/usr/bin/env python3
"""
Preenche caso_semana para municípios sem dados (Sul, Centro-Oeste, Sudeste parcial).
Usa a mesma API InfoDengue do workflow n8n wf2-etl-infodengue.
"""

import os, sys, time, json, logging
import requests
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

DB_URL = os.getenv('DATABASE_URL', 'postgresql://radar:radar@localhost:5433/radar')
INFODENGUE_URL = 'https://info.dengue.mat.br/api/alertcity'
DISEASES = ['dengue', 'chikungunya']
EY_START = 2024
EY_END   = 2026
BATCH_SIZE  = 5    # municípios simultâneos
BATCH_DELAY = 1.2  # segundos entre lotes


def get_missing_geocodes(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT m.geocode, m.nome, m.uf, m.regiao
            FROM municipio m
            WHERE NOT EXISTS (
                SELECT 1 FROM caso_semana cs WHERE cs.geocode = m.geocode
            )
            ORDER BY m.regiao, m.geocode
        """)
        rows = cur.fetchall()
    return rows


def fetch_infodengue(geocode, disease):
    params = dict(
        geocode=geocode, disease=disease, format='json',
        ew_start=1, ew_end=53, ey_start=EY_START, ey_end=EY_END,
    )
    try:
        r = requests.get(INFODENGUE_URL, params=params, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning(f"  {geocode}/{disease} erro: {e}")
        return []


def upsert_rows(conn, rows):
    if not rows:
        return 0
    sql = """
        INSERT INTO caso_semana
          (geocode, doenca, se, data_inise, casos, casos_est, nivel, rt,
           p_inc100k, tempmed, umidmed, notif_accum_year, updated_at)
        VALUES %s
        ON CONFLICT (geocode, doenca, se) DO UPDATE SET
          casos=EXCLUDED.casos, casos_est=EXCLUDED.casos_est,
          nivel=EXCLUDED.nivel, rt=EXCLUDED.rt,
          p_inc100k=EXCLUDED.p_inc100k, tempmed=EXCLUDED.tempmed,
          umidmed=EXCLUDED.umidmed,
          notif_accum_year=EXCLUDED.notif_accum_year,
          updated_at=EXCLUDED.updated_at
    """
    vals = [(
        r['geocode'], r['doenca'], r['se'], r['data_inise'],
        r.get('casos'), r.get('casos_est'), r.get('nivel'), r.get('rt'),
        r.get('p_inc100k'), r.get('tempmed'), r.get('umidmed'),
        r.get('notif_accum_year'), 'now()',
    ) for r in rows]
    with conn.cursor() as cur:
        execute_values(cur, sql, vals)
    conn.commit()
    return len(vals)


def update_pop(conn, geocode, pop):
    if not pop:
        return
    with conn.cursor() as cur:
        cur.execute("UPDATE municipio SET pop=%s WHERE geocode=%s", (pop, geocode))
    conn.commit()


def process_geocode(conn, geocode, nome, regiao):
    all_rows = []
    last_pop  = None
    for disease in DISEASES:
        data = fetch_infodengue(geocode, disease)
        for item in data:
            if item.get('SE') is None:
                continue
            if item.get('pop'):
                last_pop = int(item['pop'])
            try:
                dt = item['data_iniSE']
                if isinstance(dt, (int, float)):
                    from datetime import date
                    epoch = date(1970, 1, 1)
                    dt = str(epoch.fromtimestamp(dt / 1000))
                else:
                    dt = str(dt)[:10]
            except Exception:
                dt = None
            all_rows.append(dict(
                geocode=geocode, doenca=disease,
                se=item['SE'], data_inise=dt,
                casos=item.get('casos'), casos_est=item.get('casos_est'),
                nivel=item.get('nivel'), rt=item.get('Rt'),
                p_inc100k=item.get('p_inc100k'),
                tempmed=item.get('tempmed'), umidmed=item.get('umidmed'),
                notif_accum_year=item.get('notif_accum_year'),
            ))
    n = upsert_rows(conn, all_rows)
    if last_pop:
        update_pop(conn, geocode, last_pop)
    return n


def main():
    log.info("Conectando ao banco...")
    conn = psycopg2.connect(DB_URL)

    missing = get_missing_geocodes(conn)
    total = len(missing)
    log.info(f"Municípios sem dados: {total}")

    by_region = {}
    for geocode, nome, uf, regiao in missing:
        by_region.setdefault(regiao, 0)
        by_region[regiao] += 1
    for r, n in sorted(by_region.items()):
        log.info(f"  {r}: {n}")

    inserted = 0
    errors   = 0
    for i, (geocode, nome, uf, regiao) in enumerate(missing, 1):
        try:
            n = process_geocode(conn, geocode, nome, regiao)
            inserted += n
            if i % 50 == 0 or i == total:
                log.info(f"[{i}/{total}] {regiao}/{uf} {nome} → {n} registros (total={inserted})")
        except Exception as e:
            errors += 1
            log.error(f"[{i}/{total}] {geocode} {nome}: {e}")
            conn.rollback()

        if i % BATCH_SIZE == 0:
            time.sleep(BATCH_DELAY)

    log.info(f"Concluído. Inseridos: {inserted}, Erros: {errors}")
    conn.close()


if __name__ == '__main__':
    main()
