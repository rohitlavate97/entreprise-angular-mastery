import { HttpInterceptorFn } from '@angular/common/http';

export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const traceId = crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`;

  const clonedRequest = req.clone({
    setHeaders: {
      'X-Request-ID': traceId
    }
  });

  return next(clonedRequest);
};
