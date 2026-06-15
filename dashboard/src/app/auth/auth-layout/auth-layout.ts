import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-wrap">
      <div class="auth-brand">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="auth-radar-sweep" x1="16" y1="16" x2="27" y2="7" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="currentColor" stop-opacity="0.5"/>
              <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="13"  stroke="currentColor" stroke-width="1.7" opacity="0.9"/>
          <circle cx="16" cy="16" r="8.5" stroke="currentColor" stroke-width="1.3" opacity="0.4"/>
          <circle cx="16" cy="16" r="4"   stroke="currentColor" stroke-width="1.3" opacity="0.28"/>
          <path d="M16 16 L16 3 A13 13 0 0 1 25.19 6.81 Z" fill="url(#auth-radar-sweep)"/>
          <line x1="16" y1="16" x2="16" y2="3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          <circle cx="22.7" cy="9.3" r="2.3" fill="currentColor"/>
        </svg>
        <span>Radar de <strong>Arboviroses</strong></span>
      </div>
      <router-outlet />
      <p class="auth-footer">Dados: InfoDengue (Fiocruz/FGV) · IBGE</p>
    </div>
  `,
  styles: [`
    .auth-wrap {
      min-height: 100vh;
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
