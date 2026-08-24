import { Injectable, signal } from '@angular/core';
import { UserSummary } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class TokenStorageService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token';
  private readonly USER_KEY = 'auth_user_summary';

  readonly accessToken = signal<string | null>(this.getStoredAccessToken());
  readonly refreshToken = signal<string | null>(this.getStoredRefreshToken());
  readonly currentUser = signal<UserSummary | null>(this.getStoredUser());

  saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    this.accessToken.set(accessToken);
    this.refreshToken.set(refreshToken);
  }

  saveUser(user: UserSummary): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.refreshToken();
  }

  clear(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.currentUser.set(null);
  }

  private getStoredAccessToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(this.ACCESS_TOKEN_KEY) : null;
  }

  private getStoredRefreshToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(this.REFRESH_TOKEN_KEY) : null;
  }

  private getStoredUser(): UserSummary | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserSummary;
    } catch {
      return null;
    }
  }
}
