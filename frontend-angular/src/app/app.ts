import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradingService } from './services/trading.service';
import { AnalysisRequest, AnalysisResponse } from './models/analysis.model';

declare const TradingView: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, AfterViewInit {
  private tradingService = inject(TradingService);
  private cdr = inject(ChangeDetectorRef);

  markets = [
    { label: 'Forex', value: 'forex' },
    { label: 'Commodities (Oro, Petróleo)', value: 'commodities' },
    { label: 'Criptomonedas', value: 'crypto' },
    { label: 'Índices Bursátiles', value: 'indices' }
  ];

  symbols: Record<string, { label: string; value: string; tvSymbol: string }[]> = {
    forex: [
      { label: 'EUR/USD', value: 'EURUSD', tvSymbol: 'FX:EURUSD' },
      { label: 'GBP/USD', value: 'GBPUSD', tvSymbol: 'FX:GBPUSD' },
      { label: 'USD/JPY', value: 'USDJPY', tvSymbol: 'FX:USDJPY' }
    ],
    commodities: [
      { label: 'GOLD (XAU/USD)', value: 'GOLD', tvSymbol: 'OANDA:XAUUSD' },
      { label: 'OIL WTI (USOIL)', value: 'OIL_WTI', tvSymbol: 'TVC:USOIL' }
    ],
    crypto: [
      { label: 'BTC/USD', value: 'BTCUSD', tvSymbol: 'BINANCE:BTCUSDT' },
      { label: 'ETH/USD', value: 'ETHUSD', tvSymbol: 'BINANCE:ETHUSDT' }
    ],
    indices: [
      { label: 'S&P 500', value: 'SP500', tvSymbol: 'FOREXCOM:SPXUSD' },
      { label: 'NASDAQ 100', value: 'NASDAQ', tvSymbol: 'FOREXCOM:NSXUSD' }
    ]
  };

  selectedMarket = 'commodities';
  selectedSymbol = 'GOLD';
  selectedTimeframe = '15';

  selectedStockCategory: 'budget' | 'megacaps' = 'budget';
  loading = false;
  loadingPicks = false;
  errorMessage = '';
  result: AnalysisResponse | null = null;
  copiedField: string | null = null;
  topPicks: any[] = [];

  // Memoria caché local en el frontend
  picksCache: Record<string, any[]> = {};

  ngOnInit() {
    this.loadTopPicks();
  }

  ngAfterViewInit() {
    this.renderTradingViewChart();
  }

  setStockCategory(category: 'budget' | 'megacaps') {
    if (this.selectedStockCategory === category) return;
    this.selectedStockCategory = category;

    // Si ya existe en la memoria del navegador, el cambio es a 0ms (instantáneo)
    if (this.picksCache[category]) {
      this.topPicks = this.picksCache[category];
      this.cdr.detectChanges();
      return;
    }

    this.loadTopPicks();
  }

  loadTopPicks(forceRefresh = false) {
    this.loadingPicks = true;
    this.cdr.detectChanges();

    if (forceRefresh) {
      delete this.picksCache[this.selectedStockCategory];
    }

    this.tradingService.getTopPicks(this.selectedStockCategory).subscribe({
      next: (res) => {
        this.topPicks = res.picks || [];
        this.picksCache[this.selectedStockCategory] = this.topPicks;
        this.loadingPicks = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingPicks = false;
        this.cdr.detectChanges();
      }
    });
  }

  onMarketChange() {
    this.selectedSymbol = this.symbols[this.selectedMarket][0].value;
    this.renderTradingViewChart();
  }

  onSymbolChange() {
    this.renderTradingViewChart();
  }

  getCurrentTvSymbol(): string {
    const asset = this.symbols[this.selectedMarket]?.find(s => s.value === this.selectedSymbol);
    return asset ? asset.tvSymbol : 'OANDA:XAUUSD';
  }

  renderTradingViewChart() {
    setTimeout(() => {
      const container = document.getElementById('tv_chart_container');
      if (!container) return;

      container.innerHTML = '';

      if (typeof TradingView !== 'undefined') {
        new TradingView.widget({
          autosize: true,
          symbol: this.getCurrentTvSymbol(),
          interval: this.selectedTimeframe,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'es',
          toolbar_bg: '#090d16',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: 'tv_chart_container'
        });
      }
    }, 150);
  }

  copyToClipboard(text: string | number | null, field: string) {
    if (text === null || text === undefined) return;
    navigator.clipboard.writeText(text.toString());
    this.copiedField = field;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.copiedField = null;
      this.cdr.detectChanges();
    }, 2000);
  }

  runAnalysis() {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const payload: AnalysisRequest = {
      market: this.selectedMarket,
      symbol: this.selectedSymbol,
      timeframe: '1d',
      period: '1y'
    };

    this.tradingService.analyzeAsset(payload).subscribe({
      next: (data) => {
        this.result = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error de conexión con el motor de Python';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}