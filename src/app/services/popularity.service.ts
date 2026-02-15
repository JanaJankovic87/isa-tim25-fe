import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VideoPopularityDTO {
  videoId: number;
  title: string;
  thumbnailPath: string;
  popularityScore: number;
  totalViews: number;
  likesCount: number;
  location: string;
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root'
})
export class PopularityService {
  private get apiUrl(): string {
    return `http://${window.location.hostname}:8082/api/popularity`;
  }

  constructor(private http: HttpClient) {}

  getTopVideos(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/top-videos`);
  }

  runPipelineManually(): Observable<any> {
    return this.http.post(`${this.apiUrl}/run-pipeline`, {});
  }

  healthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}
