import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./tab1/tab1.page').then(m => m.Tab1Page) // Tu pantalla principal independiente
  },
  {
    path: 'tabs',
    // Carga las rutas hijas definidas en la carpeta tabs
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  }
];