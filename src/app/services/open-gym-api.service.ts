import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppState } from '../app-state.model';

@Injectable({
  providedIn: 'root'
})
export class OpenGymApiService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  // Pull del estado completo (GET /api/data)
  getState(): Observable<{ state: AppState | null; rev: number }> {
    return this.http.get<{ state: AppState | null; rev: number }>(`${this.baseUrl}/data`, { withCredentials: true });
  }

  // Push del estado con control de concurrencia baseRev (PUT /api/data)
  saveState(state: AppState, baseRev: number | null): Observable<any> {
    return this.http.put(`${this.baseUrl}/data`, { state, baseRev }, { withCredentials: true });
  }

  // Heartbeat de entrenamiento en vivo (POST /api/activity)
  sendActivityHeartbeat(activityData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/activity`, activityData, { withCredentials: true });
  }
}