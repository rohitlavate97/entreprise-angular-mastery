import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiErrorResponse } from '../models/api-error.model';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let formattedError: ApiErrorResponse;

      if (error.error && typeof error.error === 'object' && 'errorCode' in error.error) {
        // Backend returned standard ApiErrorResponse
        formattedError = error.error as ApiErrorResponse;
      } else {
        // Network, Proxy or Gateway error
        formattedError = {
          timestamp: new Date().toISOString(),
          status: error.status || 0,
          errorCode: error.status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR',
          message: error.message || 'An unexpected communication error occurred.',
          traceId: req.headers.get('X-Request-ID') || undefined
        };
      }

      console.error(
        `[HTTP Error ${formattedError.status}] [${formattedError.errorCode}] ` +
        `[traceId: ${formattedError.traceId || 'N/A'}]: ${formattedError.message}`
      );

      return throwError(() => formattedError);
    })
  );
};
