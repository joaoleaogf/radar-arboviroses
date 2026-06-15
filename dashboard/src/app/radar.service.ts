import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, retry, timeout, timer } from 'rxjs';
import { environment } from '../environments/environment';

export type Doenca = 'dengue' | 'chikungunya';

export interface FilterParams {
  uf?: string;
  regiao?: string;
}

export interface MunicipioProps {
  geocode: number;
  nome: string;
  uf: string | null;
  regiao: string | null;
  pop: number | null;
  se: number | null;
  casos: number | null;
  casos_est: number | null;
  nivel: number | null;
  rt: number | null;
  p_inc100k: number | null;
}

export type MunicipiosGeoJson = GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon,
  MunicipioProps
>;

export interface PontoSerie {
  se: number;
  data: string;
  casos: number | null;
  casos_est: number | null;
  nivel: number | null;
  rt: number | null;
  p_inc100k: number | null;
}

export interface Serie {
  geocode: number;
  doenca: Doenca;
  nome: string;
  serie: PontoSerie[];
}

export interface TopAlerta {
  geocode: number;
  nome: string;
  nivel: number;
  casos_est: number | null;
  rt: number | null;
}

export interface PontoSemanal {
  se: number;
  casos_est: number | null;
}

export interface Resumo {
  doenca: Doenca;
  municipios: number;
  em_alerta: number;
  casos_est_ultima_semana: number;
  ultima_se: number | null;
  ultima_carga: string | null;
  /** Totais agregados das últimas ~12 semanas (para delta e sparkline). Opcional p/ retrocompat. */
  serie_recente?: PontoSemanal[];
  top_alertas: TopAlerta[];
}

/** Timeout por requisição (ms) antes de considerar a API indisponível. */
const REQUEST_TIMEOUT = 15_000;

/** Reenvia até 2 vezes com backoff exponencial em falhas transitórias. */
function resiliente<T>(): (src: Observable<T>) => Observable<T> {
  return (src) => src.pipe(
    timeout(REQUEST_TIMEOUT),
    retry({ count: 2, delay: (_err, n) => timer(500 * 2 ** (n - 1)) }),
  );
}

@Injectable({ providedIn: 'root' })
export class RadarService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  municipios(doenca: Doenca, filter: FilterParams = {}): Observable<MunicipiosGeoJson> {
    const params: Record<string, string> = { doenca };
    if (filter.uf) params['uf'] = filter.uf;
    if (filter.regiao) params['regiao'] = filter.regiao;
    return this.http.get<MunicipiosGeoJson>(`${this.base}/municipios`, { params }).pipe(resiliente());
  }

  serie(geocode: number, doenca: Doenca): Observable<Serie> {
    return this.http.get<Serie>(`${this.base}/serie`, {
      params: { geocode, doenca },
    }).pipe(resiliente());
  }

  resumo(doenca: Doenca, filter: FilterParams = {}): Observable<Resumo> {
    const params: Record<string, string> = { doenca };
    if (filter.uf) params['uf'] = filter.uf;
    if (filter.regiao) params['regiao'] = filter.regiao;
    return this.http.get<Resumo>(`${this.base}/resumo`, { params }).pipe(resiliente());
  }
}
