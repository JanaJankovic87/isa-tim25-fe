import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('accessToken');
  
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
    return next(cloned);
  }
  
  return next(req);
};