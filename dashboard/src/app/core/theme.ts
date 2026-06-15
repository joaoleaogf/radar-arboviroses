import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'radar-theme';

/** Paleta de cores resolvida para o tema atual — usada por libs que não leem
 *  variáveis CSS (Highcharts/Leaflet). Mantida em sincronia com styles.css. */
export interface ChartPalette {
  axisText: string;
  axisLine: string;
  gridStrong: string;
  label: string;
  btnFill: string;
  btnStroke: string;
  btnText: string;
  btnHoverFill: string;
  btnHoverText: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMuted: string;
  navOutline: string;
}

const DARK: ChartPalette = {
  axisText:     '#7080a0',
  axisLine:     '#1c2b46',
  gridStrong:   '#131e34',
  label:        '#3d5070',
  btnFill:      '#111d33',
  btnStroke:    '#1c2b46',
  btnText:      '#7080a0',
  btnHoverFill: '#162039',
  btnHoverText: '#e4eaf6',
  tooltipBg:    'rgba(7,13,26,0.97)',
  tooltipBorder:'#1c2b46',
  tooltipText:  '#e4eaf6',
  tooltipMuted: '#9aa8c0',
  navOutline:   '#1c2b46',
};

const LIGHT: ChartPalette = {
  axisText:     '#5a6b85',
  axisLine:     '#d3dde9',
  gridStrong:   '#e8eef5',
  label:        '#90a0b8',
  btnFill:      '#f1f5fa',
  btnStroke:    '#d3dde9',
  btnText:      '#5a6b85',
  btnHoverFill: '#e6edf5',
  btnHoverText: '#0f1d30',
  tooltipBg:    'rgba(255,255,255,0.98)',
  tooltipBorder:'#d3dde9',
  tooltipText:  '#0f1d30',
  tooltipMuted: '#5a6b85',
  navOutline:   '#d3dde9',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.setAttribute('data-theme', t);
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch { /* localStorage indisponível (modo privado) */ }
    });
  }

  toggle(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  /** Paleta de cores para gráficos no tema atual. */
  palette(): ChartPalette {
    return this.theme() === 'light' ? LIGHT : DARK;
  }

  private initial(): Theme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* ignore */ }
    const prefersLight = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }
}
