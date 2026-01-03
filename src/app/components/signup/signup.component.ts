import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Address, UserRequest } from '../../models/auth.model';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SignupComponent {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  firstname = '';
  lastname = '';
  
  address: Address = {
    street: '',
    city: '',
    postalCode: '',
    country: ''
  };
  
  showAddressModal = false;
  
  errorMessage = '';
  fieldErrors: { [key: string]: string } = {};
  successMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  openAddressModal(): void {
    this.showAddressModal = true;
  }

  closeAddressModal(): void {
    this.showAddressModal = false;
  }

  saveAddress(): void {
    if (!this.address.street || !this.address.city || 
        !this.address.postalCode || !this.address.country) {
      alert('All address fields are required');
      return;
    }
    this.closeAddressModal();
  }

  isAddressComplete(): boolean {
    return this.address.street !== '' && this.address.city !== '' && 
           this.address.postalCode !== '' && 
           this.address.country !== '';
  }

  getAddressDisplay(): string {
    if (this.isAddressComplete()) {
      return `${this.address.street}, ${this.address.city}, ${this.address.postalCode}, ${this.address.country}`;
    }
    return 'Click to add address';
  }

  onSubmit(): void {
    if (!this.username || !this.email || !this.password || !this.confirmPassword || 
        !this.firstname || !this.lastname || !this.isAddressComplete()) {
      this.errorMessage = 'All fields are required';
      this.fieldErrors = {};
      this.cdr.detectChanges();
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.fieldErrors = { 'confirmPassword': 'Passwords do not match' };
      this.errorMessage = '';
      this.cdr.detectChanges();
      return;
    }

    this.errorMessage = '';
    this.fieldErrors = {};
    this.successMessage = '';
    this.isLoading = true;
    this.cdr.detectChanges();

    const userRequest: UserRequest = {
      username: this.username,
      email: this.email,
      password: this.password,
      confirmPassword: this.confirmPassword,
      firstname: this.firstname,
      lastname: this.lastname,
      address: this.address
    };

    this.authService.signup(userRequest).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.errorMessage = '';
        this.cdr.detectChanges();
        
        alert(response.message || 'Registration successful! Please check your email for verification.');
        
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.isLoading = false;
        
        
        if (error.status === 400 || error.status === 409) {
          if (error.error && typeof error.error === 'object') {
            if (error.error.errors) {
              this.fieldErrors = error.error.errors;
            } else if (error.error.message && !error.error.password && !error.error.email) {
              this.errorMessage = error.error.message;
            } else {
              this.fieldErrors = error.error;
            }
          } else if (typeof error.error === 'string') {
            this.errorMessage = error.error;
          } else {
            this.errorMessage = 'Invalid registration data';
          }
        } else if (error.status === 0) {
          this.errorMessage = 'Unable to connect to server';
        } 
        
        this.cdr.detectChanges();
        
      }
    });
  }

  hasFieldError(field: string): boolean {
    return !!this.fieldErrors[field];
  }

  getFieldError(field: string): string {
    return this.fieldErrors[field] || '';
  }
}
