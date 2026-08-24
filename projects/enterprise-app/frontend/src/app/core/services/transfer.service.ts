import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Transfer, TransferRequest } from '../models/transfer.models';

@Injectable({
  providedIn: 'root'
})
export class TransferService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/transfers';

  createTransfer(request: TransferRequest, idempotencyKey?: string): Observable<Transfer> {
    let headers = new HttpHeaders();
    if (idempotencyKey) {
      headers = headers.set('X-Idempotency-Key', idempotencyKey);
    }

    return this.http.post<Transfer>(this.baseUrl, request, { headers });
  }

  getTransfers(): Observable<Transfer[]> {
    return this.http.get<Transfer[]>(this.baseUrl);
  }
}
