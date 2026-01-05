import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('accessToken');
  
  // Proveri da li je zahtev ka protected endpointima koji zahtevaju token
  const requiresAuth = 
    req.method === 'POST' || 
    req.method === 'PUT' || 
    req.method === 'DELETE' ||
    req.url.includes('/comments/remaining') ||
    req.url.includes('/likes/status');
  
  // Dodaj token ako je potreban
  if (token && requiresAuth) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  
  // Ostali zahtevi bez tokena (javni pristup)
  return next(req);
};