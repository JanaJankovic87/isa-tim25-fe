import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { Video } from '../../models/video.model';

@Component({
  selector: 'app-my-videos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-videos.component.html',
  styleUrl: './my-videos.component.css'
})
export class MyVideosComponent implements OnInit {
  videos: Video[] = [];
  isLoading = true;

  constructor(
    private videoService: VideoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMyVideos();
  }

  loadMyVideos(): void {
    this.isLoading = true;
    this.videoService.getVideos().subscribe({
      next: (data) => {
        const userId = this.getCurrentUserId();
        this.videos = data.filter(video => video.userId === userId);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  getCurrentUserId(): number | null {
    // Pretpostavljamo da je userId u tokenu ili localStorage
    // Prilagodi prema backendu
    const token = this.authService.getToken();
    if (!token) return null;
    // Ako koristiš JWT, dekodiraj ga da dobiješ userId
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || null;
    } catch {
      return null;
    }
  }
}
