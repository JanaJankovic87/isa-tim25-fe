import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface ChatMessage {
  username: string;
  message: string;
  videoId: number;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private stompClient: Client | null = null;
  private messageSubject = new Subject<ChatMessage>();
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private currentVideoId: number | null = null;


  // ✅ Dinamički URL - automatski detektuje host
private getWsUrl(): string {
  const host = window.location.hostname;  
  return `http://${host}:8082/ws`;
}

// ✅ Dinamički URL - automatski detektuje host
private getApiUrl(): string {
  const host = window.location.hostname;
  return `http://${host}:8082/api/videos`;
}


  connect(videoId: number): void {
    if (this.connectionStatus.value && this.currentVideoId === videoId) {
      return;
    }


    this.disconnect();
    this.currentVideoId = videoId;

    const wsUrl = this.getWsUrl();  // ✅ Dinamički URL
    console.log('Connecting to WebSocket:', wsUrl);

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(wsUrl),  // ✅ OVAKO!

      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str: string) => {
        console.log('STOMP: ' + str);
      }
    });


    this.stompClient.onConnect = () => {
      console.log('WebSocket connected for video:', videoId);
      this.connectionStatus.next(true);


      this.stompClient?.subscribe(`/topic/video/${videoId}`, (message: IMessage) => {
        const chatMessage: ChatMessage = JSON.parse(message.body);
        this.messageSubject.next(chatMessage);
      });
    };

    this.stompClient.onStompError = (frame: any) => {
      console.error('STOMP error:', frame.headers['message']);
      console.error('Details:', frame.body);
    };


    this.stompClient.onWebSocketClose = () => {
      console.log('WebSocket connection closed');
      this.connectionStatus.next(false);
    };

    this.stompClient.activate();
  }

  sendMessage(videoId: number, username: string, message: string): void {
    if (!this.stompClient || !this.connectionStatus.value) {
      console.error('WebSocket not connected');
      return;
    }

    const msg: ChatMessage = {
      username,
      message,
      videoId
    };

    this.stompClient.publish({
      destination: `/app/chat/${videoId}`,
      body: JSON.stringify(msg)
    });
  }

  getMessages(): Observable<ChatMessage> {
    return this.messageSubject.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connectionStatus.next(false);
      this.currentVideoId = null;
    }
  }

  isConnected(): boolean {
    return this.connectionStatus.value;
  }

}


