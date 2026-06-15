import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Marca do Radar de Arboviroses: um radar com varredura e um "blip" pulsante,
 * desenhado em currentColor (herda a cor da marca). Opcionalmente exibe o
 * wordmark ao lado.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo" [class.with-text]="wordmark()">
      <span class="logo-ico">
        <svg viewBox="0 0 32 32" fill="none" width="100%" height="100%" aria-hidden="true">
          <defs>
            <linearGradient [attr.id]="gid" x1="16" y1="16" x2="27" y2="7" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="currentColor" stop-opacity="0.5"/>
              <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="13"  stroke="currentColor" stroke-width="1.7" opacity="0.9"/>
          <circle cx="16" cy="16" r="8.5" stroke="currentColor" stroke-width="1.3" opacity="0.4"/>
          <circle cx="16" cy="16" r="4"   stroke="currentColor" stroke-width="1.3" opacity="0.28"/>
          <path d="M16 16 L16 3 A13 13 0 0 1 25.19 6.81 Z" [attr.fill]="'url(#' + gid + ')'"/>
          <line x1="16" y1="16" x2="16" y2="3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          <circle class="blip-halo" cx="22.7" cy="9.3" r="3.6" fill="currentColor" opacity="0.18"/>
          <circle cx="22.7" cy="9.3" r="2.3" fill="currentColor"/>
        </svg>
      </span>
      @if (wordmark()) {
        <span class="logo-text">
          <span class="logo-title">Radar</span>
          <small>Arboviroses</small>
        </span>
      }
    </span>
  `,
  styles: [`
    .logo { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }

    .logo-ico {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; flex-shrink: 0;
      background: var(--brand-dim);
      border: 1px solid var(--brand-glow);
      border-radius: 9px;
      color: var(--brand);
    }
    .logo-ico svg { width: 22px; height: 22px; }

    .blip-halo { transform-box: fill-box; transform-origin: center; animation: blip 2.4s ease-out infinite; }
    @keyframes blip {
      0%   { transform: scale(0.5); opacity: 0.5; }
      70%  { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .blip-halo { animation: none; }
    }

    .logo-text {
      display: flex; flex-direction: column; line-height: 1.15;
      min-width: 0; overflow: hidden;
    }
    .logo-title {
      font-size: 0.98rem; font-weight: 800; letter-spacing: -0.02em;
      color: var(--text); white-space: nowrap;
    }
    .logo-text small {
      font-size: 0.66rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--muted); white-space: nowrap;
    }
  `],
})
export class Logo {
  /** Exibe o wordmark "Radar / Arboviroses" ao lado da marca. */
  readonly wordmark = input(false);

  /** id único do gradiente p/ evitar colisão entre instâncias na página. */
  protected readonly gid = `radar-sweep-${Math.random().toString(36).slice(2, 8)}`;
}
