import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VideoService } from '../../services/video.service';
import { Video } from '../../models/video.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
    deleteVideo(id: number): void {
      if (!confirm('Are you sure you want to delete this video?')) return;
      this.videoService.deleteVideo(id).subscribe({
        next: () => {
          this.videos = this.videos.filter(video => video.id !== id);
          this.cdr.detectChanges();
        },
        error: (err) => {
          alert('Error deleting video!');
        }
      });
    }
  showOnlyMyVideos = false;
  videos: Video[] = [];
  isLoading = true;
  videoDurations: { [id: number]: string } = {};
  showProfileMenu = false; // ✅ Profile dropdown state

  constructor(
    public authService: AuthService,
    private videoService: VideoService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadVideos();
  }

  loadVideos(): void {
    this.isLoading = true;
    this.videoService.getVideos().subscribe({
      next: (data) => {
        let videos = data.map(video => ({
          ...video,
          createdAt: video.createdAt ? new Date(video.createdAt) : undefined
        }));
        if (this.showOnlyMyVideos) {
          const userId = this.getCurrentUserId();
          videos = videos.filter(video => video.userId === userId);
        }
        this.videos = videos;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Greška:', error);
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

  showMyVideos(): void {
    this.showOnlyMyVideos = true;
    this.loadVideos();
  }

  showAllVideos(): void {
    this.showOnlyMyVideos = false;
    this.loadVideos();
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
    this.showProfileMenu = false; // ✅ Zatvori meni pri logout-u
    this.router.navigate(['/']);
  }

  onAddVideo(): void {
    this.router.navigate(['/create-video']);
  }

  // ✅ PROFILE DROPDOWN METODI
  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
  }

  closeProfileMenu(): void {
    this.showProfileMenu = false;
  }

  // ✅ Zatvori meni kada se klikne bilo gde na stranici
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-dropdown')) {
      this.showProfileMenu = false;
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
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
}