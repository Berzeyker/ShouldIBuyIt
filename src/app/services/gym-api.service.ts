import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StorageService } from './storage';
import {
  BodyweightEntry,
  CatalogExercise,
  CatalogMeta,
  ExerciseStats,
  HomePayload,
  Routine,
  RoutineExercise,
  StatsSummary,
  Workout,
} from './gym.models';

@Injectable({ providedIn: 'root' })
export class GymApiService {
  private readonly api = environment.apiUrl;
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);

  /** Base pública de media (imágenes/clips del catálogo). */
  readonly mediaBase = environment.apiUrl.replace(/\/api\/?$/, '');

  private async authHeaders(): Promise<HttpHeaders> {
    const user = await this.storage.get('usuario_actual');
    const token = user?.token;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders({});
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.api}${path}`, body, { headers: await this.authHeaders() }));
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.api}${path}`, body, { headers: await this.authHeaders() }));
  }

  private async get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.api}${path}`, { headers: await this.authHeaders() }));
  }

  private async delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.api}${path}`, { headers: await this.authHeaders() }));
  }

  // -- Catálogo ------------------------------------------------------------

  getCatalogMeta(): Observable<CatalogMeta> {
    return this.http.get<CatalogMeta>(`${this.api}/catalog/meta`);
  }

  searchCatalog(params: {
    q?: string;
    bp?: string;
    eq?: string;
    cat?: string;
    limit?: number;
    offset?: number;
  }): Observable<{ total: number; exercises: CatalogExercise[] }> {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return this.http.get<{ total: number; exercises: CatalogExercise[] }>(`${this.api}/catalog/search?${query}`);
  }

  getCatalogExercise(id: string): Observable<{ exercise: CatalogExercise }> {
    return this.http.get<{ exercise: CatalogExercise }>(`${this.api}/catalog/${id}`);
  }

  exerciseImageUrl(ex: { img?: string; id: string }): string {
    return `${this.mediaBase}/ex/still/${ex.img || `${ex.id}.webp`}`;
  }

  exerciseClipUrl(ex: { gif?: string; id: string }): string {
    return `${this.mediaBase}/ex/clip/${ex.gif || `${ex.id}.mp4`}`;
  }

  // -- Portada -------------------------------------------------------------

  getHome(): Promise<HomePayload> {
    return this.get<HomePayload>('/home');
  }

  // -- Rutinas -------------------------------------------------------------

  getRoutines(): Promise<{ routines: Routine[]; week: Record<string, string[]> }> {
    return this.get<{ routines: Routine[]; week: Record<string, string[]> }>('/routines');
  }

  createRoutine(name: string, emoji: string, exercises: RoutineExercise[]): Promise<{ routine: Routine }> {
    return this.post<{ routine: Routine }>('/routines', { name, emoji, exercises });
  }

  updateRoutine(id: string, changes: { name?: string; emoji?: string; exercises?: RoutineExercise[] }): Promise<{ routine: Routine }> {
    return this.put<{ routine: Routine }>(`/routines/${id}`, changes);
  }

  deleteRoutine(id: string): Promise<{ id: string }> {
    return this.delete<{ id: string }>(`/routines/${id}`);
  }

  // -- Semana --------------------------------------------------------------

  getWeek(): Promise<{ week: Record<string, string[]>; dayNames: Record<string, string> }> {
    return this.get<{ week: Record<string, string[]>; dayNames: Record<string, string> }>('/week');
  }

  saveWeek(week: Record<string, string[]>): Promise<{ week: Record<string, string[]> }> {
    return this.put<{ week: Record<string, string[]> }>('/week', { week });
  }

  loadStarterPlan(plan: 'ppl' | 'upper-lower' | 'full-body' | '5x5'): Promise<{ routines: Routine[] }> {
    return this.post<{ routines: Routine[] }>('/week/starter', { plan });
  }

  // -- Entrenamientos --------------------------------------------------------

  getActiveWorkout(): Promise<{ workout: Workout | null }> {
    return this.get<{ workout: Workout | null }>('/workouts/active');
  }

  getWorkoutHistory(limit = 25, offset = 0): Promise<{ workouts: Workout[]; total: number }> {
    return this.get<{ workouts: Workout[]; total: number }>(`/workouts?limit=${limit}&offset=${offset}`);
  }

  startWorkout(routineId: string | null, name?: string): Promise<{ workout: Workout }> {
    return this.post<{ workout: Workout }>('/workouts', { routineId, name });
  }

  saveWorkout(id: string, changes: { name?: string; notes?: string; entries?: Workout['entries'] }): Promise<{ workout: Workout }> {
    return this.put<{ workout: Workout }>(`/workouts/${id}`, changes);
  }

  finishWorkout(id: string, entries?: Workout['entries']): Promise<{ workout: Workout }> {
    return this.post<{ workout: Workout }>(`/workouts/${id}/finish`, { entries });
  }

  deleteWorkout(id: string): Promise<{ id: string }> {
    return this.delete<{ id: string }>(`/workouts/${id}`);
  }

  getExerciseStats(exId: string): Promise<ExerciseStats> {
    return this.get<ExerciseStats>(`/stats/exercise/${exId}`);
  }

  // -- Peso corporal --------------------------------------------------------

  private localDayStr(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  getBodyweight(limit = 90): Promise<{ entries: BodyweightEntry[] }> {
    return this.get<{ entries: BodyweightEntry[] }>(`/bodyweight?limit=${limit}`);
  }

  saveBodyweight(weight: number, weighedOn?: string): Promise<{ entry: BodyweightEntry }> {
    return this.post<{ entry: BodyweightEntry }>('/bodyweight', { weight, weighedOn: weighedOn || this.localDayStr() });
  }

  deleteBodyweight(id: string): Promise<{ id: string }> {
    return this.delete<{ id: string }>(`/bodyweight/${id}`);
  }

  // -- Estadísticas -----------------------------------------------------------

  getStatsSummary(): Promise<{ summary: StatsSummary; recentWorkouts: Workout[] }> {
    return this.get<{ summary: StatsSummary; recentWorkouts: Workout[] }>('/stats/summary');
  }
}
