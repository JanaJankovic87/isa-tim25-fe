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

@Injectable({
  providedIn: 'root'
})
export class WatchPartyService {
  private stompClient: Client | null = null;
  private connected = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private isRoomOwner = false;

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
    const hostname = window.location.hostname;
    return `http://${hostname}:8082`;
  }

  connect(roomId: string, userId: string, asOwner: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected && this.currentRoomId === roomId) {
        console.log('[WatchParty] Already connected to', roomId);
        resolve();
        return;
      }

      if (this.connected) {
        console.log('[WatchParty] Disconnecting from previous room');
        this.disconnect();
      }

      this.currentRoomId = roomId;
      this.currentUserId = userId;
      this.isRoomOwner = asOwner;

      const token = this.authService.getToken();
      const backendUrl = this.getBackendUrl();
      const wsUrl = token ? `${backendUrl}/ws?token=${encodeURIComponent(token)}` : `${backendUrl}/ws`;

      console.log('[WatchParty] Connecting to:', wsUrl);
      console.log('[WatchParty] Room:', roomId, '| Owner:', asOwner);

      this.stompClient = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        debug: (str) => {
          if (str.includes('ERROR') || str.includes('RECEIPT')) {
            console.log('[STOMP]', str);
          }
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      this.stompClient.onConnect = () => {
        console.log(' WebSocket connected');
        this.connected = true;
        this.connectionStatusSubject.next(true);

        const topicDestination = `/topic/watch-party/${roomId}`;
        console.log('[WatchParty]  Subscribing to:', topicDestination);

        this.stompClient!.subscribe(topicDestination, (message: IMessage) => {
          console.log('[WatchParty]  Received message:', message.body);
          this.handleMessage(message);
        });

        if (asOwner) {
          this.createRoom(roomId, userId);
        } else {
          this.joinRoom(roomId, userId);
        }

        resolve();
      };

      this.stompClient.onStompError = (frame) => {
        console.error(' STOMP error:', frame.headers['message']);
        this.connected = false;
        this.connectionStatusSubject.next(false);
        reject(new Error(frame.headers['message']));
      };

      this.stompClient.onWebSocketError = (error) => {
        console.error(' WebSocket error:', error);
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
      console.log('[WatchParty]  Parsed message:', data);

      const isRedirect = (data.eventType === 'REDIRECT_VIDEO' && data.videoId) || (data.action === 'play' && data.videoId);

      if (isRedirect && !this.isRoomOwner) {
        console.log(' GUEST REDIRECTING to video:', data.videoId);
        this.messagesSubject.next(`Redirecting to video ${data.videoId}...`);
        setTimeout(() => {
          this.router.navigate(['/video', data.videoId]);
          setTimeout(() => this.disconnect(), 200);
        }, 500);
      } else if (isRedirect && this.isRoomOwner) {
        console.log(' Owner received redirect message (ignoring)');
      } else {
        if (data.message) this.messagesSubject.next(data.message);
      }

      this.commandSubject.next(data);
    } catch (e) {
      console.log('[WatchParty] Plain text message:', message.body);
      this.messagesSubject.next(message.body);
    }
  }

  private createRoom(roomId: string, userId: string): void {
    if (!this.stompClient || !this.connected) return;
    console.log('[WatchParty]  Creating room:', roomId);
    this.stompClient.publish({ destination: '/app/watchparty.createRoom', body: JSON.stringify({ roomId, userId }) });
  }

  private joinRoom(roomId: string, userId: string): void {
    if (!this.stompClient || !this.connected) return;
    console.log('[WatchParty]  Joining room:', roomId);
    this.stompClient.publish({ destination: '/app/watchparty.join', body: JSON.stringify({ roomId, userId }) });
  }

  playVideo(videoId: number): void {
    if (!this.currentRoomId) { console.error(' Cannot play video - no current room'); return; }
    if (!this.isRoomOwner) { console.warn(' Only room owner can start videos'); return; }

    const backendUrl = this.getBackendUrl();
    const token = this.authService.getToken();

    console.log('[WatchParty]  Starting video:', videoId, 'in room:', this.currentRoomId);

    this.http.post(`${backendUrl}/api/watch-party/rooms/${this.currentRoomId}/start`, { videoId }, { headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (response) => { console.log(' Video start request successful:', response); this.messagesSubject.next(`Started video ${videoId}`); },
        error: (err) => { console.error(' Failed to start video:', err); this.messagesSubject.next(`Error starting video: ${err.error?.error || err.message}`); }
      });
  }

  disconnect(): void {
    if (this.stompClient && this.connected && this.currentRoomId && this.currentUserId) {
      try {
        console.log('[WatchParty]  Leaving room:', this.currentRoomId);
        this.stompClient.publish({ destination: '/app/watchparty.leave', body: JSON.stringify({ roomId: this.currentRoomId, userId: this.currentUserId }) });
      } catch (e) { console.error('Error sending leave message:', e); }

      try { this.stompClient.deactivate(); } catch (e) { console.error('Error disconnecting:', e); }
    }

    this.connected = false;
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isRoomOwner = false;
    this.stompClient = null;
    this.connectionStatusSubject.next(false);
    console.log('[WatchParty]  Disconnected');
  }

  generateRoomId(): string { return 'WP-' + Math.random().toString(36).substring(2, 8).toUpperCase(); }
  isConnected(): boolean { return this.connected; }
  getRoomId(): string | null { return this.currentRoomId; }
  isOwner(): boolean { return this.isRoomOwner; }
  getUserId(): string | null { return this.currentUserId; }
}
