import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, 
  statsChartOutline, 
  barbellOutline, 
  scaleOutline, 
  checkmarkOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonContent,
    IonIcon
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePage {
  currentWeight: string = '';
  isLoading: boolean = false;
  successMessage: string = '';

  constructor() {
    addIcons({ 
      personCircleOutline, 
      statsChartOutline, 
      barbellOutline, 
      scaleOutline, 
      checkmarkOutline 
    });
  }

  onWeightInput(event: any) {
    this.currentWeight = event.target.value;
  }

  guardarPeso() {
    if (!this.currentWeight || !this.currentWeight.trim()) {
      return;
    }

    this.isLoading = true;
    this.successMessage = '';

    setTimeout(() => {
      console.log('Peso guardado:', this.currentWeight);
      this.isLoading = false;
      this.successMessage = '¡Peso registrado con éxito!';
      this.currentWeight = '';
      
      setTimeout(() => {
        this.successMessage = '';
      }, 3000);
    }, 600);
  }

  iniciarRutina() {
    console.log('Iniciando rutina de Push Day...');
  }
}