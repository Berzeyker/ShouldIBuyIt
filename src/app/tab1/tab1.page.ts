import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personCircleOutline, arrowForwardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tab1',
  templateUrl: './tab1.page.html',
  styleUrls: ['./tab1.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonContent,
    IonIcon
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Tab1Page {
  producto: string = '';
  precio: number | null = null;
  necesidad: number = 5;

  constructor() {
    // Registramos los iconos que estamos usando en el HTML
    addIcons({ personCircleOutline, arrowForwardOutline });
  }

  analizarCompra() {
    console.log('Evaluando producto:', {
      producto: this.producto,
      precio: this.precio,
      necesidad: this.necesidad
    });
  }
}