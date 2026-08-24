import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div class="container flex justify-between items-center h-16">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow">
            EA
          </div>
          <span class="font-bold text-lg tracking-tight">Enterprise Mastery</span>
        </div>

        <nav class="flex items-center space-x-6">
          <a routerLink="/health" routerLinkActive="text-blue-400 font-semibold"
             class="text-sm text-slate-300 hover:text-white transition">System Telemetry</a>

          @if (authService.isAuthenticated()) {
            <a routerLink="/profile" routerLinkActive="text-blue-400 font-semibold"
               class="text-sm text-slate-300 hover:text-white transition">Profile</a>
            
            <div class="flex items-center space-x-3 pl-4 border-l border-slate-700">
              <span class="text-xs text-slate-400">Signed in as <strong>{{ authService.currentUser()?.username }}</strong></span>
              <button (click)="authService.logout()" class="btn text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 px-3">
                Logout
              </button>
            </div>
          } @else {
            <a routerLink="/login" class="btn btn-primary text-xs py-1.5 px-4">
              Sign In
            </a>
          }
        </nav>
      </div>
    </header>
  `,
  styles: [`
    header { background-color: #0f172a; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; height: 4rem; }
    nav { display: flex; align-items: center; gap: 1.5rem; }
    nav a { color: #94a3b8; text-decoration: none; font-size: 0.875rem; font-weight: 500; }
    nav a:hover, nav a.text-blue-400 { color: #60a5fa; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
}
