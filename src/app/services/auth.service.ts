import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { JwtAuthenticationRequest, UserTokenState } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
 private get apiUrl(): string {
  return `http://${window.location.hostname}:8082/auth`;
}

  constructor(private http: HttpClient) {}

  login(credentials: JwtAuthenticationRequest): Observable<UserTokenState> {
    return this.http.post<UserTokenState>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('expiresIn', response.expiresIn.toString());
        })
      );
  }

  signup(userRequest: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/signup`, userRequest);
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
      return payload.username || payload.preferred_username || payload.sub || null;
    } catch {
      return null;
    }
  }


}
