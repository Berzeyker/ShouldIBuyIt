import { Component, OnInit, AfterViewInit, inject, ChangeDetectionStrategy } from '@angular/core';
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
  imports: [CommonModule, FormsModule, IonContent],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LoginPage implements OnInit, AfterViewInit {
  username: string = '';
  password: string = '';
  errorMessage: string = '';
  availableUsers: any[] = [];
  sessionStatus: string = 'No active session';

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
      console.error('Error loading users:', error);
    }
  }

  updateSessionStatus() {
    if (!this.username) {
      this.sessionStatus = 'No active session';
      return;
    }

    this.sessionStatus = `Selected account: ${this.username}`;
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
      this.sileo.warning({ title: 'Empty fields', description: 'Please fill in all fields.' });
      return;
    }

    try {
      const usuario = await this.authApiService.login(this.username, this.password);
      this.availableUsers = await this.authApiService.getUsers();
      this.password = '';
      this.sessionStatus = `Active session for ${usuario.username}`;

      this.sileo.success({ title: 'Welcome!', description: `Signed in as ${usuario.username}.` });

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setTimeout(() => {
        this.router.navigateByUrl('/tabs/home');
      }, 800);
    } catch (error: any) {
      console.error('Error signing in:', error);
      this.sileo.error({ title: 'Access denied', description: error?.message || 'Incorrect username or password.' });
    }
  }

  async onRegister() {
    if (!this.username || !this.password) {
      this.sileo.warning({ title: 'Heads up', description: 'Enter a username and password to sign up.' });
      return;
    }

    try {
      const nuevoUsuario = await this.authApiService.register({
        username: this.username,
        password: this.password,
      });

      this.availableUsers = await this.authApiService.getUsers();
      this.sessionStatus = 'Account created. Sign in with your password.';
      this.sileo.success({
        title: 'User registered',
        description: `${nuevoUsuario.username} was created. Now sign in with your password.`
      });
      this.username = '';
      this.password = '';
    } catch (error: any) {
      console.error('Error registering user:', error);
      this.sileo.error({ title: 'Error', description: error?.message || 'Could not complete the registration.' });
    }
  }

  async onSelectUser(username: string) {
    this.username = username;
    this.password = '';
    this.updateSessionStatus();
    this.sileo.info({
      title: 'Switching user',
      description: 'Enter the password to access this account.'
    });
  }
}