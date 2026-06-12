import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: '../login/login.css',
})
export class Register {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  protected name     = '';
  protected email    = '';
  protected password = '';
  protected loading  = signal(false);
  protected erro     = signal<string | null>(null);

  protected submit(): void {
    if (!this.name || !this.email || !this.password) return;
    if (this.password.length < 8) { this.erro.set('Senha deve ter pelo menos 8 caracteres'); return; }
    this.loading.set(true);
    this.erro.set(null);
    this.auth.register(this.name, this.email, this.password).subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: (e) => {
        this.erro.set(e.error?.error ?? 'Erro ao criar conta.');
        this.loading.set(false);
      },
    });
  }
}
