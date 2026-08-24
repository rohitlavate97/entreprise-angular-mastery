import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError, Observable } from 'rxjs';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthService } from '../services/auth.service';

// Module-level lock and queue subject for refresh race condition protection
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<unknown> => {
  const tokenStorage = inject(TokenStorageService);
  const authService = inject(AuthService);

  // Exclude public auth endpoints from Bearer token injection & 401 retry loop
  if (req.url.includes('/api/v1/auth/login') ||
      req.url.includes('/api/v1/auth/register') ||
      req.url.includes('/api/v1/auth/refresh')) {
    return next(req);
  }

  const accessToken = tokenStorage.getAccessToken();
  let authReq = req;

  if (accessToken) {
    authReq = addTokenHeader(req, accessToken);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Catch 401 Unauthorized errors on protected APIs
      if (error.status === 401 && !req.url.includes('/api/v1/auth/refresh')) {
        return handle401Error(authReq, next, tokenStorage, authService);
      }

      return throwError(() => error);
    })
  );
};

function addTokenHeader(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

/**
 * Refresh Token Race Condition Safe Handler
 *
 * When multiple requests fail with 401 simultaneously:
 * 1. The FIRST request sets isRefreshing = true, locks the queue, and calls /refresh.
 * 2. SUBSEQUENT requests wait on refreshTokenSubject until the first request completes.
 * 3. Once /refresh succeeds, all waiting requests are released and re-executed with the new token.
 * 4. If /refresh fails, all waiting requests fail and the user is logged out.
 */
function handle401Error(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  tokenStorage: TokenStorageService,
  authService: AuthService
): Observable<unknown> {
  const refreshToken = tokenStorage.getRefreshToken();

  if (!refreshToken) {
    authService.logout();
    return throwError(() => new Error('No refresh token available. User logged out.'));
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null); // Reset subject while refreshing

    return authService.refreshToken({ refreshToken }).pipe(
      switchMap((res) => {
        isRefreshing = false;
        refreshTokenSubject.next(res.accessToken);
        return next(addTokenHeader(request, res.accessToken));
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        authService.logout();
        return throwError(() => err);
      })
    );
  } else {
    // Another request is already refreshing the token; queue this request
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next(addTokenHeader(request, token!)))
    );
  }
}
