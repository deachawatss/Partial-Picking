import { Routes } from '@angular/router';
import { AuthGuard, GuestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Default redirect to login
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },

  // Login route (guest only)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [GuestGuard],
    title: 'Login - PK System'
  },


  // Main Partial Picking route (protected) - Direct post-login destination
  {
    path: 'partial-picking',
    loadComponent: () =>
      import('./features/picking/partial-picking/partial-picking.component').then(m => m.PartialPickingComponent),
    canActivate: [AuthGuard],
    title: 'Partial Picking - PK System'
  },


  // Weight scale management (protected)
  {
    path: 'scales',
    loadComponent: () =>
      import('./features/scales/scale-management/scale-management.component').then(m => m.ScaleManagementComponent),
    canActivate: [AuthGuard],
    title: 'Scale Management - PK System'
  },

  // Catch-all route - redirect to login
  {
    path: '**',
    redirectTo: '/login'
  }
];