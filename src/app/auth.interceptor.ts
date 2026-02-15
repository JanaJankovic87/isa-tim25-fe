import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { JwtAuthenticationRequest, UserTokenState } from './models/auth.model';
import { ConnectionSettingsService } from './services/connection-settings.service';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';

// HTTP Interceptor function for Angular's withInterceptors
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  return next(req);
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  constructor(
    private http: HttpClient,
    private connectionSettingsService: ConnectionSettingsService
  ) {}

  login(credentials: JwtAuthenticationRequest): Observable<UserTokenState> {
    const apiUrl = this.connectionSettingsService.getApiUrl();
    return this.http.post<UserTokenState>(`${apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('expiresIn', response.expiresIn.toString());
        })
      );
  }

  signup(userRequest: any): Observable<any> {
    const apiUrl = this.connectionSettingsService.getApiUrl();
    return this.http.post<any>(`${apiUrl}/signup`, userRequest);
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('expiresIn');
  }

  getToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  getUserId(): number | null {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.id || payload.sub || null;
    } catch {
      return null;
    }
  }
 
  getUsername(): string | null {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.username || payload.sub || null;
    } catch {
      return null;
    }
  }

  getWsUrl(): string {
    return this.connectionSettingsService.getWsUrl();
  }

  getApiUrl(): string {
    return this.connectionSettingsService.getApiUrl();
  }
}