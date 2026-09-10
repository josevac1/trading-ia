import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AnalysisRequest, AnalysisResponse } from '../models/analysis.model';

@Injectable({
  providedIn: 'root'
})
export class TradingService {
  private http = inject(HttpClient);
  private apiUrl = 'http://127.0.0.1:8000/api/v1';

  analyzeAsset(payload: AnalysisRequest): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(`${this.apiUrl}/analyze`, payload);
  }

  getTopPicks(category: string = 'budget'): Observable<{ status: string; category: string; picks: any[] }> {
    return this.http.get<{ status: string; category: string; picks: any[] }>(`${this.apiUrl}/top-picks?category=${category}`);
  }
}