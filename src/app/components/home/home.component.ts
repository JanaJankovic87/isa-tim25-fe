import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VideoService } from '../../services/video.service';
import { Video } from '../../models/video.model';
import { LocalTrendingService, TrendingResult } from '../../services/local-trending.service';
import { TrendingVideoDTO } from '../../models/video.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  videos: Video[] = [];
  
  localTrendingVideos: any[] = [];
  currentLocalTrendingIndex = 0;
  localTrendingLoading = false;
  localTrendingError: string | null = null;
  isLocationApproximated = false;
  radiusKm = 50;
  
  isLoading = true;
  videoDurations: { [id: number]: string } = {};
  showProfileMenu = false;
  searchQuery = '';
  openMenuId: number | null = null;
  
  allTags: string[] = [];
  selectedTag: string = 'All';

  showSessionExpired = false;

  constructor(
    public authService: AuthService,
    private videoService: VideoService,
    private localTrendingService: LocalTrendingService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTags();
    this.loadVideos();
    this.loadLocalTrendingVideos();
    this.checkSessionExpired();
  }

  checkSessionExpired(): void {
    const expired = localStorage.getItem('sessionExpired');
    if (expired === 'true') {
      this.authService.logout();
      this.showSessionExpired = true;
      localStorage.removeItem('sessionExpired');
      setTimeout(() => {
        this.showSessionExpired = false;
        this.cdr.detectChanges();
      }, 4000);
      this.cdr.detectChanges();
    }
  }

  isMyVideo(video: Video): boolean {
    const currentUserId = this.getCurrentUserId();
    return currentUserId !== null && video.userId === currentUserId;
  }

  loadTags(): void {
    this.videoService.getVideos().subscribe({
      next: (videos) => {
        const tagSet = new Set<string>();
        videos.forEach(video => {
          if (video.tags && Array.isArray(video.tags)) {
            video.tags.forEach(tag => tagSet.add(tag));
          }
        });
        this.allTags = Array.from(tagSet).sort();
        this.cdr.detectChanges();
      }
    });
  }

  extractTagsFromVideos(): void {
    const tagSet = new Set<string>();
    this.videos.forEach(video => {
      if (video.tags && Array.isArray(video.tags)) {
        video.tags.forEach(tag => tagSet.add(tag));
      }
    });
    this.allTags = Array.from(tagSet).sort();
    console.log('Tagovi izvučeni iz videa:', this.allTags);
    this.cdr.detectChanges();
  }

  filterVideosLocally(): void {
    this.videoService.getVideos().subscribe({
      next: (data) => {
        let videos = data.map(video => {
          return {
            ...video,
            createdAt: this.parseBackendDate(video.createdAt)
          };
        });
        
        videos = videos.filter(video => 
          video.tags && video.tags.includes(this.selectedTag)
        );
        
        videos.sort((a, b) => {
          const dateA = a.createdAt ? a.createdAt.getTime() : 0;
          const dateB = b.createdAt ? b.createdAt.getTime() : 0;
          return dateB - dateA; 
        });
        
        this.videos = videos;
       
        this.videos.forEach(video => {
          if (video.id) {
            this.videoService.getViewCount(video.id).subscribe({
              next: (count) => {
                (video as any).viewCount = count;
                this.cdr.detectChanges();
              },
              error: () => {
                (video as any).viewCount = 0;
              }
            });
          } else {
            (video as any).viewCount = 0;
          }
        });
        
        this.videos.forEach(video => {
          if (video.id) {
            this.videoService.getViewCount(video.id).subscribe({
              next: (count) => {
                video.viewsCount = count;
                this.cdr.detectChanges();
              },
              error: (err) => {
                video.viewsCount = 0;
              }
            });
          } else {
            video.viewsCount = 0;
          }
        });
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onTagClick(tag: string): void {
    this.selectedTag = tag;
    this.searchQuery = ''; 
    this.loadVideos();
  }

  onSearch(): void {
    this.selectedTag = 'All'; 
    this.loadVideos();
  }

  loadVideos(): void {
    this.isLoading = true;
    
    let request;
    
    if (this.searchQuery.trim()) {
      request = this.videoService.searchVideos(this.searchQuery.trim());
    } else if (this.selectedTag !== 'All') {
      this.filterVideosLocally();
      return;
    } else {
      request = this.videoService.getVideos();
    }
    
    request.subscribe({
      next: (data) => {
        console.log('Dobijeni videi sa backend-a:', data);
        
        let videos = data.map(video => {
          return {
            ...video,
            createdAt: this.parseBackendDate(video.createdAt)
          };
        });
        
        console.log('Pre sortiranja:', videos.map(v => ({ title: v.title, date: v.createdAt })));
        
        videos.sort((a, b) => {
          const dateA = a.createdAt ? a.createdAt.getTime() : 0;
          const dateB = b.createdAt ? b.createdAt.getTime() : 0;
          return dateB - dateA; 
        });
        
        console.log('Posle sortiranja:', videos.map(v => ({ title: v.title, date: v.createdAt })));
        
        this.videos = videos;
        
        this.videos.forEach(video => {
          if (video.id) {
            this.videoService.getViewCount(video.id).subscribe({
              next: (count) => {
                video.viewsCount = count;
                this.cdr.detectChanges();
              },
              error: (err) => {
                video.viewsCount = 0;
              }
            });
          } else {
            video.viewsCount = 0;
          }
        });
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Greška pri učitavanju videa:', error);
        console.error('Detalji:', error.error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
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

  isValidDate(date: Date | undefined): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  parseBackendDate(dateArray: any): Date | undefined {
    if (!dateArray || !Array.isArray(dateArray)) {
      return undefined;
    }
    const [year, month, day, hour, minute, second] = dateArray;
    return new Date(year, month - 1, day, hour, minute, second);
  }

  toggleMenu(videoId: number): void {
    this.openMenuId = this.openMenuId === videoId ? null : videoId;
  }

  deleteVideo(videoId: number): void {
    if (confirm('Da li ste sigurni da želite da obrišete ovaj video?')) {
      this.videoService.deleteVideo(videoId).subscribe({
        next: () => {
          this.videos = this.videos.filter(v => v.id !== videoId);
          this.openMenuId = null;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Greška pri brisanju videa:', error);
          alert('Došlo je do greške pri brisanju videa.');
        }
      });
    }
  }

  getThumbnailUrl(id: number): string {
    return this.videoService.getThumbnailUrl(id);
  }

  getVideoUrl(id: number): string {
    return this.videoService.getVideoUrl(id);
  }

  onLoadedMetadata(event: Event, videoId: number): void {
    const videoElement = event.target as HTMLVideoElement;
    const duration = videoElement.duration;
    this.videoDurations[videoId] = this.formatDuration(duration);
  }

  formatDuration(duration: number): string {
    if (isNaN(duration) || duration === Infinity) return '';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  viewVideo(id: number): void {
    this.router.navigate(['/video', id]);
  }

  onLogin(): void {
    this.router.navigate(['/login']);
  }

  onLogout(): void {
    this.authService.logout();
    this.showProfileMenu = false; 
    this.router.navigate(['/']);
  }

  onAddVideo(): void {
    this.router.navigate(['/create-video']);
  }

  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
  }

  closeProfileMenu(): void {
    this.showProfileMenu = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-dropdown')) {
      this.showProfileMenu = false;
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  viewTrendingVideo(id: number): void {
    if (!id) {
      console.error('Invalid video ID:', id);
      return;
    }
    this.router.navigate(['/video', id]);
  }

  // ========================================
  // LOCAL TRENDING (NOVO - tvoj S2 zadatak)
  // ========================================
  
  loadLocalTrendingVideos(): void {
    this.localTrendingLoading = true;
    this.localTrendingError = null;

    this.localTrendingService.getLocalTrending(this.radiusKm, 10).subscribe({
      next: (result: TrendingResult) => {
        console.log('=== LOCAL TRENDING RESPONSE ===', result);
        this.localTrendingVideos = result.videos.map((item: any) => {
          // If the backend returns a nested video object, flatten it
          const video = item.video ? item.video : item;
          return {
            id: video.id,
            title: video.title,
            thumbnailPath: video.thumbnailPath || (video.id ? this.getThumbnailUrl(video.id) : undefined),
            viewsCount: video.viewsCount,
            likesCount: video.likesCount,
            score: video.score,
            distanceKm: video.distanceKm,
            popularityScore: video.popularityScore,
            location: video.location
          };
        });
        this.isLocationApproximated = result.locationInfo?.isApproximated ?? false;
        this.localTrendingLoading = false;
        console.log('Processed local trending:', this.localTrendingVideos);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('=== LOCAL TRENDING ERROR ===', err);
        this.localTrendingError = 'Could not load local trending';
        this.localTrendingLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onRadiusChange(): void {
    this.loadLocalTrendingVideos();
  }

  nextLocalTrending(): void {
    if (this.currentLocalTrendingIndex < this.localTrendingVideos.length - 1) {
      this.currentLocalTrendingIndex++;
    }
  }

  prevLocalTrending(): void {
    if (this.currentLocalTrendingIndex > 0) {
      this.currentLocalTrendingIndex--;
    }
  }

  goToLocalTrendingSlide(index: number): void {
    this.currentLocalTrendingIndex = index;
  }

  viewLocalTrendingVideo(id: number): void {
    if (!id) {
      console.error('Invalid video ID:', id);
      return;
    }
    this.router.navigate(['/video', id]);
  }
}