import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy {
  @Input() videoId!: number;
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  newMessage: string = '';
  username: string = '';
  isConnected: boolean = false;
  
  private messageSubscription?: Subscription;

  constructor(
    private chatService: ChatService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.username = this.getCurrentUsername();
    if (this.videoId) {
      this.chatService.connect(this.videoId);
      this.messageSubscription = this.chatService.getMessages().subscribe({
        next: (message) => {
          this.messages.push(message);
          this.scrollToBottom();
        },
        error: (err) => console.error('Chat error:', err)
      });
      // Brzo ažuriranje statusa
      this.chatService.getConnectionStatus().subscribe(status => {
        this.isConnected = status;
      });
    }
  }

  ngOnDestroy(): void {
    this.messageSubscription?.unsubscribe();
    this.chatService.disconnect();
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.videoId) {
      return;
    }

    this.chatService.sendMessage(this.videoId, this.username, this.newMessage.trim());
    this.newMessage = '';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private getCurrentUsername(): string {
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub || payload.email || 'User';
      } catch {
        return 'User';
      }
    }
    return 'Guest';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  isOwnMessage(message: ChatMessage): boolean {
    return message.username === this.username;
  }
}
