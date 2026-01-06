import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VideoService } from '../../services/video.service';

@Component({
  selector: 'app-create-video',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-video.component.html',
  styleUrls: ['./create-video.component.css']
})
export class CreateVideoComponent {
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
  
  readonly MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

  constructor(
    private fb: FormBuilder,
    private videoService: VideoService,
    private router: Router
  ) {
    this.initForm();
  }

  initForm(): void {
    this.videoForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      location: ['', [Validators.maxLength(255)]]
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

    this.isUploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';

    
    this.videoService.createVideo(
      this.videoForm.value.title,
      this.videoForm.value.description,
      this.tags,
      this.videoForm.value.location || null,
      this.thumbnailFile,
      this.videoFile,
      (progress) => {
        this.uploadProgress = progress;
      }
    ).subscribe({
      next: (response) => {
        if (response) {
          console.log('Video created:', response);
          alert('Video successfully uploaded! 🎉');
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