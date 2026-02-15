
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

  // Scheduled streaming
  isScheduledVideo: boolean = false;
  isVideoAvailable: boolean = true;
  scheduledTime: Date | null = null;
  playbackState: any = null;
  showStreamRoom: boolean = false; // whether to show the live/room UI
  hasRedirectedOnEnd: boolean = false;
  countdownInterval: any = null;
  playbackSyncInterval: any = null;
  countdownText: string = '';
  currentSecond: number = 0;

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

  parseScheduledTime(scheduledTime: any): Date | null {
    if (!scheduledTime) return null;
    
    if (scheduledTime instanceof Date) {
      return scheduledTime;
    }
    
    if (Array.isArray(scheduledTime)) {
      const [year, month, day, hour, minute, second] = scheduledTime;
      return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
    }
    
    if (typeof scheduledTime === 'string') {
      return new Date(scheduledTime);
    }
    
    return null;
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
            console.log('Video data received:', data);
            this.video = data;
              this.isVideoLoaded = true;
              
              if (data.isScheduled === true) {
                this.isScheduledVideo = true;
                this.scheduledTime = this.parseScheduledTime(data.scheduledTime);
                console.log('Scheduled video - time parsed:', this.scheduledTime);
                this.checkVideoAvailability();
              } else {
                // Regular video (not scheduled)
                console.log('Regular video - not scheduled');
                this.isScheduledVideo = false;
                this.isVideoAvailable = true;
                this.checkAvailablePresets();
                this.startTranscodingPolling();
              }
              
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
    if (!this.videoId) {
      console.log('getVideoUrl: no videoId');
      return '';
    }

    if (!this.presetsChecked || this.selectedQuality === 'original') {
      const url = `http://localhost:8082/api/videos/${this.videoId}/video`;
      console.log('getVideoUrl: returning', url);
      return url;
    }
  
    const url = `http://localhost:8082/api/videos/${this.videoId}/video/${this.selectedQuality}`;
    console.log('getVideoUrl: returning quality', this.selectedQuality, url);
    return url;
  }

  getQualityLabel(): string {
    if (this.selectedQuality === 'original') {
      return 'Original';
    }
    return this.selectedQuality;
  }

  // Promena kvaliteta videa
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

  checkVideoAvailability(): void {
    if (!this.videoId) return;

    this.videoService.getVideoAvailability(Number(this.videoId)).subscribe({
      next: (availability) => {
        console.log('Availability response:', availability);
        
        this.isVideoAvailable = availability.isAvailable;
        
        if (availability.scheduledTime && !this.scheduledTime) {
          this.scheduledTime = this.parseScheduledTime(availability.scheduledTime);
          console.log('Scheduled time from availability:', this.scheduledTime);
        }
        
        if (availability.isAvailable) {
          console.log('Scheduled video is now available - starting playback sync');
          this.checkAvailablePresets();
          this.startTranscodingPolling();
          this.startPlaybackSync();
          this.hasRedirectedOnEnd = false;
        } else {
          console.log('Scheduled video not yet available - showing countdown');
          this.startCountdown();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error checking video availability:', err);
        this.isVideoAvailable = true;
        this.checkAvailablePresets();
        this.startTranscodingPolling();
      }
    });
  }

  startCountdown(): void {
    if (!this.scheduledTime) return;

    this.updateCountdown();
    
    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      this.updateCountdown();
      
      // Check if video became available
      const now = new Date();
      if (now >= this.scheduledTime!) {
        clearInterval(this.countdownInterval);
        this.isVideoAvailable = true;
        console.log('Countdown finished - video is now available');
        this.checkAvailablePresets();
        this.startTranscodingPolling();
        this.startPlaybackSync();
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  updateCountdown(): void {
    if (!this.scheduledTime || !(this.scheduledTime instanceof Date) || isNaN(this.scheduledTime.getTime())) {
      console.error('Invalid scheduled time:', this.scheduledTime);
      this.countdownText = 'Invalid date';
      return;
    }

    const now = new Date();
    const diff = this.scheduledTime.getTime() - now.getTime();

    if (diff <= 0) {
      this.countdownText = 'Starting now...';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    this.countdownText = parts.join(' ');
  }

  startPlaybackSync(): void {
    if (!this.videoId) return;

    this.syncPlayback();

    this.playbackSyncInterval = setInterval(() => {
      this.syncPlayback();
    }, 5000);
  }

  syncPlayback(): void {
    if (!this.videoId) return;

    this.videoService.getPlaybackState(Number(this.videoId)).subscribe({
      next: (state) => {
        console.log('Playback state received:', state);
        
        this.playbackState = state;
        this.currentSecond = state.currentSecond;
        
        if (state.scheduledTime && !this.scheduledTime) {
          this.scheduledTime = this.parseScheduledTime(state.scheduledTime);
        }

        if (state.isLive && !state.hasEnded) {
          const wasShowing = this.showStreamRoom;
          this.showStreamRoom = true;
          if (!wasShowing) {
            setTimeout(() => this.ensurePlayerAtCurrentSecond(true), 120);
            setTimeout(() => this.ensurePlayerAtCurrentSecond(true), 600);
          }
        }

        if (this.videoPlayer?.nativeElement && state.isLive && !state.hasEnded) {
          const video = this.videoPlayer.nativeElement;
          const targetTime = state.currentSecond;
          
          console.log('Syncing: current time =', video.currentTime, 'target time =', targetTime, 'paused =', video.paused);
          
          if (Math.abs(video.currentTime - targetTime) > 2) {
            console.log('Seeking to sync position:', targetTime);
            video.currentTime = targetTime;
          }

        }

        if (state.hasEnded) {
          this.showStreamRoom = false;
          if (!this.hasRedirectedOnEnd && this.videoId) {
            this.hasRedirectedOnEnd = true;
            // navigate to same details route to refresh UI
            this.router.navigate(['/video', this.videoId]);
          }
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error syncing playback:', err);
      }
    });
  }

 
  private ensurePlayerAtCurrentSecond(autoPlay: boolean = true): void {
    try {
      const el = this.videoPlayer?.nativeElement;
      if (!el || this.currentSecond === undefined || this.currentSecond === null) return;

      const tolerance = 0.5;
      if (Math.abs(el.currentTime - this.currentSecond) > tolerance) {
        el.currentTime = this.currentSecond;
      }

      if (autoPlay) {
        el.play().catch(() => {
          // ignore; user agent may block autoplay
        });
      }
    } catch (e) {
      // swallow any errors - this is best-effort
    }
  }

  formatScheduledTime(time: Date | null): string {
    if (!time) return '';
    return new Date(time).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onVideoError(event: any): void {
    console.error('Video error:', event);
    
    if (this.isScheduledVideo && !this.isVideoAvailable) {
      console.log('Video not available yet - showing countdown');
      this.isVideoAvailable = false;
      this.startCountdown();
      this.cdr.detectChanges();
      return;
    }
    
    const videoElement = event.target as HTMLVideoElement;
    if (videoElement && videoElement.error) {
      const error = videoElement.error;
      console.error('Video error code:', error.code, 'message:', error.message);
      
      if (error.code === 2) { 
        if (this.videoId) {
          this.checkVideoAvailability();
        }
      }
    }
  }

  onVideoSeeking(event: any): void {
    console.log('onVideoSeeking triggered - isScheduledVideo:', this.isScheduledVideo,
                'isLive:', this.playbackState?.isLive,
                'hasEnded:', this.playbackState?.hasEnded);

    if (this.isScheduledVideo && this.playbackState?.isLive && !this.playbackState?.hasEnded) {
      const videoElement = event.target as HTMLVideoElement;
      if (videoElement && this.currentSecond !== undefined) {
        const desiredPos = videoElement.currentTime; 
        const allowedPos = this.currentSecond;
        const forwardTolerance = 0.5; 

        console.log('Seeking detected - desiredPos:', desiredPos, 'allowedPos:', allowedPos);

        if (desiredPos > allowedPos + forwardTolerance) {
          console.log('Forward seeking blocked during live stream - snapping back to allowed position');
          event.preventDefault();
          setTimeout(() => {
            try { videoElement.currentTime = allowedPos; } catch (e) { /* ignore */ }
          }, 0);
        }
      }
    }
  }

  onVideoSeeked(event: any): void {
    console.log('onVideoSeeked triggered - isScheduledVideo:', this.isScheduledVideo,
                'isLive:', this.playbackState?.isLive,
                'hasEnded:', this.playbackState?.hasEnded);

    if (this.isScheduledVideo && this.playbackState?.isLive && !this.playbackState?.hasEnded) {
      const videoElement = event.target as HTMLVideoElement;
      if (videoElement && this.currentSecond !== undefined) {
        const desiredPos = videoElement.currentTime;
        const allowedPos = this.currentSecond;
        const forwardTolerance = 0.5;

        console.log('Seeked position:', desiredPos, 'allowed:', allowedPos);

        if (desiredPos > allowedPos + forwardTolerance) {
          console.log('Seeked forward beyond allowed position - correcting to allowed position');
          setTimeout(() => {
            try { videoElement.currentTime = allowedPos; } catch (e) { /* ignore */ }
          }, 0);
        }
      }
    }
  }

  leaveStreamRoom(): void {
    if (this.videoId) {
      this.showStreamRoom = false;
      this.router.navigate(['/video', this.videoId]);
    }
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.playbackSyncInterval) {
      clearInterval(this.playbackSyncInterval);
    }
  }
}