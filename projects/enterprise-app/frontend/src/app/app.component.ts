import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  template: `
    <div class="app-layout min-h-screen flex flex-col">
      <app-header />
      <main class="flex-1">
        <router-outlet />
      </main>
      <footer class="bg-slate-900 text-slate-400 py-4 text-center text-xs border-t border-slate-800">
        Enterprise Angular + Spring Boot Full-Stack Mastery Platform
      </footer>
    </div>
  `,
  styles: [`
    .app-layout { min-height: 100vh; display: flex; flex-direction: column; }
    main { flex: 1; }
    footer { background-color: #0f172a; color: #64748b; padding: 1rem 0; text-align: center; font-size: 0.75rem; border-top: 1px solid #1e293b; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {}
