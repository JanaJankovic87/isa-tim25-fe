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

export interface TrendingResult {
  videos: TrendingVideoDTO[];
  locationInfo: LocationDTO;
  responseTimeMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocalTrendingService {
  private apiUrl = 'http://localhost:8082/api/trending';

  constructor(private http: HttpClient) {}

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
              .subscribe({
                next: (result) => {
                  console.log('Local trending result:', result);
                  observer.next(result);
                  observer.complete();
                },
                error: (error) => {
                  console.error('Local trending error:', error);
                  observer.error(error);
                }
              });
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
              .subscribe({
                next: (result) => {
                  console.log('Local trending result (IP-based):', result);
                  observer.next(result);
                  observer.complete();
                },
                error: (error) => {
                  console.error('Local trending error:', error);
                  observer.error(error);
                }
              });
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000 // 5 minuta cache
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
          .subscribe({
            next: (result) => {
              console.log('Local trending result (no geolocation):', result);
              observer.next(result);
              observer.complete();
            },
            error: (error) => {
              console.error('Local trending error:', error);
              observer.error(error);
            }
          });
      }
    });
  }

  /**
   Dobavi performance metrics
   */
  getMetrics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/metrics`);
  }

  /**
  Reset metrics (za testiranje)
   */
  resetMetrics(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/metrics/reset`, {});
  }
}