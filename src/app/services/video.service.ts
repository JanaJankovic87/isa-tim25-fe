import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Video, TrendingVideoDTO } from '../models/video.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class VideoService {

 
  private get apiUrl(): string {
    return `http://${window.location.hostname}:8082/api/videos`;
  }

  constructor(private http: HttpClient, private authService: AuthService) {}

  createVideo(
    title: string,
    description: string,
    tags: string[],
    location: string | null,
    latitude: number | null,
    longitude: number | null,
    thumbnail: File,
    video: File,
    onProgress?: (progress: number) => void
  ): Observable<any> {
    const formData = new FormData();

    const dto = {
      title,
      description,
      tags,
      location,
      latitude,
      longitude,
      isLocationApproximated: true
    };

    formData.append('data', JSON.stringify(dto));
    formData.append('thumbnail', thumbnail, thumbnail.name);
    formData.append('video', video, video.name);

    return this.http.post(`${this.apiUrl}/`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = Math.round(100 * event.loaded / (event.total || event.loaded));
          if (onProgress) onProgress(progress);
        } else if (event.type === HttpEventType.Response) {
          return event.body;
        }
        return null;
      }),
      catchError(error => throwError(() => error))
    );
  }

  getVideos(): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/`).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getVideo(id: number): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => throwError(() => error))
    );
  }

  deleteVideo(id: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = token ? new HttpHeaders({ 'Authorization': `Bearer ${token}` }) : undefined;
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  searchVideos(keyword: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/search`, { params: { keyword } }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  likeVideo(id: number, lat?: number | null, lng?: number | null): Observable<any> {
    let body: any = {};
    if (typeof lat === 'number' && typeof lng === 'number') {
      body = { latitude: lat, longitude: lng, locationName: 'GPS Location', isApproximated: false };
    }
    return this.http.post(`${this.apiUrl}/${id}/like`, body, { responseType: 'text' as const }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  unlikeVideo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/like`, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getLikesCount(id: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/${id}/likes/count`).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getLikeStatus(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${id}/likes/status`).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getThumbnailUrl(id: number): string {
    return `http://${window.location.hostname}:8082/api/videos/${id}/thumbnail`;
  }

  getVideoUrl(id: number): string {
    return `http://${window.location.hostname}:8082/api/videos/${id}/video`;
  }

  getVideoUrlByPreset(id: number, preset: string): string {
    return `http://${window.location.hostname}:8082/api/videos/${id}/video/${preset}`;
  }

  getAvailablePresets(id: number): Observable<{[key: string]: boolean}> {
    return this.http.get<{[key: string]: boolean}>(`${this.apiUrl}/${id}/presets`).pipe(
      catchError(() => of({'720p': false, '480p': false}))
    );
  }

  getTranscodingStatus(videoId: number): Observable<string> {
    return this.http.get<{status: string}>(`${this.apiUrl}/${videoId}/transcoding-status`).pipe(
      map(r => r.status),
      catchError(() => of('PENDING'))
    );
  }

  recordView(id: number, lat?: number | null, lng?: number | null): Observable<any> {
    let body: any = {};
    if (typeof lat === 'number' && typeof lng === 'number') {
      body = { latitude: lat, longitude: lng, locationName: 'GPS Location', isApproximated: false };
    }
    return this.http.post(`${this.apiUrl}/${id}/view`, body, { responseType: 'text' as const }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getViewCount(id: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/${id}/views/count`).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getTrendingVideos(): Observable<TrendingVideoDTO[]> {
    return this.http.get<TrendingVideoDTO[]>(`${this.apiUrl}/trending`).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getMyVideos(): Observable<Video[]> {
    const token = localStorage.getItem('accessToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<Video[]>(`${this.apiUrl}/my-videos`, headers ? { headers } : {}).pipe(
      catchError(error => throwError(() => error))
    );
  }

  filterByTag(tag: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/filter`, { params: { tag } }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  getAllTags(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/tags`).pipe(
      catchError(error => throwError(() => error))
    );
  }
}