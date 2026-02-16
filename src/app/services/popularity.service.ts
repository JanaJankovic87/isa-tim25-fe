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

  private getApiUrl(): string {
    const host = window.location.hostname;
    return `http://${host}:8082/api/popularity`;
  }

  constructor(private http: HttpClient) {}

  getTopVideos(): Observable<any> {
    return this.http.get<any>(`${this.getApiUrl()}/top-videos`);
  }

  runPipelineManually(): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/run-pipeline`, {});
  }

  healthCheck(): Observable<any> {
    return this.http.get(`${this.getApiUrl()}/health`);
  }
}
