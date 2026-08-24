import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthService } from '../services/auth.service';
import { of } from 'rxjs';
import { AuthResponse } from '../models/auth.models';

describe('authInterceptor — Refresh Token Race Condition Safe Queue', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenStorage: TokenStorageService;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
    authService = TestBed.inject(AuthService);

    tokenStorage.saveTokens('initial-expired-access-token', 'valid-refresh-token');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should queue multiple simultaneous 401 requests and fire only ONE /refresh call', () => {
    const mockAuthResponse: AuthResponse = {
      accessToken: 'new-rotated-access-token',
      refreshToken: 'new-rotated-refresh-token',
      tokenType: 'Bearer',
      expiresInMs: 900000,
      user: { id: 1, username: 'admin', email: 'admin@enterprise.io', roles: ['ROLE_ADMIN'] }
    };

    spyOn(authService, 'refreshToken').and.returnValue(of(mockAuthResponse));

    let res1: unknown, res2: unknown;

    // Fire 2 parallel requests
    http.get('/api/v1/users/1').subscribe((data) => (res1 = data));
    http.get('/api/v1/users/2').subscribe((data) => (res2 = data));

    // Initial 2 requests dispatched with expired token
    const req1 = httpMock.expectOne('/api/v1/users/1');
    const req2 = httpMock.expectOne('/api/v1/users/2');

    expect(req1.request.headers.get('Authorization')).toBe('Bearer initial-expired-access-token');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer initial-expired-access-token');

    // Both receive 401 Unauthorized simultaneously
    req1.flush('Expired token', { status: 401, statusText: 'Unauthorized' });
    req2.flush('Expired token', { status: 401, statusText: 'Unauthorized' });

    // Assert that authService.refreshToken was called EXACTLY ONCE
    expect(authService.refreshToken).toHaveBeenCalledTimes(1);

    // Both requests are retried with the newly rotated access token
    const retry1 = httpMock.expectOne('/api/v1/users/1');
    const retry2 = httpMock.expectOne('/api/v1/users/2');

    expect(retry1.request.headers.get('Authorization')).toBe('Bearer new-rotated-access-token');
    expect(retry2.request.headers.get('Authorization')).toBe('Bearer new-rotated-access-token');

    retry1.flush({ id: 1, username: 'user1' });
    retry2.flush({ id: 2, username: 'user2' });

    expect(res1).toEqual({ id: 1, username: 'user1' });
    expect(res2).toEqual({ id: 2, username: 'user2' });
  });
});
