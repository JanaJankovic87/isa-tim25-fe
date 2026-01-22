import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TrendingVideoDTO } from '../models/video.model';

export interface LocationDTO {
  latitude: number;
  longitude: number;
  locationName?: string;
  isApproximated?: boolean;
}

// Removed duplicate TrendingVideoDTO, using the one from models/video.model.ts

export interface TrendingResult {
  videos: TrendingVideoDTO[];
  responseTimeMs: number;
  isLocationApproximated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocalTrendingService {
  private apiUrl = 'http://localhost:8082/api/trending';

  constructor(private http: HttpClient) {}

  /**
   * S2: Dobavi lokalne trending videe
   * Ako user da permission, šalje lat/lng
   * Inače backend koristi IP geolocation
   */
  getLocalTrending(radiusKm: number = 50, limit: number = 10): Observable<TrendingResult> {
    return new Observable(observer => {
      // Pokušaj da dobiješ lokaciju od korisnika (browser geolocation)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          // SUCCESS - korisnik dao permission
          (position) => {
            const params = {
              lat: position.coords.latitude.toString(),
              lng: position.coords.longitude.toString(),
              radiusKm: radiusKm.toString(),
              limit: limit.toString()
            };
            
            console.log('✓ User location obtained:', params);
            
            this.http.get<TrendingResult>(`${this.apiUrl}/local`, { params })
              .subscribe(
                result => {
                  console.log('Local trending result:', result);
                  observer.next(result);
                  observer.complete();
                },
                error => {
                  console.error('Local trending error:', error);
                  observer.error(error);
                }
              );
          },
          // ERROR - korisnik odbio ili greška
          (error) => {
            console.warn('✗ Geolocation denied, backend will use IP:', error);
            
            // Backend će automatski koristiti IP geolocation
            const params = { 
              radiusKm: radiusKm.toString(), 
              limit: limit.toString() 
            };
            
            this.http.get<TrendingResult>(`${this.apiUrl}/local`, { params })
              .subscribe(
                result => {
                  console.log('Local trending result (IP-based):', result);
                  observer.next(result);
                  observer.complete();
                },
                error => {
                  console.error('Local trending error:', error);
                  observer.error(error);
                }
              );
          }
        );
      } else {
        // Browser ne podržava geolocation
        console.warn('Geolocation not supported, backend will use IP');
        const params = { 
          radiusKm: radiusKm.toString(), 
          limit: limit.toString() 
        };
        
        this.http.get<TrendingResult>(`${this.apiUrl}/local`, { params })
          .subscribe(
            result => {
              console.log('Local trending result (no geolocation):', result);
              observer.next(result);
              observer.complete();
            },
            error => {
              console.error('Local trending error:', error);
              observer.error(error);
            }
          );
      }
    });
  }

  /**
   * S2: Dobavi performance metrics
   */
  getMetrics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/metrics`);
  }

  /**
   * S2: Reset metrics (za testiranje)
   */
  resetMetrics(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/metrics/reset`, {});
  }
}