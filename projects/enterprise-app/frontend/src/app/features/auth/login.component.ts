import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-page flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div class="card max-w-md w-full p-8 shadow-lg border border-slate-200">
        <div class="text-center mb-6">
          <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow">
            <span class="text-white font-bold text-xl">EA</span>
          </div>
          <h2 class="text-2xl font-extrabold text-slate-900">Sign in to Enterprise</h2>
          <p class="text-sm text-slate-500 mt-1">Angular 19 + Spring Security 6 Integration</p>
        </div>

        @if (errorMessage()) {
          <div class="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-md mb-4" role="alert">
            {{ errorMessage() }}
          </div>
        }

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label for="usernameOrEmail" class="block text-sm font-medium text-slate-700 mb-1">
              Username or Email
            </label>
            <input
              id="usernameOrEmail"
              type="text"
              formControlName="usernameOrEmail"
              class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. admin or user"
              autocomplete="username"
            />
            @if (loginForm.controls.usernameOrEmail.touched && loginForm.controls.usernameOrEmail.invalid) {
              <p class="text-xs text-rose-500 mt-1">Username or email is required.</p>
            }
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            @if (loginForm.controls.password.touched && loginForm.controls.password.invalid) {
              <p class="text-xs text-rose-500 mt-1">Password is required.</p>
            }
          </div>

          <div class="pt-2">
            <button
              type="submit"
              [disabled]="loginForm.invalid || isLoading()"
              class="btn btn-primary w-full py-2.5 font-semibold text-sm shadow flex items-center justify-center space-x-2"
            >
              @if (isLoading()) {
                <span>Signing in...</span>
              } @else {
                <span>Sign In</span>
              }
            </button>
          </div>
        </form>

        <div class="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          <p><strong>Demo Credentials:</strong></p>
          <p class="mt-1">Admin: <code>admin</code> / <code>Admin&#64;12345</code></p>
          <p>User: <code>user</code> / <code>User&#64;12345</code></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: calc(100vh - 8rem); display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
    .card { max-width: 26rem; width: 100%; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .w-full { width: 100%; }
    input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.875rem; }
    input:focus { border-color: #3b82f6; outline: 2px solid #93c5fd; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly loginForm = this.fb.group({
    usernameOrEmail: ['admin', [Validators.required]],
    password: ['Admin@12345', [Validators.required]]
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.getRawValue()).subscribe({
      next: () => {
        this.isLoading.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/profile';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Authentication failed. Please check credentials.');
      }
    });
  }
}
