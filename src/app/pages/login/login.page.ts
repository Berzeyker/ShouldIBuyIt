import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { Router } from '@angular/router';
import { gsap } from 'gsap';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent]
})
export class LoginPage implements OnInit, AfterViewInit {
  username: string = '';
  password: string = '';

  constructor(private router: Router) {}

  ngOnInit() {}

  ngAfterViewInit() {
    this.initBounceAnimation();
  }

  initBounceAnimation() {
    const $loginModal = document.querySelectorAll('.modal');
    gsap.fromTo(
      $loginModal, 
      { scale: 0, autoAlpha: 0 }, 
      { 
        scale: 1, 
        autoAlpha: 1, 
        duration: 1.2, 
        ease: 'elastic.out(1, 0.3)' 
      }
    );
  }

  onLogin() {
    console.log('¡BOTÓN CLICKEADO!'); // <-- Esto debe salir en tu consola sí o sí
    console.log('Usuario ingresado:', this.username);
    
    // Forzamos la navegación a la ruta de pestañas
    this.router.navigateByUrl('/dashboard');
  }
}