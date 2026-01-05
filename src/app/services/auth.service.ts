import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { JwtAuthenticationRequest, UserTokenState } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8082/auth';

  constructor(private http: HttpClient) {}

  login(credentials: JwtAuthenticationRequest): Observable<UserTokenState> {
    return this.http.post<UserTokenState>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('expiresIn', response.expiresIn.toString());
          // Store username for later use
          if (credentials.username) {
            localStorage.setItem('username', credentials.username);
          }
        })
      );
  }

  signup(userRequest: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/signup`, userRequest);
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('expiresIn');
    localStorage.removeItem('username');
  }

  getToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  getCurrentUser(): { username: string } | null {
    const username = localStorage.getItem('username');
    if (username) {
      return { username };
    }
    return null;
  }
}
