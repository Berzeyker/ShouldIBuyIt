import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner, ViewWillEnter } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  statsChartOutline,
  barChartOutline,
  ribbonOutline,
  scaleOutline,
  flameOutline,
  trendingUpOutline,
  timeOutline,
  chevronDownOutline,
  chevronUpOutline,
  addOutline,
  trashOutline,
  checkmarkOutline,
  calendarOutline,
  barbellOutline,
  refreshOutline,
} from 'ionicons/icons';
import { GymApiService } from '../services/gym-api.service';
import { BodyweightEntry, StatsSummary, Workout } from '../services/gym.models';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

@Component({
  selector: 'app-stats',
  templateUrl: './stats.page.html',
  styleUrls: ['./stats.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class StatsPage implements ViewWillEnter {
  summary: StatsSummary | null = null;
  recentWorkouts: Workout[] = [];
  bwEntries: BodyweightEntry[] = [];

  weightInput = '';
  expandedWorkout: string | null = null;

  isLoading = false;
  isSavingWeight = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly gymApi: GymApiService,
    private readonly router: Router,
  ) {
    addIcons({
      statsChartOutline,
      barChartOutline,
      ribbonOutline,
      scaleOutline,
      flameOutline,
      trendingUpOutline,
      timeOutline,
      chevronDownOutline,
      chevronUpOutline,
      addOutline,
      trashOutline,
      checkmarkOutline,
      calendarOutline,
      barbellOutline,
      refreshOutline,
    });
  }

  ionViewWillEnter() {
    this.refresh();
  }

  async refresh() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const [{ summary, recentWorkouts }, { entries }] = await Promise.all([
        this.gymApi.getStatsSummary(),
        this.gymApi.getBodyweight(60),
      ]);
      this.summary = summary;
      this.recentWorkouts = recentWorkouts;
      this.bwEntries = entries;
      this.weightInput = summary.bodyweight ? String(summary.bodyweight.weight) : '';
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudieron cargar las estadísticas.';
    } finally {
      this.isLoading = false;
    }
  }

  // -- Formato --------------------------------------------------------------

  fmtDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

  fmtDuration(sec: number | null | undefined): string {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    if (h > 0) return `${h} h ${m} min`;
    if (m > 0) return `${m} min`;
    return `${s} s`;
  }

  fmtTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // -- Volumen semanal --------------------------------------------------------

  maxWeeklyVolume(): number {
    return Math.max(1, ...(this.summary?.weeklyVolume || []).map((w) => w.volume));
  }

  barHeightPct(volume: number): number {
    return Math.max(2, Math.round((volume / this.maxWeeklyVolume()) * 100));
  }

  weekLabel(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // -- Peso corporal ------------------------------------------------------------

  bwPoints(): string {
    const series = this.summary?.bodyweightSeries || [];
    if (series.length < 2) return '';
    const ws = series.map((s) => s.weight);
    const min = Math.min(...ws);
    const max = Math.max(...ws);
    const range = max - min || 1;
    return series
      .map((s, i) => {
        const x = (i / (series.length - 1)) * 100;
        const y = 28 - ((s.weight - min) / range) * 24 - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  bwDelta(): number | null {
    const series = this.summary?.bodyweightSeries || [];
    if (series.length < 2) return null;
    const last = series[series.length - 1].weight;
    const prev = series[series.length - 2].weight;
    return Math.round((last - prev) * 10) / 10;
  }

  async saveWeight() {
    const weight = Number(this.weightInput);
    if (!this.weightInput || !Number.isFinite(weight) || weight <= 0) {
      this.errorMessage = 'Escribe un peso válido.';
      return;
    }
    this.isSavingWeight = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.gymApi.saveBodyweight(weight);
      this.successMessage = 'Peso registrado.';
      setTimeout(() => (this.successMessage = ''), 2500);
      await this.refresh();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo registrar el peso.';
    } finally {
      this.isSavingWeight = false;
    }
  }

  async deleteWeight(id: string) {
    if (!window.confirm('¿Eliminar este registro de peso?')) return;
    try {
      await this.gymApi.deleteBodyweight(id);
      await this.refresh();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo eliminar el registro.';
    }
  }

  // -- Sesiones ---------------------------------------------------------------

  workRows(entry: { rows: { w: number; r: number; phase: string }[] }): { w: number; r: number }[] {
    return entry.rows.filter((r) => r.phase !== 'warmup');
  }

  workoutVolume(w: Workout): number {
    return w.entries.reduce(
      (v, en) => v + this.workRows(en).reduce((s, r) => s + (Number(r.w) || 0) * (Number(r.r) || 0), 0),
      0,
    );
  }

  workoutSets(w: Workout): number {
    return w.entries.reduce((n, en) => n + this.workRows(en).length, 0);
  }

  toggleWorkout(id: string) {
    this.expandedWorkout = this.expandedWorkout === id ? null : id;
  }

  irASesion() {
    this.router.navigateByUrl('/tabs/start');
  }
}
