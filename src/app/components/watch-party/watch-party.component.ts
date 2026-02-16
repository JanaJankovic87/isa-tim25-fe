import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { WatchPartyService, WatchPartyCommand } from '../../services/watch-party.service';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { Video } from '../../models/video.model';

@Component({
  selector: 'app-watch-party',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  selectedVideoId: number | null | undefined = null;
  searchTerm: string = '';

  currentUserId: string = '';
  currentUsername: string = '';

  showCreateMode: boolean = true;
  isLoading: boolean = false;
  error: string = '';
  
  private isRedirecting: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private watchPartyService: WatchPartyService,
    private videoService: VideoService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUserId = this.authService.getUserId()?.toString() || 'user-' + Date.now();
    this.currentUsername = this.authService.getUsername() || 'Anonymous';

    this.loadVideos();

    // Slušaj poruke
    this.subscriptions.push(
      this.watchPartyService.messages$.subscribe((msg: string) => {
        this.ngZone.run(() => {
          this.messages.push(msg);
          this.cdr.detectChanges();
          this.scrollToBottom();
        });
      })
    );

    // Slušaj komande (opciono - za debug)
    this.subscriptions.push(
      this.watchPartyService.commands$.subscribe((cmd: WatchPartyCommand) => {
        console.log('[Component] Command received:', cmd);
      })
    );

   
    this.subscriptions.push(
      this.watchPartyService.connectionStatus$.subscribe((status: boolean) => {
        this.ngZone.run(() => {
          this.isConnected = status;
          this.cdr.detectChanges();
        });
      })
    );

    
    this.route.params.subscribe(params => {
      if (params['roomId']) {
        this.joinRoomId = params['roomId'];
        this.showCreateMode = false;
        setTimeout(() => this.joinRoom(), 300);
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['room'] && !this.roomId) {
        this.joinRoomId = params['room'];
        this.showCreateMode = false;
        setTimeout(() => this.joinRoom(), 300);
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
    this.isLoading = false;
    this.error = '';
    this.showCreateMode = true;
    try { this.cdr.detectChanges(); } catch (e) {}
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());

    try { this.watchPartyService.disconnect(); } catch (e) {}
  }

  loadVideos(): void {
    this.videoService.getVideos().subscribe({
      next: (videos) => {
        this.videos = videos;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading videos:', err);
      }
    });
  }

  getFilteredVideos(): Video[] {
    const q = this.searchTerm?.trim().toLowerCase();
    if (!q) return this.videos;
    return this.videos.filter(v => (v.title || '').toLowerCase().includes(q));
  }

  createRoom(): void {
    this.isLoading = true;
    this.error = '';

    const backendUrl = this.watchPartyService.getBackendUrl();
    const token = this.authService.getToken();

  
    console.log('[WatchParty Component] Creating room. Token exists:', !!token);
    console.log('[WatchParty Component] Token preview:', token ? token.substring(0, 50) : 'null');

    this.http.post(
      `${backendUrl}/api/watch-party/rooms`,
      {},
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    ).subscribe({
      next: (room: any) => {
        const newRoomId = room?.roomId || room?.id || this.watchPartyService.generateRoomId();

        // WebSocket konekcija kao vlasnik
        this.watchPartyService.connect(newRoomId, this.currentUserId, true)
          .then(() => {
            this.ngZone.run(() => {
              this.roomId = newRoomId;
              this.isOwner = true;
              this.isConnected = true;
              this.isLoading = false;
              
              const shareLink = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/watch-party?room=${this.roomId}`;
              this.messages.push(`Soba "${this.roomId}" je kreirana!`);
              this.messages.push(`Link za deljenje: ${shareLink}`);
              this.cdr.detectChanges();
            });
          })
          .catch((err: any) => {
            this.ngZone.run(() => {
              this.error = 'Greška pri konekciji na WebSocket.';
              this.isLoading = false;
              console.error('[WatchParty] WebSocket connect error:', err);
              this.cdr.detectChanges();
            });
          });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          this.error = 'Greška pri kreiranju sobe. Proverite da ste ulogovani.';
          this.isLoading = false;
          console.error('[WatchParty] Room creation error:', err);
          this.cdr.detectChanges();
        });
      }
    });
  }

  joinRoom(): void {
    const trimmedId = this.joinRoomId.trim();
    if (!trimmedId) {
      this.error = 'Unesite ID sobe';
      return;
    }

    this.isLoading = true;
    this.error = '';

   
    this.watchPartyService.connect(trimmedId, this.currentUserId, false)
      .then(() => {
        this.ngZone.run(() => {
          this.roomId = trimmedId;
          this.isOwner = false;
          this.isConnected = true;
          this.isLoading = false;
          this.messages.push(`Pridružili ste se sobi "${this.roomId}"`);
          this.messages.push(`Čekanje da vlasnik pokrene video...`);
          this.cdr.detectChanges();
        });
      })
      .catch((err: any) => {
        this.ngZone.run(() => {
          this.error = 'Greška pri pridruživanju sobi. Proverite ID i pokušajte ponovo.';
          this.isLoading = false;
          console.error('[WatchParty] Join room error:', err);
          this.cdr.detectChanges();
        });
      });
  }

  playVideo(): void {
    if (this.selectedVideoId == null) {
      this.error = 'Izaberite video za pokretanje';
      return;
    }
    if (!this.isOwner) {
      this.error = 'Samo vlasnik sobe može pokrenuti video';
      return;
    }

    const videoId = this.selectedVideoId!;
  
    this.watchPartyService.playVideo(videoId);
    this.messages.push(`Pokretanje videa #${videoId} za sve članove...`);

    
    this.isRedirecting = true;
    
    setTimeout(() => {
      this.router.navigate(['/video', videoId]);
    }, 3000);
  }

  leaveRoom(): void {
    
    this.watchPartyService.forceDisconnect();
    this.resetView();
    this.router.navigate(['/watch-party']);
  }

  copyLink(): void {
    
      const link = this.getShareLink();

     
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(link).then(() => {
          this.messages.push(` Link kopiran: ${link}`);
          try { this.cdr.detectChanges(); } catch(e) {}
        }).catch(() => {
          this.fallbackCopy(link);
        });
      } else {
       
        this.fallbackCopy(link);
      }
  }

    private fallbackCopy(text: string): void {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        if (ok) {
          this.messages.push(` Link kopiran: ${text}`);
        } else {
          this.messages.push(` Kopiraj link ručno: ${text}`);
        }
        document.body.removeChild(textarea);
      } catch (e) {
        this.messages.push(` Kopiraj link ručno: ${text}`);
      }
      try { this.cdr.detectChanges(); } catch(e) {}
    }

    getShareLink(): string {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${window.location.protocol}//${window.location.hostname}${port}/watch-party/${this.roomId}`;
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

  getThumbnailUrl(videoId?: number): string {
    if (videoId) {
      return this.videoService.getThumbnailUrl(videoId);
    }
    return 'https://via.placeholder.com/120x68?text=No+Thumbnail';
  }
}