import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiService } from './auth-api.service';
import { StorageService } from './storage';

describe('AuthApiService', () => {
  let service: AuthApiService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [AuthApiService, StorageService, provideHttpClient()],
    });

    service = TestBed.inject(AuthApiService);
    await TestBed.inject(StorageService).clear();
  });

  it('should register a user and keep the current session', async () => {
    const created = await service.register({ username: 'ana', password: '123456' });

    expect(created.username).toBe('ana');

    const session = await service.login('ana', '123456');

    expect(session.username).toBe('ana');
    expect(await service.getCurrentUser()).toEqual(expect.objectContaining({ username: 'ana' }));
  });

  it('should allow switching between registered users', async () => {
    await service.register({ username: 'juan', password: 'pw' });
    await service.register({ username: 'maria', password: 'pw2' });

    await service.login('juan', 'pw');
    const switched = await service.switchUser('maria');

    expect(switched.username).toBe('maria');
    expect((await service.getCurrentUser())?.username).toBe('maria');
  });
});
