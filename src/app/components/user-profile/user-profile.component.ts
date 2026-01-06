import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';

interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css'
})
export class UserProfileComponent implements OnInit {
  userProfile: UserProfile | null = null;
  isLoading = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
    private location: Location
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.route.params.subscribe(params => {
      const userId = params['userId'];
      console.log('User Profile - userId from route:', userId);
      if (userId) {
        this.loadUserProfile(userId);
      } else {
        console.error('No userId in route params');
        this.errorMessage = 'No user ID provided';
        this.isLoading = false;
      }
    });
  }

  loadUserProfile(userId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    const url = `http://localhost:8082/api/users/${userId}/profile`;
    console.log('Fetching user profile from:', url);

    this.http.get<UserProfile>(url)
      .subscribe({
        next: (data) => {
          console.log('User profile loaded successfully:', data);
          this.userProfile = data;
          this.isLoading = false;
          console.log('isLoading set to:', this.isLoading);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          console.error('Error status:', error.status);
          console.error('Error message:', error.message);
          this.errorMessage = `Failed to load user profile: ${error.status} ${error.statusText || error.message}`;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  goBack(): void {
    this.location.back();
  }
}
