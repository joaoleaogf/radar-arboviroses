import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

const KEY = 'lgpd_consent_v1';

@Component({
  selector: 'app-lgpd-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="lgpd-banner" role="dialog" aria-label="Aviso de privacidade">
        <div class="lgpd-inner">
          <div class="lgpd-text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>
              Usamos <strong>cookies essenciais</strong> apenas para autenticação segura.
              <span class="lgpd-extra">
                Seus dados são tratados conforme a
                <strong>LGPD (Lei 13.709/2018)</strong> — coletados exclusivamente
                para alertas de saúde pública e nunca compartilhados com terceiros.
              </span>
              <button class="btn-policy" (click)="togglePolicy()">Saiba mais</button>
            </span>
          </div>
          <div class="lgpd-actions">
            <button class="btn-recusar" (click)="recusar()">Apenas essenciais</button>
            <button class="btn-aceitar" (click)="aceitar()">Aceitar e continuar</button>
          </div>
        </div>

        @if (showPolicy()) {
          <div class="policy-detail">
            <strong>O que coletamos:</strong> e-mail, nome, telefone (opcional) e preferências de alerta.
            <strong>Por quê:</strong> enviar notificações sobre surtos de arboviroses nos locais que você monitora.
            <strong>Seus direitos:</strong> acesso, retificação e exclusão dos seus dados pelo perfil da conta.
            <strong>Base legal:</strong> consentimento (Art. 7º, I) e legítimo interesse em saúde pública (Art. 7º, IX).
            Fonte epidemiológica: InfoDengue (Fiocruz/FGV) — dados públicos.
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .lgpd-banner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9000;
      background: rgba(5, 12, 24, 0.97);
      backdrop-filter: blur(12px);
      border-top: 1px solid var(--border);
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      font-size: 0.82rem;
    }
    .lgpd-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; gap: 20px;
      padding: 14px 24px; flex-wrap: wrap;
    }
    .lgpd-text {
      display: flex; align-items: flex-start; gap: 10px;
      flex: 1; min-width: 280px; color: var(--muted); line-height: 1.5;
    }
    .lgpd-text svg { flex-shrink: 0; margin-top: 1px; color: var(--brand); }
    .lgpd-text strong { color: var(--text); }
    .btn-policy {
      background: none; border: none; color: var(--brand);
      font-size: 0.82rem; font-weight: 600; cursor: pointer;
      padding: 0; text-decoration: underline; font-family: inherit;
    }
    .lgpd-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn-recusar {
      padding: 8px 16px; background: transparent;
      border: 1px solid var(--border); border-radius: 8px;
      color: var(--muted); font-size: 0.8rem; font-weight: 600;
      cursor: pointer; transition: all 0.15s; font-family: inherit;
    }
    .btn-recusar:hover { background: var(--surface-2); color: var(--text); }
    .btn-aceitar {
      padding: 8px 18px; background: var(--brand); border: none;
      border-radius: 8px; color: #03090f; font-size: 0.8rem;
      font-weight: 700; cursor: pointer; transition: opacity 0.15s;
      font-family: inherit;
    }
    .btn-aceitar:hover { opacity: 0.88; }
    .policy-detail {
      padding: 10px 24px 14px;
      color: var(--muted); font-size: 0.75rem; line-height: 1.7;
      border-top: 1px solid var(--border-subtle);
    }
    .policy-detail strong { color: var(--muted); }

    @media (max-width: 700px) {
      .lgpd-banner { font-size: 0.78rem; }
      .lgpd-inner {
        gap: 12px;
        padding: 12px 14px;
        padding-bottom: max(12px, env(safe-area-inset-bottom));
      }
      /* Texto longo demais para o rodapé do celular — fica no "Saiba mais" */
      .lgpd-extra { display: none; }
      .lgpd-text { min-width: 0; }
      .lgpd-actions { width: 100%; }
      .lgpd-actions button { flex: 1; padding: 10px 12px; }
      .policy-detail { padding: 10px 14px 14px; }
    }
  `],
})
export class LgpdBanner {
  protected readonly visible    = signal(localStorage.getItem(KEY) === null);
  protected readonly showPolicy = signal(false);

  protected togglePolicy(): void { this.showPolicy.update(v => !v); }

  protected aceitar(): void {
    localStorage.setItem(KEY, 'accepted');
    this.visible.set(false);
  }

  protected recusar(): void {
    // Apenas cookies essenciais — ainda precisamos da sessão para funcionar.
    // Registramos a escolha e dispensamos o banner.
    localStorage.setItem(KEY, 'essential-only');
    this.visible.set(false);
  }
}
