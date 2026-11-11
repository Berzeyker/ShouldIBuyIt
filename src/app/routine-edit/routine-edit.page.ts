import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  saveOutline,
  addOutline,
  trashOutline,
  chevronUpOutline,
  chevronDownOutline,
  arrowBackOutline,
  closeOutline,
  barbell,
  listOutline,
} from 'ionicons/icons';
import { GymApiService } from '../services/gym-api.service';
import { CatalogExercise, Routine, RoutineExercise } from '../services/gym.models';
import { ExercisePickerComponent } from '../components/exercise-picker/exercise-picker.component';

const EMOJIS = ['💪', '🏋️', '🦵', '🔥', '⚡', '🥊', '🏃', '🧘', '❤️', '🤸'];

@Component({
  selector: 'app-routine-edit',
  templateUrl: './routine-edit.page.html',
  styleUrls: ['./routine-edit.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner, ExercisePickerComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class RoutineEditPage implements OnInit {
  routineId: string | null = null;
  isNew = true;
  name = '';
  emoji = '💪';
  exercises: RoutineExercise[] = [];

  emojis = EMOJIS;
  expandedIndex: number | null = null;

  isLoading = false;
  isSaving = false;
  errorMessage = '';
  pickerOpen = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly gymApi: GymApiService,
  ) {
    addIcons({ saveOutline, addOutline, trashOutline, chevronUpOutline, chevronDownOutline, arrowBackOutline, closeOutline, barbell, listOutline });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew = false;
      this.routineId = id;
      this.isLoading = true;
      this.gymApi.getRoutines().then(({ routines }) => {
        const found = routines.find((r) => r.id === id);
        if (found) {
          this.name = found.name;
          this.emoji = found.emoji || '💪';
          this.exercises = found.exercises.map((ex) => ({ ...ex }));
        } else {
          this.errorMessage = 'Rutina no encontrada.';
        }
      }).catch(() => (this.errorMessage = 'No se pudo cargar la rutina.'))
        .finally(() => (this.isLoading = false));
    }
  }

  setEmoji(e: string) {
    this.emoji = e;
  }

  openPicker() {
    this.pickerOpen = true;
  }

  closePicker() {
    this.pickerOpen = false;
  }

  onExercisePicked(ex: CatalogExercise) {
    const existing = this.exercises.find((x) => x.id === ex.id);
    if (existing) {
      existing.sets += 1;
    } else {
      this.exercises.push({
        id: ex.id,
        name: ex.name,
        sets: 3,
        reps: 10,
        weight: 0,
        restSec: 90,
      });
    }
    this.pickerOpen = false;
    this.expandedIndex = this.exercises.length - 1;
  }

  removeExercise(index: number) {
    this.exercises.splice(index, 1);
    if (this.expandedIndex === index) this.expandedIndex = null;
    else if (this.expandedIndex !== null && this.expandedIndex > index) this.expandedIndex--;
  }

  moveExercise(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= this.exercises.length) return;
    const [moved] = this.exercises.splice(index, 1);
    this.exercises.splice(target, 0, moved);
    this.expandedIndex = target;
  }

  toggleExpanded(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  trackByIndex(index: number): number {
    return index;
  }

  async save() {
    const trimmed = this.name.trim();
    if (!trimmed) {
      this.errorMessage = 'Ponle un nombre a la rutina.';
      return;
    }
    if (this.exercises.length === 0) {
      this.errorMessage = 'Añade al menos un ejercicio.';
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    try {
      if (this.isNew) {
        await this.gymApi.createRoutine(trimmed, this.emoji, this.exercises);
      } else {
        await this.gymApi.updateRoutine(this.routineId!, { name: trimmed, emoji: this.emoji, exercises: this.exercises });
      }
      this.router.navigateByUrl('/tabs/plan');
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'No se pudo guardar la rutina.';
    } finally {
      this.isSaving = false;
    }
  }

  goBack() {
    this.router.navigateByUrl('/tabs/plan');
  }
}
