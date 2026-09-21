import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { StorageService } from '../../services/storage';

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
  
  // Mensajes de error para mostrar en la interfaz si lo deseas
  errorMessage: string = '';

  constructor(private router: Router, private storageService: StorageService) {}

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

  // 1. FUNCIÓN PARA INICIAR SESIÓN (Valida si existe y la contraseña coincide)
 async onLogin() {
    this.errorMessage = '';

    if (!this.username || !this.password) {
      alert('Por favor, completa todos los campos.');
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
        
        console.log('Inicio de sesión exitoso');

        // 💡 SOLUCIÓN: Quitamos el foco del elemento actual antes de navegar
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        this.router.navigateByUrl('/dashboard');
      } else {
        alert('Acceso denegado: Usuario o contraseña incorrectos.');
      }

    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      alert('Ocurrió un error en el sistema.');
    }
  }

  // 2. FUNCIÓN PARA REGISTRAR NUEVOS USUARIOS
 async onRegister() {
    if (!this.username || !this.password) {
      alert('Escribe un usuario y contraseña para registrarte.');
      return;
    }

    try {
      let usuariosRegistrados = (await this.storageService.get('lista_usuarios')) || [];

      // Verificar si el usuario ya existe
      const existe = usuariosRegistrados.find((u: any) => u.username === this.username);
      if (existe) {
        alert('Este usuario ya está registrado. Intenta iniciar sesión.');
        return;
      }

      // Agregar el nuevo usuario a la lista
      usuariosRegistrados.push({
        username: this.username,
        password: this.password,
        fechaCreacion: new Date().toISOString()
      });

      // Guardar la lista actualizada
      await this.storageService.set('lista_usuarios', usuariosRegistrados);
      
      // 🔍 AQUÍ AGREGAMOS ESTO PARA VERIFICAR EN LA CONSOLA
      console.log('--- USUARIOS GUARDADOS ACTUALMENTE ---', usuariosRegistrados);
      
      alert('¡Usuario registrado con éxito! Ahora puedes iniciar sesión.');
      this.password = ''; 

    } catch (error) {
      console.error('Error al registrar usuario:', error);
    }
  }
}