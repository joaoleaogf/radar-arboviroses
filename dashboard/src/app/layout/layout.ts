import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../auth.service';
import { ThemeService } from '../core/theme';
import { Logo } from '../ui/logo';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  protected readonly auth      = inject(AuthService);
  protected readonly theme     = inject(ThemeService);
  protected readonly collapsed  = signal(false);
  protected readonly mobileOpen = signal(false);

  constructor() {
    // Fecha o drawer mobile ao navegar.
    inject(Router).events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.mobileOpen.set(false));
  }
}
