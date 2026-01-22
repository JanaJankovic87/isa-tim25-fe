import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VideoService } from '../../services/video.service';
import { Video, TrendingVideoDTO } from '../../models/video.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  videos: Video[] = [];
  trendingVideos: TrendingVideoDTO[] = [];
  currentTrendingIndex = 0;
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
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTags();
    this.loadVideos();
    this.loadTrendingVideos();
    this.checkSessionExpired();
  }
  checkSessionExpired(): void {
    const expired = localStorage.getItem('sessionExpired');
    if (expired === 'true') {
      this.authService.logout(); // automatski izloguj korisnika
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
        // Fetch view count for each video
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

  loadTrendingVideos(): void {
    this.videoService.getTrendingVideos().subscribe({
      next: (trending: any) => {
        console.log('=== TRENDING VIDEOS RAW RESPONSE ===');
        console.log('Tip podataka:', typeof trending);
        console.log('Da li je niz:', Array.isArray(trending));
        console.log('Dužina niza:', trending?.length);
        console.log('Sirovi podaci:', JSON.stringify(trending, null, 2));
        
        if (Array.isArray(trending)) {
          this.trendingVideos = trending
            .filter(item => item && item.video && item.video.id) // Backend vraća { video: {...}, trendingScore: ... }
            .map(item => {
              const video = item.video;
              const score = item.trendingScore || 0;
              
              console.log('Processing video:', {
                id: video.id,
                title: video.title,
                score: score
              });
              
              return {
                id: video.id,
                title: video.title || 'Untitled',
                thumbnailPath: video.thumbnailPath || undefined,
                viewsCount: video.viewsCount || 0,
                likesCount: video.likesCount || 0,
                score: score
              };
            });
          
          console.log('=== PROCESSED TRENDING VIDEOS ===');
          console.log('Broj validnih videa:', this.trendingVideos.length);
          console.log('Processovani podaci:', this.trendingVideos);
        } else {
          console.error('Backend nije vratio niz! Vratio je:', trending);
          this.trendingVideos = [];
        }
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('=== ERROR LOADING TRENDING ===');
        console.error('Status:', err.status);
        console.error('Message:', err.message);
        console.error('Full error:', err);
        this.trendingVideos = [];
      }
    });
  }

  nextTrending(): void {
    if (this.currentTrendingIndex < this.trendingVideos.length - 1) {
      this.currentTrendingIndex++;
    }
  }

  prevTrending(): void {
    if (this.currentTrendingIndex > 0) {
      this.currentTrendingIndex--;
    }
  }

  goToTrendingSlide(index: number): void {
    this.currentTrendingIndex = index;
  }

  viewTrendingVideo(id: number): void {
    if (!id) {
      console.error('Invalid video ID:', id);
      return;
    }
    this.router.navigate(['/video', id]);
  }
}