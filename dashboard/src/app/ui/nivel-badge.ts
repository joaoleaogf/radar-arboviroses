import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NIVEL_HEX, NIVEL_LABEL } from '../nivel';

/**
 * Badge de nível de alerta reutilizável. Carrega cor + rótulo textual,
 * de modo que a informação nunca dependa só da cor (acessível a daltônicos).
 */
@Component({
  selector: 'app-nivel-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [style.color]="cor()" [style.background]="cor() + '1a'"
          [attr.aria-label]="'Nível ' + label()">
      <span class="dot" [style.background]="cor()" aria-hidden="true"></span>
      {{ label() }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em;
      padding: 3px 9px; border-radius: 999px; white-space: nowrap;
    }
    .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  `],
})
export class NivelBadge {
  readonly nivel = input<number | null>(0);
  protected readonly cor = computed(() => NIVEL_HEX[this.nivel() ?? 0] ?? NIVEL_HEX[0]);
  protected readonly label = computed(() => NIVEL_LABEL[this.nivel() ?? 0] ?? NIVEL_LABEL[0]);
}
