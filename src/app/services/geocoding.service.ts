import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private ipapiUrl = 'https://ipapi.co/json/';
  private nominatimReverseUrl = 'https://nominatim.openstreetmap.org/reverse';

  constructor(private http: HttpClient) {}

  /**
   Get user's location based on their IP address
   */
  getLocationFromIP(): Observable<GeocodingResult | null> {
    return this.http.get<any>(this.ipapiUrl).pipe(
      map(response => {
        if (response && response.latitude && response.longitude) {
          return {
            latitude: response.latitude,
            longitude: response.longitude,
            city: response.city || '',
            region: response.region || '',
            country: response.country_name || '',
            displayName: this.formatLocation(response)
          };
        }
        return null;
      }),
      catchError(error => {
        console.error('IP Geolocation error:', error);
        return of(null);
      })
    );
  }

  /**
   * Reverse geocode: Get location name from coordinates
   * @param latitude 
   * @param longitude 
   * @returns Observable with location details
   */
  reverseGeocode(latitude: number, longitude: number): Observable<GeocodingResult | null> {
    const params = {
      lat: latitude.toString(),
      lon: longitude.toString(),
      format: 'json',
      addressdetails: '1'
    };

    return this.http.get<any>(this.nominatimReverseUrl, { params }).pipe(
      delay(1000), // Nominatim requires 1 second between requests
      map(response => {
        if (response && response.address) {
          const addr = response.address;
          return {
            latitude: latitude,
            longitude: longitude,
            city: addr.city || addr.town || addr.village || addr.municipality || '',
            region: addr.state || addr.region || '',
            country: addr.country || '',
            displayName: this.formatNominatimLocation(addr)
          };
        }
        return null;
      }),
      catchError(error => {
        console.error('Reverse geocoding error:', error);
        return of(null);
      })
    );
  }

  /**
   Get user's current position using browser Geolocation API
   */
  getCurrentPosition(): Observable<GeocodingResult | null> {
    return new Observable(observer => {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        observer.next(null);
        observer.complete();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // Call reverse geocode to get the city name
          this.reverseGeocode(lat, lng).subscribe({
            next: (result) => {
              if (result) {
                observer.next(result);
              } else {
                // Fallback if reverse geocoding fails
                observer.next({
                  latitude: lat,
                  longitude: lng,
                  city: '',
                  region: '',
                  country: '',
                  displayName: 'Current GPS Location'
                });
              }
              observer.complete();
            },
            error: (error) => {
              console.error('Reverse geocoding failed:', error);
              // Return coordinates without location name
              observer.next({
                latitude: lat,
                longitude: lng,
                city: '',
                region: '',
                country: '',
                displayName: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
              });
              observer.complete();
            }
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          observer.next(null);
          observer.complete();
        }
      );
    });
  }

  /**
   * Format location string from ipapi response
   */
  private formatLocation(response: any): string {
    const parts = [];
    
    if (response.city) parts.push(response.city);
    if (response.region && response.region !== response.city) parts.push(response.region);
    if (response.country_name) parts.push(response.country_name);
    
    return parts.join(', ');
  }

  /**
   * Format location string from Nominatim response
   */
  private formatNominatimLocation(address: any): string {
    const parts = [];
    
    // Try different city fields
    const city = address.city || address.town || address.village || address.municipality;
    if (city) parts.push(city);
    
    // Add state/region if different from city
    if (address.state && address.state !== city) parts.push(address.state);
    
    // Add country
    if (address.country) parts.push(address.country);
    
    return parts.join(', ');
  }
}