import { ChangeDetectionStrategy, Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  triangle,
  ellipse,
  square,
  homeOutline,
  calendarOutline,
  barbell,
  statsChartOutline,
  listOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);

  constructor() {
    addIcons({ triangle, ellipse, square, homeOutline, calendarOutline, barbell, statsChartOutline, listOutline });
  }
}
