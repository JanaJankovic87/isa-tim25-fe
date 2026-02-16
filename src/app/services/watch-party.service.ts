import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth.service';

export interface WatchPartyCommand {
  roomId: string;
  videoId?: number;
  userId: string;
  action?: string;
  eventType?: string;
  username?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class WatchPartyService {
  private stompClient: Client | null = null;
  private connected = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private isRoomOwner = false;

  
  private keepAlive = false;
  private keepAliveTimer: any = null;

  private commandSubject = new Subject<WatchPartyCommand>();
  private messagesSubject = new Subject<string>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);

  public commands$ = this.commandSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public events$ = this.commandSubject.asObservable();

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  getBackendUrl(): string {
    return `http://${window.location.hostname}:8082`;
  }

  connect(roomId: string, userId: string, asOwner: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected && this.currentRoomId === roomId) {
        resolve();
        return;
      }
      if (this.connected) {
        this.forceDisconnect();
      }

      this.currentRoomId = roomId;
      this.currentUserId = userId;
      this.isRoomOwner = asOwner;
      this.keepAlive = false;

      const token = this.authService.getToken();
      const wsUrl = `${this.getBackendUrl()}/ws`;

      console.log('[WatchParty] Connecting to:', wsUrl);
      console.log('[WatchParty] Room:', roomId, '| Owner:', asOwner);

      this.stompClient = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        debug: (str) => {
          if (str.includes('ERROR') || str.includes('CONNECTED') || str.includes('DISCONNECT')) {
            console.log('[STOMP]', str);
          }
        },
        reconnectDelay: 0,
        heartbeatIncoming: 0,
        heartbeatOutgoing: 0,
      });

      this.stompClient.onConnect = () => {
        console.log('[WatchParty] WebSocket connected');
        this.connected = true;
        this.connectionStatusSubject.next(true);

        this.stompClient!.subscribe(`/topic/watch-party/${roomId}`, (message: IMessage) => {
          console.log('[WatchParty] Received message:', message.body);
          this.handleMessage(message);
        });

        resolve();
      };

      this.stompClient.onStompError = (frame) => {
        this.connected = false;
        this.connectionStatusSubject.next(false);
        reject(new Error(frame.headers['message']));
      };

      this.stompClient.onWebSocketError = (error) => {
        this.connected = false;
        this.connectionStatusSubject.next(false);
        reject(error);
      };

      this.stompClient.activate();
    });
  }

  private handleMessage(message: IMessage): void {
    try {
      const data = JSON.parse(message.body);
      console.log('[WatchParty] Parsed message:', data);

      const isRedirect = data.eventType === 'REDIRECT_VIDEO' && data.videoId;

      if (isRedirect) {
        if (!this.isRoomOwner) {
          // gost 
          console.log('[WatchParty] GUEST redirecting to video:', data.videoId);
          this.messagesSubject.next(`Vlasnik pokrenuo video! Preusmeravanje...`);
          setTimeout(() => {
            this.router.navigate(['/video', data.videoId]);
            setTimeout(() => this.forceDisconnect(), 2000);
          }, 800);
        } else {
        
          this.messagesSubject.next(`Video ${data.videoId} je pokrenut za sve.`);
        }
      } else if (data.eventType === 'USER_JOINED') {
        this.messagesSubject.next(`${data.username || 'Neko'} se pridružio.`);
      } else if (data.eventType === 'USER_LEFT') {
        this.messagesSubject.next(`${data.username || 'Neko'} je napustio sobu.`);
      } else if (data.eventType === 'ROOM_CLOSED') {
        this.messagesSubject.next(`Soba je zatvorena.`);
        if (!this.isRoomOwner) {
          setTimeout(() => this.router.navigate(['/watch-party']), 1500);
        }
      } else if (data.message) {
        this.messagesSubject.next(data.message);
      }

      this.commandSubject.next(data);
    } catch (e) {
      this.messagesSubject.next(message.body);
    }
  }

  playVideo(videoId: number): void {
    if (!this.currentRoomId || !this.isRoomOwner) return;

    const token = this.authService.getToken();

   
    this.keepAlive = true;
    console.log('[WatchParty] keepAlive=true - konekcija zaštićena od destroy-a');

   
    if (this.keepAliveTimer) clearTimeout(this.keepAliveTimer);
    this.keepAliveTimer = setTimeout(() => {
      console.log('[WatchParty] keepAlive istekao');
      this.keepAlive = false;
      this.forceDisconnect();
    }, 10000);

    console.log('[WatchParty] Starting video:', videoId);
    console.log('[WatchParty] Token exists:', !!token);

    this.http.post(
      `${this.getBackendUrl()}/api/watch-party/rooms/${this.currentRoomId}/start`,
      { videoId },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    ).subscribe({
      next: (res) => {
        console.log('[WatchParty] Video start OK:', res);
        this.messagesSubject.next(`Video #${videoId} pokrenut za sve!`);
      },
      error: (err) => {
        console.error('[WatchParty] Video start FAILED:', err.status, err.error);
        this.keepAlive = false;
        if (this.keepAliveTimer) clearTimeout(this.keepAliveTimer);
        this.messagesSubject.next(`Greška ${err.status}: ${err.error?.error || err.message}`);
      }
    });
  }

 
  disconnect(): void {
    if (this.keepAlive) {
      console.log('[WatchParty] disconnect() BLOKIRAN - keepAlive aktivan, gosti još primaju poruku');
      return;
    }
    this.forceDisconnect();
  }

 
  forceDisconnect(): void {
    this.keepAlive = false;
    if (this.keepAliveTimer) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.stompClient) {
      try { this.stompClient.deactivate(); } catch (e) {}
    }
    this.connected = false;
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isRoomOwner = false;
    this.stompClient = null;
    this.connectionStatusSubject.next(false);
    console.log('[WatchParty] Disconnected');
  }

  generateRoomId(): string {
    return 'WP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  isConnectedStatus(): boolean { return this.connected; }
  getRoomId(): string | null { return this.currentRoomId; }
  isOwner(): boolean { return this.isRoomOwner; }
  getUserId(): string | null { return this.currentUserId; }
}
