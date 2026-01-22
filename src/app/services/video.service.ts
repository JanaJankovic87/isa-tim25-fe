import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Video, TrendingVideoDTO } from '../models/video.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  
  private apiUrl = 'http://localhost:8082/api/videos';

  constructor(private http: HttpClient, private authService: AuthService) {}

  createVideo(
    title: string,
    description: string,
    tags: string[],
    location: string | null,
    thumbnail: File,
    video: File,
    onProgress?: (progress: number) => void
  ): Observable<any> {
    const formData = new FormData();
    
    const dto = {
      title: title,
      description: description,
      tags: tags,
      location: location
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
    return this.http.get<Video[]>(`${this.apiUrl}/`).pipe(
      catchError(error => {
        console.error('Get videos error:', error);
        return throwError(() => error);
      })
    );
  }

  getVideo(id: number): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error('Get video error:', error);
        return throwError(() => error);
      })
    );
  }

  deleteVideo(id: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = token ? new HttpHeaders({ 'Authorization': `Bearer ${token}` }) : undefined;
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers }).pipe(
      catchError(error => {
        console.error('Delete video error:', error);
        return throwError(() => error);
      })
    );
  }

  
  searchVideos(keyword: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/search`, {
      params: { keyword }
    }).pipe(
      catchError(error => {
        console.error('Search videos error:', error);
        return throwError(() => error);
      })
    );
  }


  filterByTag(tag: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/filter`, {
      params: { tag }
    }).pipe(
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  getAllTags(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/tags`).pipe(
      catchError(error => {
        console.error('Get all tags error:', error);
        return throwError(() => error);
      })
    );
  }


  likeVideo(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/like`, {}, { responseType: 'text' }).pipe(
      catchError(error => {
        console.error('Like video error:', error);
        return throwError(() => error);
      })
    );
  }

  
  unlikeVideo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/like`, { responseType: 'text' }).pipe(
      catchError(error => {
        console.error('Unlike video error:', error);
        return throwError(() => error);
      })
    );
  }

  
  getLikesCount(id: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/${id}/likes/count`).pipe(
      catchError(error => {
        console.error('Get likes count error:', error);
        return throwError(() => error);
      })
    );
  }

  
  getLikeStatus(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${id}/likes/status`).pipe(
      catchError(error => {
        console.error('Get like status error:', error);
        return throwError(() => error);
      })
    );
  }
  getMyVideos(): Observable<Video[]> {
    const token = localStorage.getItem('accessToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    // Send explicit Authorization header as some GET endpoints require it
    return this.http.get<Video[]>(`${this.apiUrl}/my-videos`, headers ? { headers } : {}).pipe(
      catchError(error => {
        console.error('Get my videos error:', error);
        return throwError(() => error);
      })
    );
  }
  getThumbnailUrl(id: number): string {
    return `${this.apiUrl}/${id}/thumbnail`;
  }
  getVideoUrl(id: number): string {
    return `${this.apiUrl}/${id}/video`;
  }
  recordView(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/view`, {}, { responseType: 'text' }).pipe(
      catchError(error => {
        console.error('Record view error:', error);
        return throwError(() => error);
      })
    );
  }
  getViewCount(id: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/${id}/views/count`).pipe(
      catchError(error => {
        console.error('Get view count error:', error);
        return throwError(() => error);
      })
    );
  }

  getTrendingVideos(): Observable<TrendingVideoDTO[]> {
    return this.http.get<TrendingVideoDTO[]>(`${this.apiUrl}/trending`).pipe(
      catchError(error => {
        console.error('Get trending videos error:', error);
        return throwError(() => error);
      })
    );
  }

  
}