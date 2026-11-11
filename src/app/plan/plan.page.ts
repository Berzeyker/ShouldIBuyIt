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
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
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
    { id: 'ppl', label: 'Push / Pull / Legs', description: '3 días · empuje, tirón y pierna', days: 3 },
    { id: 'upper-lower', label: 'Upper / Lower', description: '4 días · torso y pierna alternados', days: 4 },
    { id: 'full-body', label: 'Full Body', description: '3 días · cuerpo completo', days: 3 },
    { id: '5x5', label: '5x5 Fuerza', description: '3 días · básicos con barra', days: 3 },
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
      this.errorMessage = error?.error?.message || 'No se pudieron cargar las rutinas.';
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
      this.errorMessage = error?.error?.message || 'No se pudo actualizar la semana.';
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
      const copyName = routine.name.endsWith(')') ? `${routine.name} 2` : `${routine.name} (copia)`;
      await this.gymApi.createRoutine(copyName, routine.emoji, routine.exercises);
      this.successMessage = 'Rutina copiada.';
      this.load();
      setTimeout(() => (this.successMessage = ''), 2000);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo copiar la rutina.';
    }
  }

  async eliminarRutina(routine: Routine, event: Event) {
    event.stopPropagation();
    const ok = window.confirm(`¿Eliminar la rutina "${routine.name}"? También se quitará del plan semanal.`);
    if (!ok) return;
    try {
      await this.gymApi.deleteRoutine(routine.id);
      this.load();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo eliminar la rutina.';
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
      this.successMessage = 'Plan inicial cargado en tu semana.';
      this.load();
      setTimeout(() => (this.successMessage = ''), 2500);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo cargar el plan.';
    } finally {
      this.loadingStarter = null;
    }
  }

  totalEjercicios(routine: Routine): number {
    return routine.exercises.length;
  }

  resumenRutina(routine: Routine): string {
    const sets = routine.exercises.reduce((n, ex) => n + ex.sets, 0);
    return `${routine.exercises.length} ejercicios · ${sets} series`;
  }
}
