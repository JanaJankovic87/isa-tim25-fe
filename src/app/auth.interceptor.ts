import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('accessToken');
  const router = inject(Router);

  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next(cloned).pipe(
      tap({
        error: (error) => {
          if (error && error.status === 401) {
            console.error('401 on:', req.url, error);
           
          }
        }
      })
    );
  }

  return next(req);
};