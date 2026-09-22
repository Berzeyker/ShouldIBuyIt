import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { SileoToaster } from 'sileo-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, SileoToaster],
  template: `
    <ion-app>
      <!-- Cambiado a top-center para que aparezcan centradas -->
      <sileo-toaster position="top-center" theme="dark" />
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent {}