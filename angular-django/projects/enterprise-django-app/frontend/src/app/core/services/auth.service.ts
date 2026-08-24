import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface DjangoUser {
  id: number;
  username: string;
  email: string;
  roles: string[];
}

export interface DjangoAuthResponse {
  access: string;
  refresh: string;
  user: DjangoUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // NOTE: Trailing slash is MANDATORY for Django URLs!
  private readonly baseUrl = '/api/v1/auth/';

  readonly currentUser = signal<DjangoUser | null>(this.getStoredUser());
  readonly accessToken = signal<string | null>(this.getStoredToken('django_access_token'));
  readonly refreshTokenVal = signal<string | null>(this.getStoredToken('django_refresh_token'));
  readonly isAuthenticated = computed(() => !!this.accessToken());

  login(credentials: { username: string; password: string }): Observable<DjangoAuthResponse> {
    return this.http.post<DjangoAuthResponse>(`${this.baseUrl}login/`, credentials).pipe(
      tap((res) => {
        this.saveTokens(res.access, res.refresh);
        this.saveUser(res.user);
      })
    );
  }

  refreshToken(refresh: string): Observable<{ access: string }> {
    return this.http.post<{ access: string }>(`${this.baseUrl}refresh/`, { refresh }).pipe(
      tap((res) => {
        localStorage.setItem('django_access_token', res.access);
        this.accessToken.set(res.access);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('django_access_token');
    localStorage.removeItem('django_refresh_token');
    localStorage.removeItem('django_user');
    this.accessToken.set(null);
    this.refreshTokenVal.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.refreshTokenVal();
  }

  private saveTokens(access: string, refresh: string): void {
    localStorage.setItem('django_access_token', access);
    localStorage.setItem('django_refresh_token', refresh);
    this.accessToken.set(access);
    this.refreshTokenVal.set(refresh);
  }

  private saveUser(user: DjangoUser): void {
    localStorage.setItem('django_user', JSON.stringify(user));
    this.currentUser.set(user);
  }

  private getStoredToken(key: string): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }

  private getStoredUser(): DjangoUser | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('django_user');
    return raw ? JSON.parse(raw) : null;
  }
}
