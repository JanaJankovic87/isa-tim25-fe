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
        // Parsiraj createdAt u Date objekat
        this.videos = data.map(video => ({
          ...video,
          createdAt: video.createdAt ? new Date(video.createdAt) : undefined
        }));
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
    
    const videoDate = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - videoDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }
}