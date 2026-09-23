import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () => import('../home/home.page').then(m => m.HomePage)
      },
      {
        path: 'plan',
        loadComponent: () => import('../plan/plan.page').then(m => m.PlanPage)
      },
      {
        path: 'start',
        loadComponent: () => import('../start/start.page').then(m => m.StartPage)
      },
      {
        path: 'stats',
        loadComponent: () => import('../stats/stats.page').then(m => m.StatsPage)
      },
      {
        path: 'exercises',
        loadComponent: () => import('../exercises/exercises.page').then(m => m.ExercisesPage)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];