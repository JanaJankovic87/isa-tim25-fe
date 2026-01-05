import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Video } from '../../models/video.model';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { CommentsComponent } from '../comments/comments.component';

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [CommonModule, CommentsComponent],
  templateUrl: './video-detail.component.html',
  styleUrl: './video-detail.component.css'
})
export class VideoDetailComponent implements OnInit {
  video: Video = {
    title: '',
    description: '',
    tags: []
  };
  videoId: string | null = null;
  debugMessage = 'Starting...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private videoService: VideoService,
    public authService: AuthService
  ) {
    console.log('Constructor called');
    this.debugMessage = 'Constructor done';
  }

  parseBackendDate(dateArray: any): Date | null {
    if (!dateArray || !Array.isArray(dateArray)) return null;
    const [year, month, day, hour, minute, second] = dateArray;
    return new Date(year, month - 1, day, hour, minute, second);
  }

  formatDate(dateArray: any): string {
    const date = this.parseBackendDate(dateArray);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  ngOnInit(): void {
    console.log('ngOnInit called');
    this.debugMessage = 'ngOnInit started';

    this.route.params.subscribe(params => {
      this.videoId = params['id'];
      console.log('[DEBUG] Route params changed, videoId:', this.videoId);
      this.debugMessage = `[DEBUG] Route params changed, videoId: ${this.videoId}`;

      // Resetuj video na prazan objekat svaki put kad se promeni ID
      this.video = {
        title: '',
        description: '',
        tags: []
      };
      console.log('[DEBUG] Video resetovan na prazan objekat');

      if (this.videoId) {
        console.log('[DEBUG] Pokrećem HTTP zahtev...');
        this.debugMessage = '[DEBUG] Pokrećem HTTP zahtev...';

        const url = `http://localhost:8082/api/videos/${this.videoId}?nocache=${Date.now()}`;
        console.log('[DEBUG] URL zahteva:', url);

        const headers = new HttpHeaders({ 'Cache-Control': 'no-cache' });
        this.http.get<any>(url, { headers }).subscribe({
          next: (data) => {
            console.log('[DEBUG] SUCCESS! Data:', data);
            this.debugMessage = '[DEBUG] Data received!';
            this.video = data;
            
            this.loadLikeData();
            
            this.cdr.detectChanges();
            console.log('[DEBUG] this.video:', this.video);
          },
          error: (error) => {
            console.error('[DEBUG] ERROR:', error);
            this.debugMessage = `[DEBUG] Error: ${error.message}`;
          },
          complete: () => {
            console.log('[DEBUG] Complete');
          }
        });

        // ✅ Test - postavi fake video posle 2 sekunde
        setTimeout(() => {
          if (!this.video || !this.video.title) {
            console.log('[DEBUG] Setting fake video after 2s');
            this.video = {
              id: 999,
              title: 'FAKE TEST VIDEO',
              description: 'If you see this, HTTP request failed',
              tags: ['test']
            } as any;
          }
        }, 2000);

      } else {
        this.debugMessage = '[DEBUG] NO VIDEO ID!';
      }
    });
  }

  loadLikeData(): void {
    if (!this.videoId) return;

    this.videoService.getLikesCount(Number(this.videoId)).subscribe({
      next: (count) => {
        this.video.likesCount = count;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading likes count:', err);
        this.video.likesCount = 0;
      }
    });

    if (this.authService.isLoggedIn()) {
      this.videoService.getLikeStatus(Number(this.videoId)).subscribe({
        next: (isLiked) => {
          this.video.likedByCurrentUser = isLiked;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading like status:', err);
          this.video.likedByCurrentUser = false;
        }
      });
    } else {
      this.video.likedByCurrentUser = false;
    }
  }

  getVideoUrl(): string {
    return `http://localhost:8082/api/videos/${this.videoId}/video`;
  }

  getCurrentUserId(): number | null {
    const token = this.authService.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.id || payload.sub || null;
    } catch {
      return null;
    }
  }

  isMyVideo(): boolean {
    const currentUserId = this.getCurrentUserId();
    return currentUserId !== null && this.video.userId === currentUserId;
  }

  toggleLike(): void {
    if (!this.videoId) return;

    const isCurrentlyLiked = this.video.likedByCurrentUser;
    
    const request = isCurrentlyLiked 
      ? this.videoService.unlikeVideo(Number(this.videoId))
      : this.videoService.likeVideo(Number(this.videoId));

    request.subscribe({
      next: (response) => {
        console.log('Like toggled:', response);
        // Refresh like data
        this.loadLikeData();
      },
      error: (err) => {
        console.error('Error toggling like:', err);
        alert('Error liking video!');
      }
    });
  }

  deleteVideo(): void {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    if (!this.videoId) {
      alert('Invalid video ID');
      return;
    }

    this.videoService.deleteVideo(Number(this.videoId)).subscribe({
      next: () => {
        console.log('Video deleted successfully');
        alert('Video deleted successfully!');
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Error deleting video:', err);
        alert('Error deleting video!');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}