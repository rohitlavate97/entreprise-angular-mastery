import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<unknown> => {
  const authService = inject(AuthService);

  // Exclude public auth endpoints from Bearer token injection
  if (req.url.includes('/api/v1/auth/login/') || req.url.includes('/api/v1/auth/refresh/')) {
    return next(req);
  }

  const token = authService.getAccessToken();
  let authReq = req;

  if (token) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/v1/auth/refresh/')) {
        return handle401Error(authReq, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<unknown> {
  const refreshToken = authService.getRefreshToken();

  if (!refreshToken) {
    authService.logout();
    return throwError(() => new Error('No refresh token available.'));
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken(refreshToken).pipe(
      switchMap((res) => {
        isRefreshing = false;
        refreshTokenSubject.next(res.access);
        return next(request.clone({
          setHeaders: { Authorization: `Bearer ${res.access}` }
        }));
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        authService.logout();
        return throwError(() => err);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next(request.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      })))
    );
  }
}
