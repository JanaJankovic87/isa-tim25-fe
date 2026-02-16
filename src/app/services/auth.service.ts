import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { JwtAuthenticationRequest, UserTokenState } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  private getApiUrl(): string {
    const host = window.location.hostname;
    return `http://${host}:8082/auth`;
  }

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: JwtAuthenticationRequest): Observable<UserTokenState> {
    return this.http.post<UserTokenState>(`${this.getApiUrl()}/login`, credentials)
      .pipe(
        tap(response => {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('expiresIn', response.expiresIn.toString());
        })
      );
  }

  signup(userRequest: any): Observable<any> {
    return this.http.post<any>(`${this.getApiUrl()}/signup`, userRequest);
  }

  logout(): void {
    const token = this.getToken();
    const url = `${this.getApiUrl()}/logout`;

    console.log('🔓 Logging out...');
    console.log('   URL:', url);
    console.log('   Token:', token ? 'EXISTS' : 'NO TOKEN');

    if (token) {
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      this.http.post(url, {}, { headers }).subscribe({
        next: (response) => {
          console.log('✓ Logout successful:', response);
          this.clearSessionAndNavigate();
        },
        error: (err) => {
          console.error('❌ Logout error:', err);
          // Clear session and navigate even on error
          this.clearSessionAndNavigate();
        }
      });
    } else {
      console.warn('⚠ No token found, clearing session anyway');
      this.clearSessionAndNavigate();
    }
  }

  private clearSessionAndNavigate(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('expiresIn');
    try {
      this.router.navigate(['/login']);
    } catch (e) {
      // ignore navigation errors in environments where Router may not be available
    }
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