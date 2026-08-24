import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Transfer {
  id: number;
  referenceId: string;
  sourceAccount: string;
  targetAccount: string;
  amount: string;
  currency: string;
  status: string;
  idempotencyKey?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransferService {
  private readonly http = inject(HttpClient);
  // CRITICAL: Trailing slash prevents Django 301 POST dropping payload!
  private readonly baseUrl = '/api/v1/transfers/';

  createTransfer(data: { sourceAccount: string; targetAccount: string; amount: number; currency: string }, idempotencyKey?: string): Observable<Transfer> {
    let headers = new HttpHeaders();
    if (idempotencyKey) {
      headers = headers.set('X-Idempotency-Key', idempotencyKey);
    }
    return this.http.post<Transfer>(this.baseUrl, data, { headers });
  }

  getTransfers(): Observable<{ results: Transfer[] }> {
    return this.http.get<{ results: Transfer[] }>(this.baseUrl);
  }
}
