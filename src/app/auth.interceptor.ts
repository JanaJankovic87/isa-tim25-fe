import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('accessToken');
  
  // Dodaj token samo za zahteve koji zahtevaju autentifikaciju (POST, PUT, DELETE)
  if (token && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE')) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  
  // GET zahtevi ne trebaju token (javni pristup)
  return next(req);
};