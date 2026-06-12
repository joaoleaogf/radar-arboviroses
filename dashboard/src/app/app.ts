import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LgpdBanner } from './lgpd/lgpd-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LgpdBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-lgpd-banner />
  `,
})
export class App {}
