
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Video } from '../../models/video.model';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { CommentsComponent } from '../comments/comments.component';
import { filter, switchMap, takeWhile } from 'rxjs/operators';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentsComponent, RouterLink],
  templateUrl: './video-detail.component.html',
  styleUrls: ['./video-detail.component.css']
})
export class VideoDetailComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('videoPlayer') videoPlayer?: ElementRef<HTMLVideoElement>;

    // Controls rendering of video element to avoid brief black frame while switching
    isVideoLoaded: boolean = true;

    getThumbnailUrl(id?: number): string {
      if (typeof id === 'number' && !isNaN(id)) {
        return this.videoService.getThumbnailUrl(id);
      }
      return 'https://via.placeholder.com/160x120?text=No+Thumbnail';
    }
  video: Video = {
    title: '',
    description: '',
    tags: []
  };
  videoId: string | null = null;
  viewCount: number = 0;
  videoAuthor: { firstName: string, lastName: string } | null = null;
  recommendedVideos: Video[] = [];

  // Quality selector (transcoding presets)
  availableQualities: string[] = ['480p', '720p'];
  selectedQuality: string = 'original'; 
  availablePresets: {[key: string]: boolean} = {
    '720p': false,
    '480p': false
  };
  transcodingInProgress: boolean = false;

  presetsChecked: boolean = false;


  transcodingStatus: string = 'PENDING';
  private pollingSubscription?: Subscription;

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

  viewVideo(id: number): void {
    if (!id) return;
    this.router.navigate(['/video', id]);
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
        const url = `http://${window.location.hostname}:8082/api/videos/${this.videoId}?nocache=${Date.now()}`;
        const headers = new HttpHeaders({ 'Cache-Control': 'no-cache' });
        this.http.get<any>(url, { headers }).subscribe({
          next: (data) => {
            this.video = data;
              this.isVideoLoaded = true;
              this.checkAvailablePresets();
              this.startTranscodingPolling();
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
        // Učitaj preporučene videe (sve osim trenutnog)
        this.videoService.getVideos().subscribe({
          next: (videos) => {
            this.recommendedVideos = videos
              .filter(v => v.id !== Number(this.videoId))
              .map(v => ({
                ...v,
                viewsCount: 0,
                thumbnailPath: v.thumbnailPath && v.thumbnailPath !== '' ? v.thumbnailPath : undefined
              }));
            // Fetch view count for each recommended video
            this.recommendedVideos.forEach(v => {
              if (v.id) {
                this.videoService.getViewCount(v.id).subscribe({
                  next: (count) => {
                    v.viewsCount = count;
                    this.cdr.detectChanges();
                  },
                  error: () => {
                    v.viewsCount = 0;
                  }
                });
              } else {
                v.viewsCount = 0;
              }
            });
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.recommendedVideos = [];
          }
        });
      }
    });
  }

  checkAvailablePresets(): void {
    if (!this.videoId) return;
    this.videoService.getAvailablePresets(Number(this.videoId)).subscribe({
      next: (presets) => {
        this.availablePresets = presets;

        const anyAvailable = Object.values(presets).some(v => v === true);
        this.transcodingInProgress = !anyAvailable;

        // Always default to original
        this.selectedQuality = 'original';

       
        this.presetsChecked = true;

        if (this.transcodingInProgress) {
          setTimeout(() => this.checkAvailablePresets(), 5000);
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error checking presets:', err);
   
        this.presetsChecked = true;
        this.cdr.detectChanges();
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
      const doRecord = (lat?: number, lng?: number) => {
        this.videoService.recordView(Number(this.videoId), lat ?? null, lng ?? null).subscribe({
          next: () => {
            this.loadViewCount();
          },
          error: () => {
            this.loadViewCount();
          }
        });
      };

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            doRecord(lat, lng);
          },
          (error) => {
            doRecord();
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      } else {
        doRecord();
      }
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
    if (!this.videoId) return '';
    if (!this.presetsChecked) return '';
    
    const base = `http://${window.location.hostname}:8082/api/videos`;
    
    if (this.selectedQuality === 'original') {
      return `${base}/${this.videoId}/video`;
    }
    return `${base}/${this.videoId}/video/${this.selectedQuality}`;
  }

  getQualityLabel(): string {
    if (this.selectedQuality === 'original') {
      return 'Original';
    }
    return this.selectedQuality;
  }

 
  onQualityChange(quality: string): void {
    if (this.selectedQuality === quality) return;
 
    if (quality !== 'original' && !this.availablePresets[quality]) return; 
    this.selectedQuality = quality;

    // Briefly unmount and remount the video element so browser reloads stream
    this.isVideoLoaded = false;
    setTimeout(() => {
      this.isVideoLoaded = true;
      this.cdr.detectChanges();
      try {
        this.videoPlayer?.nativeElement.pause();
        this.videoPlayer?.nativeElement.load();
        this.videoPlayer?.nativeElement.play().catch(() => {});
      } catch (e) {
        // ignore
      }
    }, 80);
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

    if (isCurrentlyLiked) {
      // Unlike immediately
      this.videoService.unlikeVideo(Number(this.videoId)).subscribe({
        next: (response) => {
          console.log('Unlike success:', response);
          this.loadLikeData();
        },
        error: (err) => {
          console.error('Error unliking video:', err);
          alert('Error unliking video!');
        }
      });
      return;
    }

    const doLike = (lat?: number, lng?: number) => {
      this.videoService.likeVideo(Number(this.videoId), lat ?? null, lng ?? null).subscribe({
        next: (response) => {
          console.log('Like success:', response);
          this.loadLikeData();
        },
        error: (err) => {
          console.error('Error liking video:', err);
          alert('Error liking video!');
        }
      });
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          doLike(lat, lng);
        },
        (error) => {
          console.warn('Geolocation failed or denied, sending like without coords:', error);
          doLike();
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      // Geolocation not supported
      console.warn('Geolocation not supported by browser, sending like without coords');
      doLike();
    }
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
    
    this.http.get<any>(`http://${window.location.hostname}:8082/api/users/${this.video.userId}/profile`)
      .subscribe({
        next: (data) => {
          this.videoAuthor = { firstName: data.firstName, lastName: data.lastName };
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Error loading video author:', err)
      });
  }

  startTranscodingPolling(): void {
    if (!this.videoId) return;
    
   
    this.videoService.getTranscodingStatus(Number(this.videoId)).subscribe(status => {
      this.transcodingStatus = status;
      this.cdr.detectChanges();
      
    
      if (status === 'COMPLETED' || status === 'FAILED') {
        if (status === 'COMPLETED') {
          this.checkAvailablePresets();
        }
        return;
      }
      
      
      this.pollingSubscription = interval(10000).pipe(
        switchMap(() => this.videoService.getTranscodingStatus(Number(this.videoId))),
        takeWhile(s => s !== 'COMPLETED' && s !== 'FAILED', true)
      ).subscribe(s => {
        this.transcodingStatus = s;
        if (s === 'COMPLETED') {
          this.checkAvailablePresets();
        }
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }
}