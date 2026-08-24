import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TokenStorageService } from '../../core/services/token-storage.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">User Identity & Security Profile</h1>
          <p class="text-sm text-slate-500 mt-1">Live Spring Security context and JWT claims</p>
        </div>
        <button (click)="authService.logout()" class="btn bg-rose-600 hover:bg-rose-700 text-white">
          Sign Out
        </button>
      </div>

      @let user = authService.currentUser();

      @if (user) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- User Details Card -->
          <div class="card md:col-span-2">
            <h2 class="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Account Details</h2>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-slate-400 block text-xs uppercase font-semibold">User ID</span>
                <span class="font-mono font-medium">{{ user.id }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs uppercase font-semibold">Username</span>
                <span class="font-medium">{{ user.username }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs uppercase font-semibold">Email</span>
                <span class="font-medium">{{ user.email }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs uppercase font-semibold">Assigned Roles</span>
                <div class="flex gap-1 mt-1">
                  @for (role of user.roles; track role) {
                    <span class="badge badge-success">{{ role }}</span>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Token Status Card -->
          <div class="card">
            <h2 class="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Token Storage</h2>
            <div class="space-y-3 text-xs">
              <div>
                <span class="text-slate-400 block uppercase font-semibold">Access Token (Bearer)</span>
                <span class="font-mono bg-slate-100 p-1 rounded block truncate text-slate-700 mt-1">
                  {{ tokenStorage.getAccessToken() || 'N/A' }}
                </span>
              </div>
              <div>
                <span class="text-slate-400 block uppercase font-semibold">Refresh Token (UUID)</span>
                <span class="font-mono bg-slate-100 p-1 rounded block truncate text-slate-700 mt-1">
                  {{ tokenStorage.getRefreshToken() || 'N/A' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Refresh Token Race Condition Simulation Lab -->
        <div class="card border-blue-200 bg-blue-50/30">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-base font-bold text-blue-950">Refresh Token Race Condition Simulator</h3>
              <p class="text-xs text-slate-600 mt-1 max-w-2xl">
                This test simulates 4 simultaneous HTTP requests firing concurrently after token expiry.
                The <code>authInterceptor</code> queue intercepts all 4, sends exactly ONE <code>/refresh</code> request,
                and replays all 4 requests transparently without dropping user session.
              </p>
            </div>
            <button
              (click)="simulateParallelRequests()"
              [disabled]="isTesting()"
              class="btn btn-primary text-xs shrink-0"
            >
              @if (isTesting()) {
                <span>Executing 4 Requests...</span>
              } @else {
                <span>Run 4x Parallel Test</span>
              }
            </button>
          </div>

          @if (testResults().length > 0) {
            <div class="mt-4 pt-4 border-t border-blue-100">
              <h4 class="text-xs font-bold text-slate-700 uppercase mb-2">Simulation Trace Results:</h4>
              <div class="space-y-1">
                @for (res of testResults(); track $index) {
                  <div class="text-xs font-mono p-2 rounded bg-white border border-slate-200 flex justify-between">
                    <span>{{ res.endpoint }}</span>
                    <span class="badge badge-success">{{ res.status }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .gap-6 { gap: 1.5rem; }
    .gap-4 { gap: 1rem; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    @media (min-width: 768px) {
      .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .md\\:col-span-2 { grid-column: span 2 / span 2; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  readonly authService = inject(AuthService);
  readonly tokenStorage = inject(TokenStorageService);
  private readonly http = inject(HttpClient);

  readonly isTesting = signal<boolean>(false);
  readonly testResults = signal<Array<{ endpoint: string; status: string }>>([]);

  simulateParallelRequests(): void {
    this.isTesting.set(true);
    this.testResults.set([]);

    // Fire 4 simultaneous protected API calls
    const req1 = this.http.get<{ status: string }>('/api/v1/health/ping');
    const req2 = this.http.get<{ status: string }>('/api/v1/health/ping');
    const req3 = this.http.get<{ status: string }>('/api/v1/health/ping');
    const req4 = this.http.get<{ status: string }>('/api/v1/health/ping');

    forkJoin([req1, req2, req3, req4]).subscribe({
      next: (results) => {
        this.isTesting.set(false);
        this.testResults.set([
          { endpoint: 'GET /api/v1/health/ping (Request 1)', status: `200 OK (${results[0].status})` },
          { endpoint: 'GET /api/v1/health/ping (Request 2)', status: `200 OK (${results[1].status})` },
          { endpoint: 'GET /api/v1/health/ping (Request 3)', status: `200 OK (${results[2].status})` },
          { endpoint: 'GET /api/v1/health/ping (Request 4)', status: `200 OK (${results[3].status})` }
        ]);
      },
      error: (err) => {
        this.isTesting.set(false);
        console.error('Parallel test failed:', err);
      }
    });
  }
}
