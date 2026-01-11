import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Video } from '../../models/video.model';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { CommentsComponent } from '../comments/comments.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [CommonModule, CommentsComponent, RouterLink],
  templateUrl: './video-detail.component.html',
  styleUrl: './video-detail.component.css'
})
export class VideoDetailComponent implements OnInit, AfterViewInit {
  video: Video = {
    title: '',
    description: '',
    tags: []
  };
  videoId: string | null = null;
  viewCount: number = 0;
  videoAuthor: { firstName: string, lastName: string } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private videoService: VideoService,
    public authService: AuthService
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        setTimeout(() => window.scrollTo(0, 0), 0);
      });
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
    window.scrollTo(0, 0);

    this.route.params.subscribe(params => {
      window.scrollTo(0, 0);
      this.videoId = params['id'];

      this.video = {
        title: '',
        description: '',
        tags: []
      };

      if (this.videoId) {
        const url = `http://localhost:8082/api/videos/${this.videoId}?nocache=${Date.now()}`;

        const headers = new HttpHeaders({ 'Cache-Control': 'no-cache' });
        this.http.get<any>(url, { headers }).subscribe({
          next: (data) => {
            this.video = data;
            this.loadLikeData();
            this.handleViews();
            
            if (data.userId != null && data.userId != undefined) {
              this.loadVideoAuthor();
            }
            
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading video:', error);
          }
        });
      }
    });
  }

  ngAfterViewInit(): void {
    window.scrollTo(0, 0);
  }

  // Poziva se nakon što se video učita
  handleViews(): void {
    if (!this.videoId || !this.video || !this.video.id) return;
    // Ako nije autor videa, registruj pregled
    if (!this.isMyVideo()) {
      this.videoService.recordView(Number(this.videoId)).subscribe({
        next: () => {
          this.loadViewCount();
        },
        error: () => {
          this.loadViewCount();
        }
      });
    } else {
      this.loadViewCount();
    }
  }

  // Učitava broj pregleda
  loadViewCount(): void {
    if (!this.videoId) return;
    this.videoService.getViewCount(Number(this.videoId)).subscribe({
      next: (count) => {
        this.viewCount = count;
        this.cdr.detectChanges();
      },
      error: () => {
        this.viewCount = 0;
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

    if (!this.authService.isLoggedIn()) {
      this.showLoginRequired('like');
      return;
    }

    const isCurrentlyLiked = this.video.likedByCurrentUser;
    
    const request = isCurrentlyLiked 
      ? this.videoService.unlikeVideo(Number(this.videoId))
      : this.videoService.likeVideo(Number(this.videoId));

    request.subscribe({
      next: (response) => {
        console.log('Like toggled:', response);
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

  showLoginRequired(action: string): void {
    const actionText = action === 'like' ? 'like videos' : 'comment on videos';
    alert(`You must be logged in to ${actionText}. Please log in or sign up to continue.`);
  }

  loadVideoAuthor(): void {
    if (this.video.userId == null || this.video.userId == undefined) {
      return;
    }
    
    this.http.get<any>(`http://localhost:8082/api/users/${this.video.userId}/profile`)
      .subscribe({
        next: (data) => {
          this.videoAuthor = {
            firstName: data.firstName,
            lastName: data.lastName
          };
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading video author:', err);
        }
      });
  }
}