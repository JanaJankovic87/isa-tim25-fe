import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Video } from '../models/video.model';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  
  private apiUrl = 'http://localhost:8082/api/videos';

  constructor(private http: HttpClient) {}

  /**
   * POST /api/videos/ - Kreira video (zahteva JWT token)
   */
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
      // userId se NE šalje - backend automatski uzima ulogovanog!
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

  /**
   * GET /api/videos/ - Dobija listu svih videa (JAVNO)
   */
  getVideos(): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/`).pipe(
      catchError(error => {
        console.error('Get videos error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * GET /api/videos/{id} - Dobija jedan video (JAVNO)
   */
  getVideo(id: number): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error('Get video error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * DELETE /api/videos/{id} - Briše video (zahteva JWT token)
   */
  deleteVideo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error('Delete video error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * GET /api/videos/{id}/thumbnail - Vraća URL za thumbnail
   */
  getThumbnailUrl(id: number): string {
    return `${this.apiUrl}/${id}/thumbnail`;
  }

  /**
   * GET /api/videos/{id}/video - Vraća URL za video stream
   */
  getVideoUrl(id: number): string {
    return `${this.apiUrl}/${id}/video`;
  }
}