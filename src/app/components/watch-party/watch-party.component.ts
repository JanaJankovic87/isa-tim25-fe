import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { WatchPartyService, WatchPartyCommand } from '../../services/watch-party.service';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { Video } from '../../models/video.model';

@Component({
  selector: 'app-watch-party',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './watch-party.component.html',
  styleUrls: ['./watch-party.component.css']
})
export class WatchPartyComponent implements OnInit, OnDestroy {
 
  roomId: string = '';
  joinRoomId: string = '';
  isConnected: boolean = false;
  isOwner: boolean = false;
  
 
  messages: string[] = [];
  
  
  videos: Video[] = [];
  selectedVideoId: number | null = null;
  memberCount: number = 0;
  

  currentUserId: string = '';
  currentUsername: string = '';
  
  
  showCreateMode: boolean = true;
  isLoading: boolean = false;
  error: string = '';
  
  
  private subscriptions: Subscription[] = [];

  constructor(
    private watchPartyService: WatchPartyService,
    private videoService: VideoService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUserId = this.authService.getUserId()?.toString() || 'user-' + Date.now();
    this.currentUsername = this.authService.getUsername() || 'Anonymous';

    this.loadVideos();

    this.subscriptions.push(
      this.watchPartyService.messages$.subscribe(msg => {
        this.messages.push(msg);
        // Detect join/leave notifications from backend and update member count (owner only)
        try {
          const text = String(msg).toLowerCase();
          if (this.isOwner && (text.includes('se pridružio') || text.includes('joined'))) {
            this.ngZone.run(() => {
              this.memberCount = this.memberCount + 1;
              this.cdr.detectChanges();
            });
          }
          if (this.isOwner && (text.includes('napustio') || text.includes('left'))) {
            this.ngZone.run(() => {
              this.memberCount = Math.max(0, this.memberCount - 1);
              this.cdr.detectChanges();
            });
          }
        } catch (e) {
          // ignore
        }
        this.scrollToBottom();
      })
    );

    this.subscriptions.push(
      this.watchPartyService.commands$.subscribe((cmd: WatchPartyCommand) => {
        if (cmd.action === 'play' && cmd.videoId) {
          this.messages.push(`🎬 Video ${cmd.videoId} je pokrenut!`);
        }
      })
    );

    this.subscriptions.push(
      this.watchPartyService.connectionStatus$.subscribe(status => {
        this.ngZone.run(() => {
          this.isConnected = status;
          console.log('Connection status changed:', status);
          this.cdr.detectChanges();
        });
      })
    );

    this.route.queryParams.subscribe(params => {
      if (params['room']) {
        this.joinRoomId = params['room'];
        this.showCreateMode = false;
      } else {
        this.resetView();
      }
    });
  }

  private resetView(): void {
    this.roomId = '';
    this.joinRoomId = '';
    this.isConnected = false;
    this.isOwner = false;
    this.messages = [];
    this.selectedVideoId = null;
    this.memberCount = 0;
    this.isLoading = false;
    this.error = '';
    this.showCreateMode = true;
    try { this.cdr.detectChanges(); } catch (e) {}
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }


  loadVideos(): void {
    this.videoService.getVideos().subscribe({
      next: (videos) => {
        this.videos = videos;
      },
      error: (err) => {
        console.error('Error loading videos:', err);
      }
    });
  }

 
  createRoom(): void {
    this.isLoading = true;
    this.error = '';
    
    this.roomId = this.watchPartyService.generateRoomId();
    console.log('Creating room:', this.roomId);
    
    this.watchPartyService.connect(this.roomId, this.currentUserId, true)
      .then(() => {
        this.ngZone.run(() => {
          this.isOwner = true;
          this.isConnected = true;
          this.messages.push(` Soba "${this.roomId}" je kreirana!`);
          this.messages.push(` Link za deljenje: ${window.location.origin}/watch-party?room=${this.roomId}`);
          this.isLoading = false;
          console.log('Room created successfully, isConnected:', this.isConnected, 'isOwner:', this.isOwner);
          this.cdr.detectChanges();
        });
      })
      .catch(err => {
        this.ngZone.run(() => {
          this.error = 'Greška pri kreiranju sobe. Pokušajte ponovo.';
          this.isLoading = false;
          console.error('Room creation error:', err);
          this.cdr.detectChanges();
        });
      });
  }

 
  joinRoom(): void {
    if (!this.joinRoomId.trim()) {
      this.error = 'Unesite ID sobe';
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.roomId = this.joinRoomId.trim().toUpperCase();

    this.watchPartyService.connect(this.roomId, this.currentUserId, false)
      .then(() => {
        this.ngZone.run(() => {
          this.isOwner = false;
          this.isConnected = true;
          this.messages.push(`Pridružili ste se sobi "${this.roomId}"`);
          this.messages.push(`Čekanje da vlasnik pokrene video`);
          this.isLoading = false;
          console.log('Joined room successfully');
          this.cdr.detectChanges();
        });
      })
      .catch(err => {
        this.ngZone.run(() => {
          this.error = 'Greška pri pridruživanju sobi. Proverite ID i pokušajte ponovo.';
          this.isLoading = false;
          console.error('Join room error:', err);
          this.cdr.detectChanges();
        });
      });
  }

 
  playVideo(): void {
    if (!this.selectedVideoId) {
      this.error = 'Izaberite video za pokretanje';
      return;
    }

    if (!this.isOwner) {
      this.error = 'Samo vlasnik sobe može pokrenuti video';
      return;
    }

    const videoId = this.selectedVideoId;
    this.watchPartyService.playVideo(videoId);
    this.messages.push(`Pokrenuli ste video #${videoId} za sve članove`);
    
    this.router.navigate(['/video', videoId]);
    
    setTimeout(() => {
      this.watchPartyService.disconnect();
      this.roomId = '';
      this.joinRoomId = '';
      this.isOwner = false;
      this.messages = [];
      this.selectedVideoId = null;
      this.memberCount = 0;
    }, 200);
  }

  
  leaveRoom(): void {
    this.watchPartyService.disconnect();
    const prevRoom = this.roomId;
    this.watchPartyService.disconnect();
    this.resetView();
    this.showCreateMode = true;
   
    try {
      if (prevRoom) {
        localStorage.removeItem(`wp_owner_${prevRoom}`);
      }
      localStorage.removeItem('wp_last_room');
    } catch (e) {}
 
    try { this.router.navigate(['/watch-party']); } catch (e) {}
  }

 
  copyLink(): void {
    const link = `${window.location.origin}/watch-party?room=${this.roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      this.messages.push('Link kopiran u clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

 
  public goHome(): void {
    this.router.navigate(['/home']);
  }


  private scrollToBottom(): void {
    setTimeout(() => {
      const chatContainer = document.querySelector('.messages-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }


  toggleMode(): void {
    this.showCreateMode = !this.showCreateMode;
    this.error = '';
  }


  getThumbnailUrl(videoId?: number): string {
    if (videoId) {
      return this.videoService.getThumbnailUrl(videoId);
    }
    return 'https://via.placeholder.com/120x68?text=No+Thumbnail';
  }
}
