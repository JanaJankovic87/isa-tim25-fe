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
}

export interface RoomMember {
  userId: string;
  isOwner: boolean;
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
  private membersSubject = new BehaviorSubject<string[]>([]);

  public commands$ = this.commandSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public members$ = this.membersSubject.asObservable();
  // Backwards-compatible events$ observable expected by some UIs
  public events$ = this.commandSubject.asObservable();

  constructor(private router: Router, private authService: AuthService, private http: HttpClient) {}

 
  getBackendUrl(): string {
    const hostname = window.location.hostname;
  
    return `http://${hostname}:8082`;
  }

  connect(roomId: string, userId: string, asOwner: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected && this.currentRoomId === roomId) {
        resolve();
        return;
      }

      if (this.connected) {
        this.disconnect();
      }

      this.currentRoomId = roomId;
      this.currentUserId = userId;
      this.isRoomOwner = asOwner;

      const token = this.authService.getToken();
      const backendUrl = this.getBackendUrl();
      const wsUrl = token 
        ? `${backendUrl}/ws?token=${encodeURIComponent(token)}` 
        : `${backendUrl}/ws`;
      
      console.log('[WatchParty] Connecting to WebSocket:', wsUrl);
      console.log('[WatchParty] hostname:', window.location.hostname);

      this.stompClient = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        debug: (str) => {
         
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      this.stompClient.onConnect = () => {
        console.log('WebSocket connected to Watch Party');
        this.connected = true;
        this.connectionStatusSubject.next(true);

        // Subscribe to both topic naming variants to be tolerant of backend naming
        this.stompClient!.subscribe(`/topic/watchparty/${roomId}`, (message: IMessage) => {
          this.handleMessage(message);
        });
        this.stompClient!.subscribe(`/topic/watch-party/${roomId}`, (message: IMessage) => {
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
        console.error('STOMP error:', frame.headers['message']);
        this.connected = false;
        this.connectionStatusSubject.next(false);
        reject(new Error(frame.headers['message']));
      };

      this.stompClient.onWebSocketError = (error) => {
        console.error('WebSocket error:', error);
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
      console.log('Watch Party event received:', data);

      const isRedirect =
        ((data && data.eventType === 'REDIRECT_VIDEO' && data.videoId) as boolean) ||
        ((data && data.action === 'play' && data.videoId) as boolean);

      if (isRedirect && !this.isRoomOwner) {
        console.log('Redirecting to video:', data.videoId);
        try { this.router.navigate(['/video', data.videoId]); } catch (e) {}
        setTimeout(() => this.disconnect(), 200);
      }

      this.commandSubject.next(data);
    } catch (e) {
      try {
        this.messagesSubject.next(message.body);
      } catch (err) {
        console.error('Error handling message:', err);
      }
    }
  }


  private createRoom(roomId: string, userId: string): void {
    if (!this.stompClient || !this.connected) return;

    this.stompClient.publish({
      destination: '/app/watchparty.createRoom',
      body: JSON.stringify({ roomId, userId })
    });
    console.log('Room created:', roomId);
  }

 
  private joinRoom(roomId: string, userId: string): void {
    if (!this.stompClient || !this.connected) return;

    this.stompClient.publish({
      destination: '/app/watchparty.join',
      body: JSON.stringify({ roomId, userId })
    });
    console.log('Joined room:', roomId);
  }

 
  playVideo(videoId: number): void {
    if (!this.currentRoomId) {
      console.error('Cannot play video - no current room');
      return;
    }

    if (!this.isRoomOwner) {
      console.warn('Only room owner can start videos');
      return;
    }

    const backendUrl = this.getBackendUrl();
    const token = this.authService.getToken();

    this.http.post(
      `${backendUrl}/api/watch-party/rooms/${this.currentRoomId}/start`,
      { videoId },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: () => console.log('Video started via REST, Redis will notify all backends'),
      error: (err) => console.error('Failed to start video:', err)
    });
  }


  disconnect(): void {
    if (this.stompClient && this.connected && this.currentRoomId && this.currentUserId) {
      try {
        this.stompClient.publish({
          destination: '/app/watchparty.leave',
          body: JSON.stringify({
            roomId: this.currentRoomId,
            userId: this.currentUserId
          })
        });
      } catch (e) {
        console.error('Error sending leave message:', e);
      }

      try {
        this.stompClient.deactivate();
      } catch (e) {
        console.error('Error disconnecting:', e);
      }
    }

    this.connected = false;
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isRoomOwner = false;
    this.stompClient = null;
    this.connectionStatusSubject.next(false);
    this.membersSubject.next([]);
    console.log('Disconnected from Watch Party');
  }


  generateRoomId(): string {
    return 'WP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }


  isConnected(): boolean {
    return this.connected;
  }

  getRoomId(): string | null {
    return this.currentRoomId;
  }

  isOwner(): boolean {
    return this.isRoomOwner;
  }

  getUserId(): string | null {
    return this.currentUserId;
  }
}
