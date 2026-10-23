import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExercisesPage } from './exercises.page';
import { ExercisesApiService } from '../services/exercises-api.service';

describe('ExercisesPage', () => {
  let component: ExercisesPage;
  let fixture: ComponentFixture<ExercisesPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ExercisesPage],
      providers: [{
        provide: ExercisesApiService,
        useValue: { getExercises: () => of({ exercises: [] }) },
      }],
    });
    fixture = TestBed.createComponent(ExercisesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
