import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

export interface Resumo {
  doenca: Doenca;
  municipios: number;
  em_alerta: number;
  casos_est_ultima_semana: number;
  ultima_se: number | null;
  ultima_carga: string | null;
  top_alertas: TopAlerta[];
}

@Injectable({ providedIn: 'root' })
export class RadarService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  municipios(doenca: Doenca, filter: FilterParams = {}): Observable<MunicipiosGeoJson> {
    const params: Record<string, string> = { doenca };
    if (filter.uf) params['uf'] = filter.uf;
    if (filter.regiao) params['regiao'] = filter.regiao;
    return this.http.get<MunicipiosGeoJson>(`${this.base}/municipios`, { params });
  }

  serie(geocode: number, doenca: Doenca): Observable<Serie> {
    return this.http.get<Serie>(`${this.base}/serie`, {
      params: { geocode, doenca },
    });
  }

  resumo(doenca: Doenca, filter: FilterParams = {}): Observable<Resumo> {
    const params: Record<string, string> = { doenca };
    if (filter.uf) params['uf'] = filter.uf;
    if (filter.regiao) params['regiao'] = filter.regiao;
    return this.http.get<Resumo>(`${this.base}/resumo`, { params });
  }
}
