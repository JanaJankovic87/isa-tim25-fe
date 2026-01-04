import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'my-videos',
    loadComponent: () => import('./components/my-videos/my-videos.component')
      .then(m => m.MyVideosComponent)
  },
      {
        path: 'create-video',
        loadComponent: () => import('./components/create-video/create-video.component')
          .then(m => m.CreateVideoComponent)
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
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'video/:id',
    loadComponent: () => import('./components/details-video/video-detail.component')
      .then(m => m.VideoDetailComponent),
    runGuardsAndResolvers: 'always'
  }

];
