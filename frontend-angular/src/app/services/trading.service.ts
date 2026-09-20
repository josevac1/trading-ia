import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AnalysisRequest, AnalysisResponse } from '../models/analysis.model';

@Injectable({
  providedIn: 'root'
})
export class TradingService {
  private http = inject(HttpClient);
  private apiUrl = 'https://trading-backend-api-iruz.onrender.com';

  analyzeAsset(payload: AnalysisRequest): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(`${this.apiUrl}/analyze`, payload);
  }

  getTopPicks(category: string = 'budget', force: boolean = false): Observable<{ status: string; category: string; cached: boolean; picks: any[] }> {
    return this.http.get<{ status: string; category: string; cached: boolean; picks: any[] }>(
      `${this.apiUrl}/top-picks?category=${category}&force=${force}`
    );
  }
}