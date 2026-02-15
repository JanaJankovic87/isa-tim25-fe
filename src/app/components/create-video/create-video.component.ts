import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { GeocodingService } from '../../services/geocoding.service';

@Component({
  selector: 'app-create-video',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './create-video.component.html',
  styleUrls: ['./create-video.component.css']
})
export class CreateVideoComponent implements OnInit {
  videoForm!: FormGroup;
  thumbnailFile: File | null = null;
  videoFile: File | null = null;
  thumbnailPreview: string | null = null;
  videoPreview: string | null = null;
  uploadProgress: number = 0;
  isUploading = false;
  tags: string[] = [];
  tagInput = new FormControl('');
  errorMessage: string = '';
  
  // Geocoding state
  isLoadingLocation = false;
  latitude: number | null = null;
  longitude: number | null = null;
  locationName: string | null = null;
  
  // Scheduled streaming
  isScheduled = false;
  minDateTime: string = '';
  showScheduleDialog = false;
  scheduledTimeDisplay: string = '';
  
  readonly MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

  constructor(
    private fb: FormBuilder,
    private videoService: VideoService,
    private geocodingService: GeocodingService,
    private router: Router
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Automatically get user's location when component loads
    this.loadUserLocation();
    this.setMinDateTime();
  }

  initForm(): void {
    this.videoForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      location: ['', [Validators.maxLength(255)]],
      scheduledTime: ['']
    });
  }

  setMinDateTime(): void {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Minimum 5 minutes from now
    this.minDateTime = this.formatDateTimeLocal(now);
  }

  formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  toggleScheduled(): void {
    this.isScheduled = !this.isScheduled;
    if (!this.isScheduled) {
      this.videoForm.patchValue({ scheduledTime: '' });
      this.scheduledTimeDisplay = '';
    }
  }

  openScheduleDialog(): void {
    if (!this.isUploading) {
      this.showScheduleDialog = true;
      this.isScheduled = true;
    }
  }

  closeScheduleDialog(): void {
    this.showScheduleDialog = false;
  }

  confirmSchedule(): void {
    const scheduledTime = this.videoForm.get('scheduledTime')?.value;
    if (scheduledTime) {
      this.updateScheduledTimeDisplay();
      this.showScheduleDialog = false;
      this.isScheduled = true;
    }
  }

  updateScheduledTimeDisplay(): void {
    const scheduledTime = this.videoForm.get('scheduledTime')?.value;
    if (scheduledTime) {
      const date = new Date(scheduledTime);
      this.scheduledTimeDisplay = date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      this.scheduledTimeDisplay = '';
    }
  }

  /**
   * Load user's location from IP address
   */
  loadUserLocation(): void {
    this.isLoadingLocation = true;
    this.errorMessage = '';

    this.geocodingService.getCurrentPosition().subscribe({
      next: (result: any) => {
        this.isLoadingLocation = false;
        
        if (result) {
          this.latitude = result.latitude;
          this.longitude = result.longitude;
          this.locationName = result.displayName;
          // Automatically fill location field
          this.videoForm.patchValue({ location: result.displayName });
          console.log('Location loaded:', result);
        } else {
          console.warn('Could not determine location');
        }
      },
      error: (error: any) => {
        this.isLoadingLocation = false;
        console.error('Location loading error:', error);
      }
    });
  }

  /**
   * Use precise GPS location (optional - if user wants more accuracy)
   */
  useGPSLocation(): void {
    this.isLoadingLocation = true;
    this.errorMessage = '';

    this.geocodingService.getCurrentPosition().subscribe({
      next: (result) => {
        this.isLoadingLocation = false;
        
        if (result) {
          this.latitude = result.latitude;
          this.longitude = result.longitude;
          this.locationName = result.displayName;
          this.videoForm.patchValue({ location: result.displayName });
        } else {
          this.errorMessage = 'Nije moguće dobiti GPS lokaciju';
        }
      },
      error: (error) => {
        this.isLoadingLocation = false;
        console.error('GPS error:', error);
        this.errorMessage = 'Greška pri dobijanju GPS lokacije';
      }
    });
  }

  onThumbnailSelected(event: any): void {
    const file = event.target.files[0];
    
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Thumbnail must be an image file';
      return;
    }

    this.thumbnailFile = file;
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.thumbnailPreview = e.target.result;
    };
    reader.readAsDataURL(file);
    
    this.errorMessage = '';
  }

  onVideoSelected(event: any): void {
    const file = event.target.files[0];
    
    if (!file) return;

    if (file.type !== 'video/mp4') {
      this.errorMessage = 'Video must be MP4 format';
      return;
    }

    if (file.size > this.MAX_VIDEO_SIZE) {
      this.errorMessage = 'Video must be less than 200MB';
      return;
    }

    this.videoFile = file;
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.videoPreview = e.target.result;
    };
    reader.readAsDataURL(file);
    
    this.errorMessage = '';
  }

  addTag(): void {
    const tagValue = this.tagInput.value?.trim();
    
    if (!tagValue) return;
    
    if (this.tags.includes(tagValue)) {
      this.errorMessage = 'Tag already added';
      return;
    }
    
    if (this.tags.length >= 10) {
      this.errorMessage = 'Maximum 10 tags allowed';
      return;
    }
    
    this.tags.push(tagValue);
    this.tagInput.setValue('');
    this.errorMessage = '';
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
  }

  onSubmit(): void {
    if (this.videoForm.invalid) {
      this.errorMessage = 'Please fill all required fields';
      Object.keys(this.videoForm.controls).forEach(key => {
        this.videoForm.get(key)?.markAsTouched();
      });
      return;
    }

    if (!this.thumbnailFile) {
      this.errorMessage = 'Thumbnail is required';
      return;
    }

    if (!this.videoFile) {
      this.errorMessage = 'Video is required';
      return;
    }

    if (this.tags.length === 0) {
      this.errorMessage = 'At least one tag is required';
      return;
    }

    if (this.isScheduled) {
      const scheduledTime = this.videoForm.value.scheduledTime;
      if (!scheduledTime) {
        this.errorMessage = 'Please select a scheduled time';
        return;
      }
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();
      if (scheduledDate <= now) {
        this.errorMessage = 'Scheduled time must be in the future';
        return;
      }
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';

    // Get location from form or use auto-detected location
    const location = this.videoForm.value.location || this.locationName;
    
    const scheduledTime = this.isScheduled ? this.videoForm.value.scheduledTime : null;

    this.videoService.createVideo(
      this.videoForm.value.title,
      this.videoForm.value.description,
      this.tags,
      location,
      this.latitude,
      this.longitude,
      this.thumbnailFile,
      this.videoFile,
      (progress: number) => {
        this.uploadProgress = progress;
      },
      scheduledTime
    ).subscribe({
      next: (response) => {
        if (response) {
          console.log('Video created:', response);
          const message = this.isScheduled 
            ? 'Video successfully scheduled! It will be available at the scheduled time. 🎉'
            : 'Video successfully uploaded! 🎉';
          alert(message);
          this.router.navigate(['/']);
        }
      },
      error: (error) => {
        console.error('Upload error:', error);
        
        this.isUploading = false;
        this.uploadProgress = 0;
        
        if (error.status === 401) {
          this.errorMessage = 'You must be logged in to upload videos';
        } else if (error.status === 413) {
          this.errorMessage = 'File is too large (max 200MB)';
        } else if (error.error && typeof error.error === 'string') {
          this.errorMessage = error.error;
        } else if (error.message) {
          this.errorMessage = error.message;
        } else {
          this.errorMessage = 'Upload failed. Please try again.';
        }
      },
      complete: () => {
        this.isUploading = false;
      }
    });
  }

  onCancel(): void {
    if (confirm('Are you sure? All changes will be lost.')) {
      this.router.navigate(['/']);
    }
  }

  getVideoSize(): string {
    if (!this.videoFile) return '';
    return (this.videoFile.size / 1024 / 1024).toFixed(2) + ' MB';
  }
}