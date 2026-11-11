import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner, ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  searchOutline,
  closeOutline,
  chevronDownOutline,
  chevronUpOutline,
  chevronForwardOutline,
  addOutline,
  addCircleOutline,
  videocamOutline,
  imageOutline,
  ribbonOutline,
  timeOutline,
  trendingUpOutline,
  barbellOutline,
  checkmarkOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import { GymApiService } from '../services/gym-api.service';
import { CatalogExercise, CatalogMeta, ExerciseStats, Routine } from '../services/gym.models';

@Component({
  selector: 'app-exercises',
  templateUrl: './exercises.page.html',
  styleUrls: ['./exercises.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ExercisesPage implements ViewWillEnter {
  query = '';
  bodyPart = '';
  equipment = '';
  category = '';

  meta: CatalogMeta | null = null;
  results: CatalogExercise[] = [];
  total = 0;
  offset = 0;
  readonly pageSize = 40;

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Detalle
  detail: CatalogExercise | null = null;
  detailStats: ExerciseStats | null = null;
  detailLoading = false;
  showClip = false;
  clipFailed = false;

  // Añadir a rutina
  addToRoutineOpen = false;
  routines: Routine[] = [];
  routinesLoading = false;
  addingRoutineId: string | null = null;

  private searchTimer: any = null;

  constructor(private readonly gymApi: GymApiService) {
    addIcons({
      searchOutline,
      closeOutline,
      chevronDownOutline,
      chevronUpOutline,
      addOutline,
      addCircleOutline,
      videocamOutline,
      imageOutline,
      ribbonOutline,
      timeOutline,
      trendingUpOutline,
      barbellOutline,
      checkmarkOutline,
      arrowForwardOutline,
    });
  }

  ionViewWillEnter() {
    if (!this.meta) {
      this.gymApi.getCatalogMeta().subscribe((meta) => (this.meta = meta));
      this.search();
    }
  }

  // -- Búsqueda ------------------------------------------------------------

  onQueryInput() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.search(), 300);
  }

  clearQuery() {
    this.query = '';
    this.search();
  }

  setBodyPart(bp: string) {
    this.bodyPart = this.bodyPart === bp ? '' : bp;
    this.search();
  }

  setEquipment(eq: string) {
    this.equipment = this.equipment === eq ? '' : eq;
    this.search();
  }

  setCategory(cat: string) {
    this.category = this.category === cat ? '' : cat;
    this.search();
  }

  search() {
    this.offset = 0;
    this.isLoading = true;
    this.gymApi
      .searchCatalog({
        q: this.query || undefined,
        bp: this.bodyPart || undefined,
        eq: this.equipment || undefined,
        cat: this.category || undefined,
        limit: this.pageSize,
        offset: 0,
      })
      .subscribe({
        next: ({ total, exercises }) => {
          this.results = exercises;
          this.total = total;
          this.offset = exercises.length;
        },
        error: () => (this.errorMessage = 'No se pudo cargar el catálogo.'),
      })
      .add(() => (this.isLoading = false));
  }

  loadMore() {
    if (this.isLoading || this.offset >= this.total) return;
    this.isLoading = true;
    this.gymApi
      .searchCatalog({
        q: this.query || undefined,
        bp: this.bodyPart || undefined,
        eq: this.equipment || undefined,
        cat: this.category || undefined,
        limit: this.pageSize,
        offset: this.offset,
      })
      .subscribe({
        next: ({ total, exercises }) => {
          this.results = [...this.results, ...exercises];
          this.total = total;
          this.offset += exercises.length;
        },
        error: () => undefined,
      })
      .add(() => (this.isLoading = false));
  }

  // -- Detalle ---------------------------------------------------------------

  openDetail(ex: CatalogExercise) {
    this.detail = ex;
    this.detailStats = null;
    this.detailLoading = true;
    this.showClip = false;
    this.clipFailed = false;
    this.gymApi
      .getExerciseStats(ex.id)
      .then((stats) => (this.detailStats = stats))
      .catch(() => (this.detailStats = null))
      .finally(() => (this.detailLoading = false));
  }

  closeDetail() {
    this.detail = null;
    this.detailStats = null;
    this.addToRoutineOpen = false;
  }

  toggleClip() {
    this.showClip = !this.showClip;
    this.clipFailed = false;
  }

  onClipError() {
    this.clipFailed = true;
  }

  imageUrl(ex: CatalogExercise | null): string {
    return ex ? this.gymApi.exerciseImageUrl(ex) : '';
  }

  clipUrl(ex: CatalogExercise | null): string {
    return ex ? this.gymApi.exerciseClipUrl(ex) : '';
  }

  rowsSummary(rows: { w: number; r: number }[]): string {
    return rows.map((r) => `${r.w}×${r.r}`).join(', ');
  }

  // -- Añadir a rutina ---------------------------------------------------------

  async openAddToRoutine() {
    if (!this.detail) return;
    this.addToRoutineOpen = true;
    if (!this.routines.length) {
      this.routinesLoading = true;
      try {
        const { routines } = await this.gymApi.getRoutines();
        this.routines = routines;
      } catch {
        this.errorMessage = 'No se pudieron cargar tus rutinas.';
      } finally {
        this.routinesLoading = false;
      }
    }
  }

  closeAddToRoutine() {
    this.addToRoutineOpen = false;
  }

  async addToRoutine(routine: Routine) {
    const ex = this.detail;
    if (!ex || this.addingRoutineId) return;
    if (routine.exercises.some((e) => e.id === ex.id)) {
      this.successMessage = `«${ex.name}» ya está en ${routine.name}.`;
      this.addToRoutineOpen = false;
      setTimeout(() => (this.successMessage = ''), 2500);
      return;
    }
    this.addingRoutineId = routine.id;
    try {
      await this.gymApi.updateRoutine(routine.id, {
        exercises: [
          ...routine.exercises,
          { id: ex.id, name: ex.name, sets: 3, reps: 10, weight: 0, restSec: 90 },
        ],
      });
      // Refresca la copia local de rutinas
      this.routines = this.routines.map((r) =>
        r.id === routine.id
          ? { ...r, exercises: [...r.exercises, { id: ex.id, name: ex.name, sets: 3, reps: 10, weight: 0, restSec: 90 }] }
          : r,
      );
      this.successMessage = `Añadido a ${routine.name}.`;
      this.addToRoutineOpen = false;
      this.detail = null;
      setTimeout(() => (this.successMessage = ''), 2500);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo añadir el ejercicio.';
    } finally {
      this.addingRoutineId = null;
    }
  }
}
