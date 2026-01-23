import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommentService } from '../../services/comment.service';
import { AuthService } from '../../services/auth.service';
import { Comment, CommentPage } from '../../models/comment.model';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './comments.component.html',
  styleUrl: './comments.component.css'
})
export class CommentsComponent implements OnInit, OnDestroy, OnChanges {
  
  @Input() videoId!: number;

  comments: Comment[] = [];
  newCommentText: string = '';
  isLoading: boolean = false;
  isPosting: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  
  currentPage: number = 0;
  pageSize: number = 20;
  totalComments: number = 0;
  totalPages: number = 0;
  isLastPage: boolean = false;

  remainingComments: number = 60;
  private rateLimitSubscription?: Subscription;

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.videoId) {
      console.error('Video ID is required for comments component');
      return;
    }

    this.loadComments();

    if (this.isLoggedIn()) {
      this.loadRemainingComments();
      
      this.rateLimitSubscription = interval(30000).subscribe(() => {
        if (this.isLoggedIn()) {
          this.loadRemainingComments();
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['videoId'] && !changes['videoId'].firstChange) {
      this.loadComments();
    }
  }

  ngOnDestroy(): void {
    if (this.rateLimitSubscription) {
      this.rateLimitSubscription.unsubscribe();
    }
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  loadComments(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.commentService.getComments(this.videoId, this.currentPage, this.pageSize)
      .subscribe({
        next: (data: CommentPage) => {
          this.comments = data.content;
          this.totalComments = data.totalElements;
          this.totalPages = data.totalPages;
          this.isLastPage = data.last;
          this.isLoading = false;
          
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading comments:', error);
          this.errorMessage = 'Failed to load comments';
          this.isLoading = false;
        }
      });
  }

  loadRemainingComments(): void {
    if (!this.isLoggedIn()) {
      return;
    }

    this.commentService.getRemainingComments(this.videoId)
      .subscribe({
        next: (data) => {
          this.remainingComments = data.remainingComments;
        },
        error: (error) => {
          if (error.status === 401) {
            console.log('Not authenticated for remaining comments check');
            if (!this.authService.isLoggedIn()) {
              if (this.rateLimitSubscription) {
                this.rateLimitSubscription.unsubscribe();
              }
            }
          } else {
            console.error('Error loading remaining comments:', error);
          }
        }
      });
  }

  postComment(): void {
    if (!this.newCommentText.trim()) {
      this.errorMessage = 'Comment cannot be empty';
      return;
    }

    if (this.newCommentText.length > 2000) {
      this.errorMessage = 'Comment must be less than 2000 characters';
      return;
    }

    this.isPosting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const doPost = (lat?: number | null, lng?: number | null) => {
      this.commentService.createComment(this.videoId, this.newCommentText, lat ?? null, lng ?? null)
        .subscribe({
          next: (response) => {
            this.successMessage = 'Comment posted successfully!';
            this.newCommentText = '';
            this.remainingComments = response.remainingComments;
            this.isPosting = false;

            this.currentPage = 0;
            this.loadComments();

            setTimeout(() => {
              this.successMessage = '';
            }, 3000);
          },
          error: (error) => {
            console.error('[POST COMMENT] Error:', error);
            if (error.status === 429) {
              this.errorMessage = 'Comment limit exceeded. You can post 60 comments per hour.';
            } else if (error.error?.error) {
              this.errorMessage = error.error.error;
            } else {
              this.errorMessage = 'Failed to post comment';
            }
            this.isPosting = false;
          }
        });
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          doPost(lat, lng);
        },
        (error) => {
          console.warn('Geolocation failed or denied, posting comment without coords:', error);
          doPost();
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      console.warn('Geolocation not supported by browser, posting comment without coords');
      doPost();
    }
  }

  nextPage(): void {
    if (!this.isLastPage) {
      this.currentPage++;
      this.loadComments();
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadComments();
    }
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadComments();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(0, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages - 1, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(0, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  getTimeSince(date: Date | string | number[] | undefined): string {
    if (!date) return 'Unknown';
    
    const now = new Date();
    let commentDate: Date;
    
    if (Array.isArray(date)) {
      commentDate = new Date(date[0], date[1] - 1, date[2], date[3] || 0, date[4] || 0, date[5] || 0);
    } else {
      commentDate = new Date(date);
    }
    
    if (isNaN(commentDate.getTime())) {
      return 'Unknown';
    }
    
    const seconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000);
    
    if (seconds < 0) return 'just now';
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return commentDate.toLocaleDateString();
  }
}
