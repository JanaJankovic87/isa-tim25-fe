import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('accessToken');
  const router = inject(Router);
  
  const requiresAuth = 
    req.method === 'POST' || 
    req.method === 'PUT' || 
    req.method === 'DELETE' ||
    req.url.includes('/comments/remaining') ||
    req.url.includes('/likes/status') ||
    req.url.includes('/my-videos');
  
  if (token && requiresAuth) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return next(cloned).pipe(
      tap({
        error: (error) => {
          if (error.status === 401) {
            localStorage.removeItem('accessToken');
            alert('Your session has expired. Please log in again.');
          }
        }
      })
    );
  }
  
  return next(req);
};