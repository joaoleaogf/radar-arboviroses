import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Ícone "(i)" com explicação em hover/foco — divulgação progressiva.
 * Usado para explicar indicadores epidemiológicos (Rt, incidência, casos est.).
 */
@Component({
  selector: 'app-info-tooltip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="info" tabindex="0" role="note" [attr.aria-label]="texto()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span class="bubble">{{ texto() }}</span>
    </span>
  `,
  styles: [`
    .info {
      position: relative; display: inline-flex; align-items: center;
      color: var(--muted-2); cursor: help; vertical-align: middle;
    }
    .info:hover, .info:focus-visible { color: var(--brand); }
    .bubble {
      position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
      width: max-content; max-width: 240px; padding: 9px 12px;
      background: var(--surface-3); border: 1px solid var(--border-bright);
      border-radius: 9px; color: var(--text); font-size: 0.78rem; font-weight: 400;
      line-height: 1.5; letter-spacing: 0; text-align: left;
      box-shadow: var(--shadow); opacity: 0; visibility: hidden;
      transition: opacity var(--t-fast), visibility var(--t-fast); z-index: 50;
    }
    /* :focus (e não só :focus-visible) para o toque abrir a bolha */
    .info:hover .bubble, .info:focus .bubble { opacity: 1; visibility: visible; }

    @media (max-width: 900px) {
      /* Ancorada à direita: centralizada, estouraria a viewport */
      .bubble {
        max-width: min(68vw, 240px);
        left: auto; right: -6px; transform: none;
      }
    }
  `],
})
export class InfoTooltip {
  readonly texto = input.required<string>();
}
