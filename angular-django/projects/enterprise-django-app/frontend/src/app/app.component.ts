import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="min-h-screen flex flex-col">
      <header class="bg-[#092e20] text-white py-4 shadow">
        <div class="container flex justify-between items-center">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-lg">Angular + Django 5 Enterprise</span>
          </div>
          <nav class="flex space-x-4 text-sm">
            <a routerLink="/users" class="hover:text-emerald-300">Users</a>
            <a routerLink="/transfers" class="hover:text-emerald-300">Transfers</a>
          </nav>
        </div>
      </header>
      <main class="flex-1">
        <router-outlet></router-outlet>
      </main>
      <footer class="bg-slate-900 text-slate-400 py-3 text-center text-xs">
        Angular 19+ & Django 5+ Mastery Track
      </footer>
    </div>
  `,
  styles: [`
    .min-h-screen { min-height: 100vh; display: flex; flex-direction: column; }
    .flex-1 { flex: 1; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .space-x-4 > * + * { margin-left: 1rem; }
    nav a { color: #e2e8f0; text-decoration: none; }
  `]
})
export class AppComponent {}
