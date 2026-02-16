import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PerformanceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  strategies: { [key: string]: StrategyMetrics };
  responseTimeHistory: { [key: string]: number[] };
}

export interface StrategyMetrics {
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  totalRequests: number;
  cacheHits: number;
  cacheHitRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceService {

 private get apiUrl(): string {
  return `http://${window.location.hostname}:8082/api/trending`;
}

  constructor(private http: HttpClient) {}

  getMetrics(): Observable<PerformanceMetrics> {
    return this.http.get<PerformanceMetrics>(`${this.apiUrl}/metrics`);
  }

  resetMetrics(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/metrics/reset`, {});
  }

  runPerformanceTest(iterations: number, lat?: number, lng?: number): Observable<PerformanceMetrics> {
    let params: any = { iterations: iterations.toString() };
    if (lat && lng) {
      params.lat = lat.toString();
      params.lng = lng.toString();
    }
    return this.http.get<PerformanceMetrics>(`${this.apiUrl}/performance-test`, { params });
  }

  testStrategy(strategy: string, lat?: number, lng?: number): Observable<any> {
    let params: any = { strategy };
    if (lat && lng) {
      params.lat = lat.toString();
      params.lng = lng.toString();
    }
    return this.http.get(`${this.apiUrl}/test-strategy`, { params });
  }
}