import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { StorageService } from './storage';
// datos del login
export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  createdAt?: string;
  password?: string;
  token?: string;
}

interface AuthApiResponse {
  token: string;
  message?: string;
  user: AuthUser;
}

@Injectable({
  providedIn: 'root',
})
export class AuthApiService { // Servicio de autenticación y gestión de usuarios
  private readonly usersKey = 'lista_usuarios';
  private readonly currentUserKey = 'usuario_actual';
  private readonly loggedInKey = 'isLoggedIn';
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private readonly http: HttpClient,
    private readonly storageService: StorageService
  ) {}

  async getUsers(): Promise<AuthUser[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ users: AuthUser[] }>(`${this.apiUrl}/auth/users`)
      );

      return (response?.users ?? []).map((user) => ({
        ...user,
        createdAt: user.createdAt ?? new Date().toISOString(),
      }));
    } catch (error) {
      const users = await this.storageService.get(this.usersKey);
      return Array.isArray(users) ? users : [];
    }
  }

  async register(data: { username: string; password: string; email?: string }): Promise<AuthUser> {
    const username = this.normalizeUsername(data.username);
    const password = (data.password ?? '').trim();

    if (!username || !password) {
      throw new Error('El usuario y la contraseña son obligatorios.');
    }

    try {
      const response = await firstValueFrom(
        this.http.post<AuthApiResponse>(`${this.apiUrl}/auth/register`, {
          username,
          password,
          email: data.email?.trim() ?? '',
        })
      );

      return this.formatUser(response.user);
    } catch (error: any) {
      throw new Error(error?.error?.message || 'No se pudo registrar el usuario.');
    }
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const normalizedUsername = this.normalizeUsername(username);

    try {
      const response = await firstValueFrom(
        this.http.post<AuthApiResponse>(`${this.apiUrl}/auth/login`, {
          username: normalizedUsername,
          password,
        })
      );

      const user = this.formatUser(response.user);
      await this.persistSession(user, response.token);
      return user;
    } catch (error: any) {
      throw new Error(error?.error?.message || 'Usuario o contraseña incorrectos.');
    }
  }

  async switchUser(username: string, password: string): Promise<AuthUser> {
    const normalizedUsername = this.normalizeUsername(username);

    try {
      const response = await firstValueFrom(
        this.http.post<AuthApiResponse>(`${this.apiUrl}/auth/switch-user`, {
          username: normalizedUsername,
          password,
        })
      );

      const user = this.formatUser(response.user);
      await this.persistSession(user, response.token);
      return user;
    } catch (error: any) {
      throw new Error(error?.error?.message || 'No se pudo cambiar de usuario.');
    }
  }

  async logout(): Promise<void> {
    const currentUser = await this.getCurrentUser();
    const token = currentUser?.token;

    if (token) {
      try {
        await firstValueFrom(
          this.http.post(`${this.apiUrl}/auth/logout`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
      } catch (error) {
        console.warn('No se pudo cerrar la sesión en el backend:', error);
      }
    }

    await this.storageService.set(this.loggedInKey, false);
    await this.storageService.remove(this.currentUserKey);
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const currentUser = await this.storageService.get(this.currentUserKey);
    return currentUser ? { ...currentUser } : null;
  }

  async isAuthenticated(): Promise<boolean> {
    return Boolean(await this.storageService.get(this.loggedInKey));
  }

  private async persistSession(user: AuthUser, token: string): Promise<void> {
    await this.storageService.set(this.currentUserKey, { ...user, token });
    await this.storageService.set(this.loggedInKey, true);

    const existingUsers = await this.getUsers();
    const users = existingUsers.some((u) => u.username.toLowerCase() === user.username.toLowerCase())
      ? existingUsers
      : [...existingUsers, { ...user, password: undefined }];

    await this.storageService.set(this.usersKey, users);
  }

  private formatUser(user: AuthUser): AuthUser {
    return {
      ...user,
      username: this.normalizeUsername(user.username),
      email: user.email ?? '',
      createdAt: user.createdAt ?? new Date().toISOString(),
    };
  }

  private normalizeUsername(username: string): string {
    return (username ?? '').trim();
  }
}
