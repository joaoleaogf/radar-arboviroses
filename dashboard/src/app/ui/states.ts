import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Placeholder animado durante o carregamento de dados. */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="sk" [style.height]="altura()" [style.width]="largura()" [attr.aria-busy]="true" aria-label="Carregando"></div>`,
  styles: [`
    :host { display: block; }
    .sk {
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.3s ease-in-out infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
  `],
})
export class Skeleton {
  readonly altura = input<string>('1rem');
  readonly largura = input<string>('100%');
}

/** Estado vazio (nenhum dado para os filtros atuais). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" role="status">
      <div class="icon">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
      </div>
      <p>{{ mensagem() }}</p>
    </div>
  `,
  styles: [`
    .state { display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; padding: 40px 24px; color: var(--muted); text-align: center; }
    .icon { display: flex; align-items: center; justify-content: center; width: 52px; height: 52px;
      background: var(--surface-2); border: 1px solid var(--border); border-radius: 15px; color: var(--muted-2); }
    p { margin: 0; font-size: 0.875rem; line-height: 1.6; max-width: 280px; }
  `],
})
export class EmptyState {
  readonly mensagem = input<string>('Nenhum resultado para os filtros selecionados.');
}

/** Estado de erro com ação de tentar novamente. */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" role="alert">
      <div class="icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <p>{{ mensagem() }}</p>
      <button type="button" (click)="retentar.emit()">Tentar novamente</button>
    </div>
  `,
  styles: [`
    .state { display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 40px 24px; color: var(--muted); text-align: center; }
    .icon { display: flex; align-items: center; justify-content: center; width: 52px; height: 52px;
      background: var(--n4-dim); border: 1px solid var(--n4); border-radius: 15px; color: var(--n4); }
    p { margin: 0; font-size: 0.875rem; line-height: 1.6; max-width: 300px; }
    button { background: var(--surface-2); border: 1px solid var(--border-bright); color: var(--text);
      font-size: 0.82rem; font-weight: 600; padding: 8px 16px; border-radius: var(--radius-sm);
      transition: background var(--t-fast); }
    button:hover { background: var(--surface-hover); }
  `],
})
export class ErrorState {
  readonly mensagem = input<string>('Não foi possível carregar os dados.');
  readonly retentar = output<void>();
}
