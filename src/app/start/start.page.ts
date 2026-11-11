import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner, ViewWillEnter } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  timerOutline,
  playOutline,
  addOutline,
  closeOutline,
  checkmarkOutline,
  chevronUpOutline,
  chevronDownOutline,
  barbellOutline,
  flameOutline,
  stopOutline,
  trashOutline,
  trendingUpOutline,
  ribbonOutline,
  calendarOutline,
  saveOutline,
} from 'ionicons/icons';
import { GymApiService } from '../services/gym-api.service';
import { CatalogExercise, HomePayload, Routine, SetRow, Workout, WorkoutEntry } from '../services/gym.models';
import { ExercisePickerComponent } from '../components/exercise-picker/exercise-picker.component';

interface Draft {
  w: number;
  r: number;
}

@Component({
  selector: 'app-start',
  templateUrl: './start.page.html',
  styleUrls: ['./start.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner, ExercisePickerComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class StartPage implements OnInit, ViewWillEnter, OnDestroy {
  workout: Workout | null = null;
  home: HomePayload | null = null;
  routines: Routine[] = [];

  isLoading = false;
  isStarting = false;
  isSaving = false;
  isFinishing = false;
  errorMessage = '';

  expanded: number | null = null;
  pickerOpen = false;
  recap: Workout | null = null;

  now = Date.now();
  restTotal = 0;
  restRemaining = 0;

  private readonly drafts = new Map<string, Draft>();
  private saveTimer: any = null;
  private tickTimer: any = null;
  private restTimer: any = null;
  private skipNextEnter = false;

  constructor(
    private readonly gymApi: GymApiService,
    private readonly router: Router,
  ) {
    addIcons({
      timerOutline,
      playOutline,
      addOutline,
      closeOutline,
      checkmarkOutline,
      chevronUpOutline,
      chevronDownOutline,
      barbellOutline,
      flameOutline,
      stopOutline,
      trashOutline,
      trendingUpOutline,
      ribbonOutline,
      calendarOutline,
      saveOutline,
    });
  }

  ngOnInit() {
    this.skipNextEnter = true;
    this.reload();
  }

  ionViewWillEnter() {
    if (this.skipNextEnter) {
      this.skipNextEnter = false;
      return;
    }
    this.reload();
  }

  ngOnDestroy() {
    this.clearTimers();
  }

  // -- Carga de estado ------------------------------------------------------

  async reload() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const { workout } = await this.gymApi.getActiveWorkout();
      this.workout = workout;
      if (workout) {
        this.adoptSession();
      } else {
        const [home, { routines }] = await Promise.all([this.gymApi.getHome(), this.gymApi.getRoutines()]);
        this.home = home;
        this.routines = routines;
        this.stopTicker();
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not load the session.';
    } finally {
      this.isLoading = false;
    }
  }

  private adoptSession() {
    this.drafts.clear();
    this.workout?.entries.forEach((en) => this.draftFor(en));
    this.expanded = this.workout && this.workout.entries.length > 0 ? 0 : null;
    this.startTicker();
  }

  // -- Inicio de sesiones ---------------------------------------------------

  async startSession(routineId: string | null) {
    this.isStarting = true;
    this.errorMessage = '';
    try {
      const { workout } = await this.gymApi.startWorkout(routineId);
      this.workout = workout;
      this.recap = null;
      this.adoptSession();
    } catch (error: any) {
      if (error?.status === 409 && error?.error?.workout) {
        this.workout = error.error.workout;
        this.adoptSession();
      } else {
        this.errorMessage = error?.error?.message || 'Could not start the session.';
      }
    } finally {
      this.isStarting = false;
    }
  }

  todayRoutineIds(): string[] {
    return (this.home?.todayRoutines || []).map((r) => r.id);
  }

  otherRoutines(): Routine[] {
    const today = new Set(this.todayRoutineIds());
    return this.routines.filter((r) => !today.has(r.id));
  }

  // -- Borradores peso/reps por ejercicio -----------------------------------

  draftFor(en: WorkoutEntry): Draft {
    let d = this.drafts.get(en.exId);
    if (!d) {
      d = {
        w: en.cfg.weight > 0 ? en.cfg.weight : (en.last?.w ?? 0),
        r: en.cfg.reps > 0 ? en.cfg.reps : 10,
      };
      this.drafts.set(en.exId, d);
    }
    return d;
  }

  setDraftW(en: WorkoutEntry, value: any) {
    const n = Number(value);
    if (Number.isFinite(n)) this.draftFor(en).w = Math.max(0, n);
  }

  setDraftR(en: WorkoutEntry, value: any) {
    const n = Number(value);
    if (Number.isFinite(n)) this.draftFor(en).r = Math.max(1, Math.round(n));
  }

  bumpWeight(en: WorkoutEntry, delta: number) {
    const d = this.draftFor(en);
    d.w = Math.max(0, Math.round((d.w + delta) * 10) / 10);
  }

  bumpReps(en: WorkoutEntry, delta: number) {
    const d = this.draftFor(en);
    d.r = Math.max(1, d.r + delta);
  }

  bumpRest(en: WorkoutEntry, delta: number) {
    en.cfg.restSec = Math.max(0, (en.cfg.restSec || 0) + delta);
    this.scheduleSave();
  }

  // -- Registro de series ---------------------------------------------------

  addRow(en: WorkoutEntry, warmup = false) {
    const d = this.draftFor(en);
    const row: SetRow = {
      w: Math.max(0, Number(d.w)),
      r: Math.max(1, Math.round(d.r)),
      ts: Date.now(),
      phase: warmup ? 'warmup' : 'work',
    };
    en.rows.push(row);
    if (!warmup) {
      en.cfg.weight = row.w;
      if (en.cfg.restSec > 0) this.startRest(en.cfg.restSec);
    }
    this.scheduleSave();
  }

  removeRow(en: WorkoutEntry, index: number) {
    en.rows.splice(index, 1);
    this.scheduleSave();
  }

  removeEntry(index: number) {
    if (!this.workout) return;
    const removed = this.workout.entries.splice(index, 1)[0];
    if (removed) this.drafts.delete(removed.exId);
    if (this.expanded !== null) {
      if (this.expanded === index) this.expanded = null;
      else if (this.expanded > index) this.expanded--;
    }
    this.scheduleSave();
  }

  isPr(en: WorkoutEntry, row: SetRow): boolean {
    if (row.phase === 'warmup' || !(row.w > 0)) return false;
    return en.last ? row.w > en.last.w : true;
  }

  workRows(en: WorkoutEntry): SetRow[] {
    return en.rows.filter((r) => r.phase !== 'warmup');
  }

  doneRows(en: WorkoutEntry): number {
    return this.workRows(en).length;
  }

  entryVolume(en: WorkoutEntry): number {
    return this.workRows(en).reduce((v, r) => v + (Number(r.w) || 0) * (Number(r.r) || 0), 0);
  }

  totalVolume(): number {
    return (this.workout?.entries || []).reduce((v, en) => v + this.entryVolume(en), 0);
  }

  totalSets(): number {
    return (this.workout?.entries || []).reduce((n, en) => n + this.workRows(en).length, 0);
  }

  sessionPrs(): number {
    return (this.workout?.entries || []).filter((en) => this.workRows(en).some((r) => this.isPr(en, r))).length;
  }

  progressPct(en: WorkoutEntry): number {
    const target = Math.max(1, en.cfg.sets || 1);
    return Math.min(100, Math.round((this.doneRows(en) / target) * 100));
  }

  toggleExpanded(index: number) {
    this.expanded = this.expanded === index ? null : index;
  }

  // -- Cronómetro de sesión --------------------------------------------------

  startTicker() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => (this.now = Date.now()), 1000);
  }

  stopTicker() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  elapsedSec(): number {
    if (!this.workout) return 0;
    return Math.max(0, Math.floor((this.now - new Date(this.workout.startedAt).getTime()) / 1000));
  }

  elapsed(): string {
    return this.fmtDuration(this.elapsedSec());
  }

  fmtDuration(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
  }

  // -- Temporizador de descanso ----------------------------------------------

  startRest(sec: number) {
    this.restTotal = sec;
    this.restRemaining = sec;
    if (!this.restTimer) {
      this.restTimer = setInterval(() => {
        this.now = Date.now();
        this.restRemaining -= 1;
        if (this.restRemaining <= 0) this.stopRest();
      }, 1000);
    }
  }

  addRestSec(sec: number) {
    if (this.restRemaining <= 0) return;
    this.restTotal += sec;
    this.restRemaining += sec;
  }

  stopRest() {
    if (this.restTimer) clearInterval(this.restTimer);
    this.restTimer = null;
    this.restRemaining = 0;
    this.restTotal = 0;
  }

  restPct(): number {
    if (this.restTotal <= 0) return 0;
    return Math.round(((this.restTotal - this.restRemaining) / this.restTotal) * 100);
  }

  // -- Autoguardado -----------------------------------------------------------

  scheduleSave() {
    if (!this.workout) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      if (!this.workout) return;
      this.isSaving = true;
      try {
        await this.gymApi.saveWorkout(this.workout.id, {
          entries: this.workout.entries,
          notes: this.workout.notes,
        });
      } catch {
        this.errorMessage = 'Could not save the session automatically.';
      } finally {
        this.isSaving = false;
      }
    }, 900);
  }

  onNotes(value: string) {
    if (this.workout) this.workout.notes = value;
    this.scheduleSave();
  }

  // -- Añadir ejercicio a la sesión -------------------------------------------

  openPicker() {
    if (!this.workout) return;
    this.pickerOpen = true;
  }

  closePicker() {
    this.pickerOpen = false;
  }

  onExercisePicked(ex: CatalogExercise) {
    this.pickerOpen = false;
    if (!this.workout) return;
    if (this.workout.entries.some((e) => e.exId === ex.id)) return;

    const entry: WorkoutEntry = {
      exId: ex.id,
      name: ex.name,
      cfg: { sets: 3, reps: 10, weight: 0, restSec: 90, unit: 'kg', mode: 'reps' },
      rows: [],
      last: null,
    };
    this.workout.entries.push(entry);
    this.drafts.delete(ex.id);
    this.draftFor(entry);
    this.expanded = this.workout.entries.length - 1;
    this.scheduleSave();

    // Trae la última marca para pre-rellenar peso y detectar PRs.
    this.gymApi.getExerciseStats(ex.id).then((stats) => {
      if (!this.workout || this.workout.entries.indexOf(entry) < 0) return;
      entry.last = stats.best ? { w: stats.best.w, r: stats.best.r } : null;
      if (!entry.rows.length && stats.last) {
        const d = this.draftFor(entry);
        if (!d.w && stats.last.w > 0) {
          d.w = stats.last.w;
          entry.cfg.weight = stats.last.w;
        }
      }
    }).catch(() => undefined);
  }

  // -- Terminar / descartar ----------------------------------------------------

  async finish() {
    if (!this.workout || this.isFinishing) return;
    this.isFinishing = true;
    this.errorMessage = '';
    try {
      const { workout } = await this.gymApi.finishWorkout(this.workout.id, this.workout.entries);
      this.stopRest();
      this.stopTicker();
      this.workout = null;
      this.drafts.clear();
      this.recap = workout;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not finish the session.';
    } finally {
      this.isFinishing = false;
    }
  }

  async discard() {
    if (!this.workout) return;
    if (!window.confirm('Discard the session and delete the logged sets?')) return;
    try {
      await this.gymApi.deleteWorkout(this.workout.id);
      this.stopRest();
      this.stopTicker();
      this.workout = null;
      this.drafts.clear();
      this.recap = null;
      this.reload();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Could not discard the session.';
    }
  }

  recapVolume(): number {
    return (this.recap?.entries || []).reduce((v, en) => v + this.entryVolume(en), 0);
  }

  recapSets(): number {
    return (this.recap?.entries || []).reduce((n, en) => n + this.workRows(en).length, 0);
  }

  recapPrs(): number {
    return (this.recap?.entries || []).filter((en) => this.workRows(en).some((r) => this.isPr(en, r))).length;
  }

  goRecap(dest: 'stats' | 'home') {
    this.recap = null;
    this.router.navigateByUrl(dest === 'stats' ? '/tabs/stats' : '/tabs/home');
  }

  irAlPlan() {
    this.router.navigateByUrl('/tabs/plan');
  }

  private clearTimers() {
    this.stopTicker();
    this.stopRest();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
