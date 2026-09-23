import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { Sileo } from 'sileo-angular';
import { AuthApiService } from '../../services/auth-api.service';

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
  availableUsers: any[] = [];
  sessionStatus: string = 'Sin sesión activa';

  private sileo = inject(Sileo);

  constructor(
    private router: Router,
    private authApiService: AuthApiService
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.updateSessionStatus();
  }

  ngAfterViewInit() {
    this.initBounceAnimation();
  }

  private async loadUsers() {
    try {
      this.availableUsers = await this.authApiService.getUsers();
      this.updateSessionStatus();
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  }

  updateSessionStatus() {
    if (!this.username) {
      this.sessionStatus = 'Sin sesión activa';
      return;
    }

    this.sessionStatus = `Cuenta seleccionada: ${this.username}`;
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

  async onLogin() {
    this.errorMessage = '';

    if (!this.username || !this.password) {
      this.sileo.warning({ title: 'Campos vacíos', description: 'Por favor, completa todos los campos.' });
      return;
    }

    try {
      const usuario = await this.authApiService.login(this.username, this.password);
      this.availableUsers = await this.authApiService.getUsers();
      this.password = '';
      this.sessionStatus = `Sesión activa para ${usuario.username}`;

      this.sileo.success({ title: '¡Bienvenido!', description: `Sesión iniciada para ${usuario.username}.` });

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setTimeout(() => {
        this.router.navigateByUrl('/tabs/home');
      }, 800);
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      this.sileo.error({ title: 'Acceso denegado', description: error?.message || 'Usuario o contraseña incorrectos.' });
    }
  }

  async onRegister() {
    if (!this.username || !this.password) {
      this.sileo.warning({ title: 'Atención', description: 'Escribe un usuario y contraseña para registrarte.' });
      return;
    }

    try {
      const nuevoUsuario = await this.authApiService.register({
        username: this.username,
        password: this.password,
      });

      this.availableUsers = await this.authApiService.getUsers();
      this.sessionStatus = 'Cuenta creada. Inicia sesión con tu contraseña.';
      this.sileo.success({
        title: 'Usuario registrado',
        description: `Se creó ${nuevoUsuario.username}. Ahora inicia sesión con tu contraseña.`
      });
      this.username = '';
      this.password = '';
    } catch (error: any) {
      console.error('Error al registrar usuario:', error);
      this.sileo.error({ title: 'Error', description: error?.message || 'No se pudo completar el registro.' });
    }
  }

  async onSelectUser(username: string) {
    this.username = username;
    this.password = '';
    this.updateSessionStatus();
    this.sileo.info({
      title: 'Cambio de usuario',
      description: 'Escribe la contraseña para acceder a esta cuenta.'
    });
  }
}