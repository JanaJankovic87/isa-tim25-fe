import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { JwtAuthenticationRequest } from '../../models/auth.model';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
 schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  resetError(): void {
    if (this.errorMessage) {
      this.errorMessage = '';
      this.cdr.detectChanges();
    }
  }

  onSubmit(): void {
   if (!this.username || !this.password) {
    this.errorMessage = 'Please enter username and password';
    this.cdr.detectChanges(); 
    return;
  }


  this.isLoading = true;
  this.errorMessage = '';
  this.cdr.detectChanges(); 

  const credentials: JwtAuthenticationRequest = {
    username: this.username,
    password: this.password
  };

  this.authService.login(credentials).subscribe({
    next: (response) => {
      this.isLoading = false;
      this.errorMessage = '';
      this.cdr.detectChanges(); 
      alert('You have successfully logged in!');
    },
    error: (error) => {
      this.isLoading = false;
      
      if (error.status === 401) {
        this.errorMessage = 'Incorrect username or password';
      } else if (error.status === 0) {
        this.errorMessage = 'Unable to connect to the server';
      } else {
        this.errorMessage = 'An error occurred. Please try again.';
      }
      
      this.cdr.detectChanges();
      
      console.log('ERROR MESSAGE SET:', this.errorMessage);
    }
    
  });
}
}

