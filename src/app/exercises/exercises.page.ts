import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular';
import { finalize } from 'rxjs';
import {
  Exercise,
  ExerciseInput,
  ExercisesApiService,
} from '../services/exercises-api.service';

function emptyExercise(): ExerciseInput {
  return { name: '', muscleGroup: '', equipment: '', notes: '' };
}

@Component({
  selector: 'app-exercises',
  templateUrl: './exercises.page.html',
  styleUrls: ['./exercises.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonSpinner, FormsModule],
})
export class ExercisesPage implements OnInit {
  private readonly exercisesApi = inject(ExercisesApiService);

  exercises: Exercise[] = [];
  form: ExerciseInput = emptyExercise();
  editingExercise: Exercise | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadExercises();
  }

  loadExercises(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.exercisesApi.getExercises()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ exercises }) => this.exercises = exercises,
        error: (error: unknown) => this.showError(error, 'No se pudieron cargar los ejercicios.'),
      });
  }

  saveExercise(): void {
    if (!this.form.name.trim()) {
      this.errorMessage = 'Escribe el nombre del ejercicio.';
      this.successMessage = '';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;

    const request = this.editingExercise
      ? this.exercisesApi.replaceExercise(this.editingExercise.id, this.normalizedForm())
      : this.exercisesApi.createExercise(this.normalizedForm());

    request.pipe(finalize(() => this.isLoading = false)).subscribe({
      next: ({ exercise, message }) => {
        this.exercises = this.editingExercise
          ? this.exercises.map((item) => item.id === exercise.id ? exercise : item)
          : [exercise, ...this.exercises];
        this.successMessage = message;
        this.resetForm();
      },
      error: (error: unknown) => this.showError(error, 'No se pudo guardar el ejercicio.'),
    });
  }

  patchExercise(): void {
    if (!this.editingExercise) return;

    const changes: Partial<ExerciseInput> = {};
    const current = this.normalizedForm();
    for (const field of Object.keys(current) as (keyof ExerciseInput)[]) {
      if (current[field] !== this.editingExercise[field]) {
        changes[field] = current[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      this.errorMessage = 'Cambia al menos un campo para aplicar una actualización parcial.';
      this.successMessage = '';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;
    this.exercisesApi.updateExercise(this.editingExercise.id, changes)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ exercise, message }) => {
          this.exercises = this.exercises.map((item) => item.id === exercise.id ? exercise : item);
          this.successMessage = message;
          this.resetForm();
        },
        error: (error: unknown) => this.showError(error, 'No se pudo actualizar el ejercicio.'),
      });
  }

  editExercise(exercise: Exercise): void {
    this.editingExercise = exercise;
    this.form = {
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      notes: exercise.notes,
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  deleteExercise(exercise: Exercise): void {
    if (!window.confirm(`¿Eliminar "${exercise.name}"?`)) return;

    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;
    this.exercisesApi.deleteExercise(exercise.id)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ message }) => {
          this.exercises = this.exercises.filter((item) => item.id !== exercise.id);
          this.successMessage = message;
          if (this.editingExercise?.id === exercise.id) this.resetForm();
        },
        error: (error: unknown) => this.showError(error, 'No se pudo eliminar el ejercicio.'),
      });
  }

  resetForm(): void {
    this.form = emptyExercise();
    this.editingExercise = null;
  }

  private normalizedForm(): ExerciseInput {
    return {
      name: this.form.name.trim(),
      muscleGroup: this.form.muscleGroup.trim(),
      equipment: this.form.equipment.trim(),
      notes: this.form.notes.trim(),
    };
  }

  private showError(error: unknown, fallback: string): void {
    this.successMessage = '';
    if (error instanceof HttpErrorResponse) {
      this.errorMessage = error.error?.message
        ?? (error.status === 0 ? 'No se pudo conectar con la API.' : fallback);
      return;
    }
    this.errorMessage = fallback;
  }
}
