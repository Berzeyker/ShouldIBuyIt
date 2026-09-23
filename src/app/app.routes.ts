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
    path: 'HomePage',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage) // Tu pantalla principal independiente
  },
  {
    path: 'tabs',
    // Carga las rutas hijas definidas en la carpeta tabs
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'plan',
    loadComponent: () => import('./plan/plan.page').then( m => m.PlanPage)
  },
  {
    path: 'start',
    loadComponent: () => import('./start/start.page').then( m => m.StartPage)
  },
  {
    path: 'stats',
    loadComponent: () => import('./stats/stats.page').then( m => m.StatsPage)
  },
  {
    path: 'exercises',
    loadComponent: () => import('./exercises/exercises.page').then( m => m.ExercisesPage)
  }
];