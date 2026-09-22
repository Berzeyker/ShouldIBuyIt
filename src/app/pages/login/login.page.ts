import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { StorageService } from '../../services/storage';
import { Sileo } from 'sileo-angular'; // <--- Importación correcta para Angular

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
  errorMessage: string = '';

  // Inyectamos el servicio Sileo compatible con Angular
  private sileo = inject(Sileo);

  constructor(
    private router: Router, 
    private storageService: StorageService
  ) {}

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

  // 1. INICIAR SESIÓN CON NOTIFICACIONES SILEO
  async onLogin() {
    this.errorMessage = '';

    if (!this.username || !this.password) {
      this.sileo.warning({ title: 'Campos vacíos', description: 'Por favor, completa todos los campos.' });
      return;
    }

    try {
      const usuariosRegistrados = (await this.storageService.get('lista_usuarios')) || [];

      const usuarioEncontrado = usuariosRegistrados.find(
        (u: any) => u.username === this.username && u.password === this.password
      );

      if (usuarioEncontrado) {
        await this.storageService.set('usuario_actual', usuarioEncontrado);
        await this.storageService.set('isLoggedIn', true);
        
        this.sileo.success({ title: '¡Bienvenido!', description: 'Inicio de sesión exitoso.' });

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        setTimeout(() => {
          this.router.navigateByUrl('/dashboard');
        }, 800);

      } else {
        this.sileo.error({ title: 'Acceso denegado', description: 'Usuario o contraseña incorrectos.' });
      }

    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      this.sileo.error({ title: 'Error', description: 'Ocurrió un error en el sistema.' });
    }
  }

  // 2. REGISTRAR NUEVOS USUARIOS CON NOTIFICACIONES SILEO
  async onRegister() {
    if (!this.username || !this.password) {
      this.sileo.warning({ title: 'Atención', description: 'Escribe un usuario y contraseña para registrarte.' });
      return;
    }

    try {
      let usuariosRegistrados = (await this.storageService.get('lista_usuarios')) || [];

      const existe = usuariosRegistrados.find((u: any) => u.username === this.username);
      if (existe) {
        this.sileo.info({ title: 'Usuario existente', description: 'Este usuario ya está registrado.' });
        return;
      }

      usuariosRegistrados.push({
        username: this.username,
        password: this.password,
        fechaCreacion: new Date().toISOString()
      });

      await this.storageService.set('lista_usuarios', usuariosRegistrados);
      
      this.sileo.success({ title: '¡Éxito!', description: 'Usuario registrado con éxito.' });
      this.password = ''; 

    } catch (error) {
      console.error('Error al registrar usuario:', error);
      this.sileo.error({ title: 'Error', description: 'No se pudo completar el registro.' });
    }
  }
}