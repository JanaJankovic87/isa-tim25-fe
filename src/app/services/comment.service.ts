import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Comment, CommentPage, CommentResponse, RemainingCommentsResponse } from '../models/comment.model';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  
  private apiUrl = 'http://localhost:8082/api/videos';

  constructor(private http: HttpClient) {}

  createComment(videoId: number, text: string): Observable<CommentResponse> {
    const body = { text };
    return this.http.post<CommentResponse>(
      `${this.apiUrl}/${videoId}/comments`,
      body
    );
  }

  getComments(videoId: number, page: number = 0, size: number = 20): Observable<CommentPage> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('_t', Date.now().toString());
    
    return this.http.get<CommentPage>(
      `${this.apiUrl}/${videoId}/comments`,
      { params }
    );
  }

  getRemainingComments(videoId: number): Observable<RemainingCommentsResponse> {
    return this.http.get<RemainingCommentsResponse>(
      `${this.apiUrl}/${videoId}/comments/remaining`
    );
  }
}
