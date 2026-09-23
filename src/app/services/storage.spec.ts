import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
    await service.clear();
  });

  it('should be created and store a value', async () => {
    await service.set('demo', { username: 'ana' });

    expect(await service.get('demo')).toEqual({ username: 'ana' });
  });
});
