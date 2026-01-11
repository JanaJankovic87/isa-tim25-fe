import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { VideoService } from '../../services/video.service';
import { Video } from '../../models/video.model';

interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css'
})
export class UserProfileComponent implements OnInit {
  userProfile: UserProfile | null = null;
  isLoading = true;
  errorMessage = '';
  userVideos: Video[] = [];
  loadingVideos = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
    private location: Location,
    private videoService: VideoService
  ) {}

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.route.params.subscribe(params => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const userId = params['userId'];
      if (userId) {
        this.loadUserProfile(userId);
        this.loadUserVideos(userId);
      } else {
        this.errorMessage = 'No user ID provided';
        this.isLoading = false;
      }
    });
  }

  loadUserProfile(userId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    const url = `http://localhost:8082/api/users/${userId}/profile`;

    this.http.get<UserProfile>(url)
      .subscribe({
        next: (data) => {
          this.userProfile = data;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.errorMessage = `Failed to load user profile: ${error.status} ${error.statusText || error.message}`;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  goBack(): void {
    this.location.back();
  }

  loadUserVideos(userId: number): void {
    this.loadingVideos = true;
    this.videoService.getVideos().subscribe({
      next: (videos) => {
        const userIdNumber = Number(userId);
        this.userVideos = videos.filter(video => 
          video.userId != null && Number(video.userId) === userIdNumber
        );
        this.loadingVideos = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.userVideos = [];
        this.loadingVideos = false;
        this.cdr.detectChanges();
      }
    });
  }

  getThumbnailUrl(videoId: number): string {
    return `http://localhost:8082/api/videos/${videoId}/thumbnail?t=${Date.now()}`;
  }

  viewVideo(videoId: number): void {
    this.router.navigate(['/video', videoId]);
  }

  getVideoDate(video: Video): string {
    if (!video.createdAt) return '';
    
    if (Array.isArray(video.createdAt)) {
      const [year, month, day, hour, minute] = video.createdAt;
      const date = new Date(year, month - 1, day, hour || 0, minute || 0);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      });
    }
    
    const date = new Date(video.createdAt);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  }
}
