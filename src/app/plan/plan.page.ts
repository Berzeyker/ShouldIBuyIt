import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  addOutline,
  trashOutline,
  copyOutline,
  sparklesOutline,
  closeOutline,
  checkmarkOutline,
  barbellOutline,
  chevronForwardOutline,
  swapVerticalOutline,
} from 'ionicons/icons';
import { GymApiService } from '../services/gym-api.service';
import { Routine } from '../services/gym.models';

interface StarterOption {
  id: string;
  label: string;
  description: string;
  days: number;
}

const DAY_KEYS = [1, 2, 3, 4, 5, 6, 7];

@Component({
  selector: 'app-plan',
  templateUrl: './plan.page.html',
  styleUrls: ['./plan.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PlanPage implements OnInit {
  routines: Routine[] = [];
  week: Record<string, string[]> = {};
  dayNames: Record<string, string> = {
    1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday',
  };
  dayKeys = DAY_KEYS;
  today = 1;

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  selectedDay: number | null = null;
  starterSheetOpen = false;
  loadingStarter: string | null = null;

  starterOptions: StarterOption[] = [
    { id: 'ppl', label: 'Push / Pull / Legs', description: '3 days · push, pull and legs', days: 3 },
    { id: 'upper-lower', label: 'Upper / Lower', description: '4 days · alternating upper body and legs', days: 4 },
    { id: 'full-body', label: 'Full Body', description: '3 days · full body', days: 3 },
    { id: '5x5', label: '5x5 Strength', description: '3 days · barbell basics', days: 3 },
  ];

  constructor(private readonly gymApi: GymApiService, private readonly router: Router) {
    addIcons({
      calendarOutline, addOutline, trashOutline, copyOutline, sparklesOutline,
      closeOutline, checkmarkOutline, barbellOutline, chevronForwardOutline, swapVerticalOutline,
    });
  }

  ngOnInit() {
    const now = new Date();
    this.today = ((now.getDay() + 6) % 7) + 1;
    this.load();
  }

  ionViewWillEnter() {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.gymApi.getRoutines().then(({ routines, week }) => {
      this.routines = routines;
      this.week = week;
    }).catch((error: any) => {
      this.errorMessage = error?.error?.message || 'Could not load the routines.';
    }).finally(() => (this.isLoading = false));
  }

  routinesForDay(day: number): Routine[] {
    const ids = this.week[String(day)] || [];
    return ids.map((id) => this.routines.find((r) => r.id === id)).filter((r): r is Routine => !!r);
  }

  isAssigned(day: number, routineId: string): boolean {
    return (this.week[String(day)] || []).includes(routineId);
  }

  async toggleAssignment(day: number, routineId: string) {
    const key = String(day);
    const current = [...(this.week[key] || [])];
    const at = current.indexOf(routineId);
    if (at >= 0) current.splice(at, 1);
    else current.push(routineId);
    this.week[key] = current;
    try {
      const { week } = await this.gymApi.saveWeek(this.week);
      this.week = week;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not update the week.';
      this.load();
    }
  }

  openDay(day: number) {
    this.selectedDay = day;
  }

  closeDay() {
    this.selectedDay = null;
  }

  nuevaRutina() {
    this.router.navigateByUrl('/tabs/plan/routine/new');
  }

  editarRutina(id: string) {
    this.router.navigateByUrl(`/tabs/plan/routine/${id}`);
  }

  async copiarRutina(routine: Routine, event: Event) {
    event.stopPropagation();
    try {
      const copyName = routine.name.endsWith(')') ? `${routine.name} 2` : `${routine.name} (copy)`;
      await this.gymApi.createRoutine(copyName, routine.emoji, routine.exercises);
      this.successMessage = 'Routine duplicated.';
      this.load();
      setTimeout(() => (this.successMessage = ''), 2000);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not duplicate the routine.';
    }
  }

  async eliminarRutina(routine: Routine, event: Event) {
    event.stopPropagation();
    const ok = window.confirm(`Delete the routine "${routine.name}"? It will also be removed from the weekly plan.`);
    if (!ok) return;
    try {
      await this.gymApi.deleteRoutine(routine.id);
      this.load();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not delete the routine.';
    }
  }

  openStarterSheet() {
    this.starterSheetOpen = true;
  }

  closeStarterSheet() {
    this.starterSheetOpen = false;
  }

  async cargarStarter(planId: string) {
    this.loadingStarter = planId;
    try {
      await this.gymApi.loadStarterPlan(planId as any);
      this.starterSheetOpen = false;
      this.successMessage = 'Starter plan loaded into your week.';
      this.load();
      setTimeout(() => (this.successMessage = ''), 2500);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not load the plan.';
    } finally {
      this.loadingStarter = null;
    }
  }

  totalEjercicios(routine: Routine): number {
    return routine.exercises.length;
  }

  resumenRutina(routine: Routine): string {
    const sets = routine.exercises.reduce((n, ex) => n + ex.sets, 0);
    return `${routine.exercises.length} exercises · ${sets} sets`;
  }
}
