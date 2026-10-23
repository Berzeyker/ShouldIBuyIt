import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseInput {
  name: string;
  muscleGroup: string;
  equipment: string;
  notes: string;
}

interface ExerciseListResponse {
  exercises: Exercise[];
}

export interface ExerciseMutationResponse {
  message: string;
  exercise: Exercise;
}

export interface ExerciseDeleteResponse {
  id: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ExercisesApiService {
  private readonly endpoint = `${environment.apiUrl}/exercises`;
  private readonly http = inject(HttpClient);

  getExercises(): Observable<ExerciseListResponse> {
    return this.http.get<ExerciseListResponse>(this.endpoint);
  }

  createExercise(exercise: ExerciseInput): Observable<ExerciseMutationResponse> {
    return this.http.post<ExerciseMutationResponse>(this.endpoint, exercise);
  }

  replaceExercise(id: string, exercise: ExerciseInput): Observable<ExerciseMutationResponse> {
    return this.http.put<ExerciseMutationResponse>(`${this.endpoint}/${id}`, exercise);
  }

  updateExercise(id: string, changes: Partial<ExerciseInput>): Observable<ExerciseMutationResponse> {
    return this.http.patch<ExerciseMutationResponse>(`${this.endpoint}/${id}`, changes);
  }

  deleteExercise(id: string): Observable<ExerciseDeleteResponse> {
    return this.http.delete<ExerciseDeleteResponse>(`${this.endpoint}/${id}`);
  }
}
