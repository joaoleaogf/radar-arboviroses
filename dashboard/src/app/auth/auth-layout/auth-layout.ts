import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-wrap">
      <div class="auth-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          <path d="M8 12h8M12 8l4 4-4 4"/>
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".25"/>
        </svg>
        <span>Radar de <strong>Arboviroses</strong></span>
      </div>
      <router-outlet />
      <p class="auth-footer">Dados: InfoDengue (Fiocruz/FGV) · IBGE</p>
    </div>
  `,
  styles: [`
    .auth-wrap {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(56,189,248,.06) 0%, transparent 70%),
                  var(--bg);
    }
    .auth-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--brand);
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 32px;
    }
    .auth-brand strong { color: var(--text); }
    .auth-footer {
      margin-top: 32px;
      font-size: 0.75rem;
      color: var(--muted-2);
      text-align: center;
    }
  `],
})
export class AuthLayout {}
