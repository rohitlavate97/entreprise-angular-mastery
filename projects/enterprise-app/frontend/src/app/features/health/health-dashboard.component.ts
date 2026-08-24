import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthService } from '../../core/services/health.service';

@Component({
  selector: 'app-health-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Full-Stack System Telemetry</h1>
          <p class="text-sm text-slate-500 mt-1">Live health check contract with Spring Boot Actuator & Custom Ping Controller</p>
        </div>
        <button (click)="refresh()" [disabled]="healthService.isChecking()" class="btn btn-primary">
          @if (healthService.isChecking()) {
            <span>Probing Backend...</span>
          } @else {
            <span>Check Now</span>
          }
        </button>
      </div>

      @if (healthService.lastError()) {
        <div class="card bg-rose-50 border-rose-200 text-rose-800 mb-6 p-4">
          <h3 class="font-bold mb-1">Communication Failure</h3>
          <p class="text-sm">{{ healthService.lastError() }}</p>
        </div>
      }

      @let health = healthService.lastCheck();

      @if (health) {
        <div class="card mb-6">
          <div class="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <span class="text-xs text-slate-400 uppercase font-semibold">Service Name</span>
              <h2 class="text-lg font-bold text-slate-800">{{ health.service }}</h2>
            </div>
            <div>
              <span class="badge" [ngClass]="health.status === 'UP' ? 'badge-success' : 'badge-danger'">
                {{ health.status }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong class="text-slate-500">API Version:</strong>
              <span class="ml-2 font-mono">{{ health.version }}</span>
            </div>
            <div>
              <strong class="text-slate-500">Server UTC Timestamp:</strong>
              <span class="ml-2 font-mono">{{ health.timestamp }}</span>
            </div>
          </div>

          @if (health.details) {
            <div class="mt-4 pt-4 border-t">
              <h4 class="text-xs font-semibold text-slate-500 uppercase mb-2">Subsystem Details</h4>
              <pre class="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono">{{ health.details | json }}</pre>
            </div>
          }
        </div>
      } @else if (!healthService.isChecking()) {
        <div class="card text-center py-12 text-slate-400">
          <p>No telemetry data collected. Click <strong>Check Now</strong> to initiate an end-to-end request trace.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .mb-6 { margin-bottom: 1.5rem; }
    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .gap-4 { gap: 1rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HealthDashboardComponent implements OnInit {
  readonly healthService = inject(HealthService);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.healthService.checkHealth().subscribe({
      error: (err) => console.error('Health check probe completed with error', err)
    });
  }
}
