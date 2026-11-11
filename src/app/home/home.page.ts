import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  statsChartOutline,
  barbellOutline,
  scaleOutline,
  checkmarkOutline,
  logOutOutline,
  flameOutline,
  calendarOutline,
  timeOutline,
  playOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { AuthApiService } from '../services/auth-api.service';
import { GymApiService } from '../services/gym-api.service';
import { HomePayload, StatsSummary } from '../services/gym.models';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class HomePage implements OnInit {
  home: HomePayload | null = null;
  summary: StatsSummary | null = null;
  currentWeight = '';
  isLoading = false;
  isSavingWeight = false;
  successMessage = '';
  errorMessage = '';
  currentUser = 'User';

  constructor(
    private readonly authApiService: AuthApiService,
    private readonly gymApi: GymApiService,
    private readonly router: Router,
  ) {
    addIcons({
      personCircleOutline,
      statsChartOutline,
      barbellOutline,
      scaleOutline,
      checkmarkOutline,
      logOutOutline,
      flameOutline,
      calendarOutline,
      timeOutline,
      playOutline,
      trendingUpOutline,
    });
  }

  async ngOnInit() {
    const user = await this.authApiService.getCurrentUser();
    this.currentUser = user?.username || 'User';
    this.refresh();
  }

  ionViewWillEnter() {
    this.refresh();
  }

  refresh(): void {
    this.errorMessage = '';
    this.gymApi.getHome().then((home) => {
      this.home = home;
      this.currentWeight = home.bodyweight ? String(home.bodyweight.weight) : '';
    }).catch(() => {
      this.errorMessage = 'Could not connect to the server.';
    });
    this.gymApi.getStatsSummary().then(({ summary }) => {
      this.summary = summary;
    }).catch(() => undefined);
  }

  onWeightInput(event: any) {
    this.currentWeight = event.target.value;
  }

  async guardarPeso() {
    const weight = Number(this.currentWeight);
    if (!this.currentWeight || !Number.isFinite(weight) || weight <= 0) {
      this.errorMessage = 'Enter a valid weight.';
      this.successMessage = '';
      return;
    }
    this.isSavingWeight = true;
    this.successMessage = '';
    this.errorMessage = '';
    try {
      await this.gymApi.saveBodyweight(weight);
      this.successMessage = 'Weight saved successfully!';
      setTimeout(() => (this.successMessage = ''), 2500);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not save the weight.';
    } finally {
      this.isSavingWeight = false;
    }
  }

  async iniciarRutina(routineId?: string) {
    try {
      if (!routineId && this.home?.activeWorkout) {
        this.router.navigateByUrl('/tabs/start');
        return;
      }
      if (this.home?.activeWorkout) {
        this.router.navigateByUrl('/tabs/start');
        return;
      }
      await this.gymApi.startWorkout(routineId ?? null);
      this.router.navigateByUrl('/tabs/start');
    } catch (error: any) {
      // 409: ya hay sesión activa -> continuarla
      if (error?.error?.workout || error?.status === 409) {
        this.router.navigateByUrl('/tabs/start');
        return;
      }
      this.errorMessage = error?.error?.message || 'Could not start the session.';
    }
  }

  continuarSesion() {
    this.router.navigateByUrl('/tabs/start');
  }

  irAlPlan() {
    this.router.navigateByUrl('/tabs/plan');
  }

  irALaBiblioteca() {
    this.router.navigateByUrl('/tabs/exercises');
  }

  duracionUltima(): string {
    const w = this.home?.lastWorkout;
    if (!w?.durationSec) return '';
    const min = Math.round(w.durationSec / 60);
    return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
  }

  volumenUltima(): number {
    const w = this.home?.lastWorkout;
    if (!w) return 0;
    return w.entries.reduce(
      (v, en) => v + en.rows.filter((r) => r.phase !== 'warmup').reduce((s, r) => s + r.w * r.r, 0),
      0,
    );
  }

  async cambiarUsuario() {
    await this.authApiService.logout();
    this.router.navigateByUrl('/login');
  }
}
