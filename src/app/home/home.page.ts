import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, 
  statsChartOutline, 
  barbellOutline, 
  scaleOutline, 
  checkmarkOutline,
  logOutOutline
} from 'ionicons/icons';
import { AuthApiService } from '../services/auth-api.service';

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
  currentUser: string = 'Usuario';

  constructor(
    private readonly authApiService: AuthApiService,
    private readonly router: Router
  ) {
    addIcons({ 
      personCircleOutline,
      statsChartOutline,
      barbellOutline,
      scaleOutline,
      checkmarkOutline,
      logOutOutline
    });
  }

  async ngOnInit() {
    const user = await this.authApiService.getCurrentUser();
    this.currentUser = user?.username || 'Usuario';
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

  async cambiarUsuario() {
    await this.authApiService.logout();
    this.router.navigateByUrl('/login');
  }
}