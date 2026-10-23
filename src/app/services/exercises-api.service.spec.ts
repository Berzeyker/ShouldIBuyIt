import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Exercise, ExerciseInput, ExercisesApiService } from './exercises-api.service';

describe('ExercisesApiService', () => {
  let service: ExercisesApiService;
  let httpTesting: HttpTestingController;
  const input: ExerciseInput = {
    name: 'Press de banca',
    muscleGroup: 'Pecho',
    equipment: 'Barra',
    notes: '4 series',
  };
  const exercise: Exercise = {
    id: '3f153a28-87b5-4f09-b9f1-a9adf7c8d651',
    ...input,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const endpoint = `${environment.apiUrl}/exercises`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExercisesApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads exercises with GET', () => {
    service.getExercises().subscribe((response) => {
      expect(response.exercises).toEqual([exercise]);
    });

    const request = httpTesting.expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    request.flush({ exercises: [exercise] });
  });

  it('creates exercises with POST', () => {
    service.createExercise(input).subscribe((response) => {
      expect(response.exercise).toEqual(exercise);
    });

    const request = httpTesting.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ message: 'Creado', exercise });
  });

  it('replaces exercises with PUT', () => {
    service.replaceExercise(exercise.id, input).subscribe();

    const request = httpTesting.expectOne(`${endpoint}/${exercise.id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(input);
    request.flush({ message: 'Actualizado', exercise });
  });

  it('updates only the provided exercise fields with PATCH', () => {
    const changes = { notes: '3 series' };
    service.updateExercise(exercise.id, changes).subscribe();

    const request = httpTesting.expectOne(`${endpoint}/${exercise.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(changes);
    request.flush({ message: 'Actualizado', exercise });
  });

  it('deletes exercises with DELETE', () => {
    service.deleteExercise(exercise.id).subscribe((response) => {
      expect(response.id).toBe(exercise.id);
    });

    const request = httpTesting.expectOne(`${endpoint}/${exercise.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ id: exercise.id, message: 'Eliminado' });
  });
});
