import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { HealthStatus } from '../models/health-status.model';

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/health';

  readonly lastCheck = signal<HealthStatus | null>(null);
  readonly isChecking = signal<boolean>(false);
  readonly lastError = signal<string | null>(null);

  checkHealth(): Observable<HealthStatus> {
    this.isChecking.set(true);
    this.lastError.set(null);

    return this.http.get<HealthStatus>(`${this.baseUrl}/ping`).pipe(
      tap({
        next: (status) => {
          this.lastCheck.set(status);
          this.isChecking.set(false);
        },
        error: (err) => {
          this.lastError.set(err.message || 'Health check failed');
          this.isChecking.set(false);
        }
      })
    );
  }
}
