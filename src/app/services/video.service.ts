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
  
  private getApiUrl(): string {
    const host = window.location.hostname;
    return `http://${host}:8082/api/videos`;
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
    onProgress?: (progress: number) => void,
    scheduledTime?: string | null
  ): Observable<any> {
    const formData = new FormData();
    
    const dto: any = {
      title: title,
      description: description,
      tags: tags,
      location: location,
      latitude: latitude,
      longitude: longitude,
      isLocationApproximated: true // jer koristimo geocoding, nije tačna GPS lokacija
    };
    
    if (scheduledTime) {
      dto.scheduledTime = scheduledTime;
      dto.isScheduled = true;
    }
    
    formData.append('data', JSON.stringify(dto));
    formData.append('thumbnail', thumbnail, thumbnail.name);
    formData.append('video', video, video.name);

    return this.http.post(`${this.getApiUrl()}/`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = Math.round(100 * event.loaded / (event.total || event.loaded));
          if (onProgress) {
            onProgress(progress);
          }
        } else if (event.type === HttpEventType.Response) {
          return event.body;
        }
        return null;
      }),
      catchError(error => {
        console.error('Upload error:', error);
        return throwError(() => error);
      })
    );
  }

  getVideos(): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.getApiUrl()}/`).pipe(
      catchError(error => {
        console.error('Get videos error:', error);
        return throwError(() => error);
      })
    );
  }

  getVideo(id: number): Observable<Video> {
    return this.http.get<Video>(`${this.getApiUrl()}/${id}`).pipe(
      catchError(error => {
        console.error('Get video error:', error);
        return throwError(() => error);
      })
    );
  }

  deleteVideo(id: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = token ? new HttpHeaders({ 'Authorization': `Bearer ${token}` }) : undefined;
    return this.http.delete<void>(`${this.getApiUrl()}/${id}`, { headers }).pipe(
      catchError(error => {
        console.error('Delete video error:', error);
        return throwError(() => error);
      })
    );
  }

  searchVideos(keyword: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.getApiUrl()}/search`, {
      params: { keyword }
    }).pipe(
      catchError(error => {
        console.error('Search videos error:', error);
        return throwError(() => error);
      })
    );
  }

  filterByTag(tag: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.getApiUrl()}/filter`, {
      params: { tag }
    }).pipe(
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  getAllTags(): Observable<string[]> {
    return this.http.get<string[]>(`${this.getApiUrl()}/tags`).pipe(
      catchError(error => {
        console.error('Get all tags error:', error);
        return throwError(() => error);
      })
    );
  }

  likeVideo(id: number, lat?: number | null, lng?: number | null): Observable<any> {
    const url = `${this.getApiUrl()}/${id}/like`;
    
    let body: any = {};
    
    if (typeof lat === 'number' && typeof lng === 'number') {
      body = {
        latitude: lat,
        longitude: lng,
        locationName: 'GPS Location',
        isApproximated: false
      };
    } 

    return this.http.post(url, body, { responseType: 'text' as const }).pipe(
      catchError(error => {
        console.error('Like video error:', error);
        return throwError(() => error);
      })
    );
  }
  
  unlikeVideo(id: number): Observable<any> {
    return this.http.delete(`${this.getApiUrl()}/${id}/like`, { responseType: 'text' }).pipe(
      catchError(error => {
        console.error('Unlike video error:', error);
        return throwError(() => error);
      })
    );
  }

  getLikesCount(id: number): Observable<number> {
    return this.http.get<number>(`${this.getApiUrl()}/${id}/likes/count`).pipe(
      catchError(error => {
        console.error('Get likes count error:', error);
        return throwError(() => error);
      })
    );
  }

  getLikeStatus(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.getApiUrl()}/${id}/likes/status`).pipe(
      catchError(error => {
        console.error('Get like status error:', error);
        return throwError(() => error);
      })
    );
  }

  getMyVideos(): Observable<Video[]> {
    const token = localStorage.getItem('accessToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    return this.http.get<Video[]>(`${this.getApiUrl()}/my-videos`, headers ? { headers } : {}).pipe(
      catchError(error => {
        console.error('Get my videos error:', error);
        return throwError(() => error);
      })
    );
  }

  getThumbnailUrl(id: number): string {
    return `${this.getApiUrl()}/${id}/thumbnail`;
  }

  getVideoUrl(id: number): string {
    return `${this.getApiUrl()}/${id}/video`;
  }

  // Dobijanje URL-a za video sa određenim kvalitetom (preset)
  getVideoUrlByPreset(id: number, preset: string): string {
    return `${this.getApiUrl()}/${id}/video/${preset}`;
  }

  getAvailablePresets(id: number): Observable<{[key: string]: boolean}> {
    return this.http.get<{[key: string]: boolean}>(`${this.getApiUrl()}/${id}/presets`).pipe(
      catchError(() => of({'720p': false, '480p': false}))
    );
  }

  getTranscodingStatus(videoId: number): Observable<string> {
    return this.http.get<{status: string}>(`${this.getApiUrl()}/${videoId}/transcoding-status`).pipe(
      map(r => r.status),
      catchError(() => of('PENDING'))
    );
  }

  recordView(id: number, lat?: number | null, lng?: number | null): Observable<any> {
    const url = `${this.getApiUrl()}/${id}/view`;

    let body: any = {};

    if (typeof lat === 'number' && typeof lng === 'number') {
      body = {
        latitude: lat,
        longitude: lng,
        locationName: 'GPS Location',
        isApproximated: false
      };
    }

    return this.http.post(url, body, { responseType: 'text' as const }).pipe(
      catchError(error => {
        console.error('Record view error:', error);
        return throwError(() => error);
      })
    );
  }

  getViewCount(id: number): Observable<number> {
    return this.http.get<number>(`${this.getApiUrl()}/${id}/views/count`).pipe(
      catchError(error => {
        console.error('Get view count error:', error);
        return throwError(() => error);
      })
    );
  }

  getTrendingVideos(): Observable<TrendingVideoDTO[]> {
    return this.http.get<TrendingVideoDTO[]>(`${this.getApiUrl()}/trending`).pipe(
      catchError(error => {
        console.error('Get trending videos error:', error);
        return throwError(() => error);
      })
    );
  }


  getVideoAvailability(id: number): Observable<any> {
    return this.http.get<any>(`${this.getApiUrl()}/${id}/availability`).pipe(

      catchError(error => {
        console.error('Get video availability error:', error);
        return throwError(() => error);
      })
    );
  }

  getPlaybackState(id: number): Observable<any> {

    return this.http.get<any>(`${this.getApiUrl()}/${id}/playback-state`).pipe(

      catchError(error => {
        console.error('Get playback state error:', error);
        return throwError(() => error);
      })
    );
  }

}