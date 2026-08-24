import { Injectable, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { TokenStorageService } from './token-storage.service';
import { AuthResponse, LoginRequest, RegisterRequest, TokenRefreshRequest, UserSummary } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly baseUrl = '/api/v1/auth';

  readonly currentUser = this.tokenStorage.currentUser;
  readonly isAuthenticated = computed(() => !!this.tokenStorage.accessToken());
  readonly isAdmin = computed(() => {
    const user = this.currentUser();
    return user?.roles.includes('ROLE_ADMIN') ?? false;
  });

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, credentials).pipe(
      tap((res) => {
        this.tokenStorage.saveTokens(res.accessToken, res.refreshToken);
        this.tokenStorage.saveUser(res.user);
      })
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, data).pipe(
      tap((res) => {
        this.tokenStorage.saveTokens(res.accessToken, res.refreshToken);
        this.tokenStorage.saveUser(res.user);
      })
    );
  }

  refreshToken(request: TokenRefreshRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, request).pipe(
      tap((res) => {
        this.tokenStorage.saveTokens(res.accessToken, res.refreshToken);
        this.tokenStorage.saveUser(res.user);
      }),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    const token = this.tokenStorage.getAccessToken();
    if (token) {
      this.http.post(`${this.baseUrl}/logout`, {}).subscribe({
        error: () => console.warn('Backend logout notification failed')
      });
    }
    this.tokenStorage.clear();
    this.router.navigate(['/login']);
  }

  hasRole(role: string): boolean {
    const user = this.currentUser();
    return user?.roles.includes(role) ?? false;
  }
}
