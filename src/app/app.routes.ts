import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'create-video',
    loadComponent: () => import('./components/create-video/create-video.component')
      .then(m => m.CreateVideoComponent),
    canActivate: [authGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./components/home/home.component')
      .then(m => m.HomeComponent)
  },
  {
    path: '',
    loadComponent: () => import('./components/home/home.component')
      .then(m => m.HomeComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component')
      .then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component')
      .then(m => m.SignupComponent)
  },
  {
    path: 'video/:id',
    loadComponent: () => import('./components/details-video/video-detail.component')
      .then(m => m.VideoDetailComponent),
    runGuardsAndResolvers: 'always'
  },
  {
    path: 'users/:userId/profile',
    loadComponent: () => import('./components/user-profile/user-profile.component')
      .then(m => m.UserProfileComponent)
  },
  {
    path: 'performance',
    loadComponent: () => import('./components/performance-dashboard/performance-dashboard.component')
      .then(m => m.PerformanceDashboardComponent)
  }
];
