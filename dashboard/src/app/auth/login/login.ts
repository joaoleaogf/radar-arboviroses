import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  protected email    = '';
  protected password = '';
  protected loading  = signal(false);
  protected erro     = signal<string | null>(null);

  protected submit(): void {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.erro.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: (e) => {
        this.erro.set(e.error?.error ?? 'Credenciais inválidas. Tente novamente.');
        this.loading.set(false);
      },
    });
  }
}
