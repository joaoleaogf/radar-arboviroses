import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../auth.service';

/** Largura a partir da qual a sidebar vira drawer sobreposto. */
const MQ_MOBILE = '(max-width: 900px)';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  protected readonly auth = inject(AuthService);

  /** Sidebar recolhida em modo ícone (só faz sentido no desktop). */
  protected readonly collapsed = signal(false);
  /** Drawer aberto (mobile). */
  protected readonly menuAberto = signal(false);
  /** Viewport estreito — sidebar vira drawer. */
  protected readonly mobile = signal(false);

  /**
   * No mobile o drawer sempre mostra os rótulos: o estado "recolhido" do
   * desktop não deve vazar para o menu sobreposto.
   */
  protected readonly recolhida = computed(() => this.collapsed() && !this.mobile());

  constructor() {
    const router = inject(Router);
    router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.menuAberto.set(false));

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia(MQ_MOBILE);
      this.mobile.set(mq.matches);
      const onChange = (e: MediaQueryListEvent) => {
        this.mobile.set(e.matches);
        if (!e.matches) this.menuAberto.set(false);
      };
      mq.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
    }
  }

  @HostListener('document:keydown.escape')
  protected fecharMenu(): void {
    this.menuAberto.set(false);
  }
}
