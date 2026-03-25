import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError, share } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

// Shared refresh observable — prevents concurrent refresh calls
let refreshInProgress$: ReturnType<typeof from> | null = null;

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.accessToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.url.includes('/auth/refresh') &&
        !req.url.includes('/auth/login')
      ) {
        if (!refreshInProgress$) {
          refreshInProgress$ = from(authService.refresh()).pipe(
            share(),
          );
          refreshInProgress$.subscribe({ complete: () => { refreshInProgress$ = null; } });
        }

        return refreshInProgress$.pipe(
          switchMap((refreshed) => {
            if (refreshed) {
              const newToken = authService.accessToken();
              const retryReq = newToken
                ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
                : req;
              return next(retryReq);
            }
            router.navigate(['/login']);
            return throwError(() => error);
          }),
          catchError(() => {
            router.navigate(['/login']);
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    })
  );
};
