import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
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

  constructor(private router: Router, private authService: AuthService) {}


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
      const wsUrl = token 
        ? `http://localhost:8082/ws?token=${token}` 
        : 'http://localhost:8082/ws';

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

        this.stompClient!.subscribe(`/topic/watchparty/${roomId}`, (message: IMessage) => {
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
      const body = message.body;
      
      try {
        const data = JSON.parse(body);
        console.log('Watch Party command received:', data);
        
        if (data.action === 'play' && data.videoId && !this.isRoomOwner) {
          console.log('Opening video for member:', data.videoId);
          this.router.navigate(['/video', data.videoId]);
          setTimeout(() => {
            this.disconnect();
          }, 200);
        }
        
        this.commandSubject.next(data);
      } catch {
        console.log('Watch Party message:', body);
        this.messagesSubject.next(body);
      }
    } catch (e) {
      console.error('Error handling message:', e);
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
    if (!this.stompClient || !this.connected || !this.currentRoomId) {
      console.error('Cannot play video - not connected');
      return;
    }

    if (!this.isRoomOwner) {
      console.warn('Only room owner can play videos');
      return;
    }

    this.stompClient.publish({
      destination: '/app/watchparty.playVideo',
      body: JSON.stringify({
        roomId: this.currentRoomId,
        videoId: videoId,
        userId: this.currentUserId,
        action: 'play'
      })
    });
    console.log('Playing video for all members:', videoId);
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
