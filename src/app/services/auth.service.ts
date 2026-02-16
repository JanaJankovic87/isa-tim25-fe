import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  constructor(private http: HttpClient) {}

  login(credentials: JwtAuthenticationRequest): Observable<UserTokenState> {
    return this.http.post<UserTokenState>(`${this.getApiUrl()}/login`, credentials)  // ✅ Zagrada UNUTAR backticks!
      .pipe(
        tap(response => {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('expiresIn', response.expiresIn.toString());
        })
      );
  }

  signup(userRequest: any): Observable<any> {
    return this.http.post<any>(`${this.getApiUrl()}/signup`, userRequest);  // ✅ Ispravljeno!
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
}