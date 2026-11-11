import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { searchOutline, closeOutline, addCircleOutline, chevronDownOutline } from 'ionicons/icons';
import { GymApiService } from '../../services/gym-api.service';
import { CatalogExercise } from '../../services/gym.models';

@Component({
  selector: 'app-exercise-picker',
  templateUrl: './exercise-picker.component.html',
  styleUrls: ['./exercise-picker.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, IonSpinner],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ExercisePickerComponent implements OnInit {
  @Output() picked = new EventEmitter<CatalogExercise>();
  @Output() closed = new EventEmitter<void>();

  query = '';
  bodyPart = '';
  equipment = '';
  category = '';
  results: CatalogExercise[] = [];
  total = 0;
  offset = 0;
  readonly pageSize = 30;

  bodyParts: string[] = [];
  equipmentList: string[] = [];
  categories: string[] = [];

  isLoading = false;
  private searchTimer: any = null;

  constructor(private readonly gymApi: GymApiService) {
    addIcons({ searchOutline, closeOutline, addCircleOutline, chevronDownOutline });
  }

  ngOnInit() {
    this.gymApi.getCatalogMeta().subscribe((meta) => {
      this.bodyParts = meta.bodyParts;
      this.equipmentList = meta.equipment;
      this.categories = meta.categories;
    });
    this.search();
  }

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
        error: () => (this.results = []),
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

  pick(ex: CatalogExercise) {
    this.picked.emit(ex);
  }

  close() {
    this.closed.emit();
  }

  imageUrl(ex: CatalogExercise): string {
    return this.gymApi.exerciseImageUrl(ex);
  }
}
