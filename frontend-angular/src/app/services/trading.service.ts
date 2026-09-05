import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AnalysisRequest, AnalysisResponse } from '../models/analysis.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TradingService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/analyze`;

  analyzeAsset(payload: AnalysisRequest): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(this.apiUrl, payload);
  }
}