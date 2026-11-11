import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { SileoToaster } from 'sileo-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, SileoToaster],
  // Angular 22: los componentes son OnPush por defecto; Eager restaura la
  // detección de cambios clásica que necesita este codebase (campos mutados en callbacks).
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <ion-app>
      <!-- Cambiado a top-center para que aparezcan centradas -->
      <sileo-toaster position="top-center" theme="dark" />
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent {}