import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradingService } from './services/trading.service';
import { AnalysisRequest, AnalysisResponse } from './models/analysis.model';

declare const TradingView: any;

export interface MarketStatus {
  isOpen: boolean;
  label: string;
  detail: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy, AfterViewInit {
  private tradingService = inject(TradingService);
  private cdr = inject(ChangeDetectorRef);

  markets = [
    { label: 'Forex', value: 'forex' },
    { label: 'Commodities (Oro, Petróleo)', value: 'commodities' },
    { label: 'Criptomonedas', value: 'crypto' },
    { label: 'Índices Bursátiles', value: 'indices' },
    { label: 'Acciones Wall Street', value: 'stocks' }
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
    ],
    stocks: [
      { label: 'SOFI - SoFi Tech', value: 'SOFI', tvSymbol: 'NASDAQ:SOFI' },
      { label: 'DAL - Delta Air Lines', value: 'DAL', tvSymbol: 'NYSE:DAL' },
      { label: 'UBER - Uber Tech', value: 'UBER', tvSymbol: 'NYSE:UBER' },
      { label: 'PLTR - Palantir', value: 'PLTR', tvSymbol: 'NASDAQ:PLTR' },
      { label: 'INTC - Intel', value: 'INTC', tvSymbol: 'NASDAQ:INTC' },
      { label: 'RIVN - Rivian', value: 'RIVN', tvSymbol: 'NASDAQ:RIVN' },
      { label: 'META - Meta Platforms', value: 'META', tvSymbol: 'NASDAQ:META' },
      { label: 'AMZN - Amazon', value: 'AMZN', tvSymbol: 'NASDAQ:AMZN' },
      { label: 'MSFT - Microsoft', value: 'MSFT', tvSymbol: 'NASDAQ:MSFT' },
      { label: 'NVDA - NVIDIA', value: 'NVDA', tvSymbol: 'NASDAQ:NVDA' },
      { label: 'AAPL - Apple', value: 'AAPL', tvSymbol: 'NASDAQ:AAPL' },
      { label: 'TSLA - Tesla', value: 'TSLA', tvSymbol: 'NASDAQ:TSLA' }
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

  // Datos financieros del usuario
  userMonthlySalary: number = 800; // Sueldo mensual en USD
  accountCapital: number = 500;    // Capital disponible en cuenta de trading
  riskPercentage: number = 2;      // Porcentaje de riesgo por operación (1% - 5%)

  currentMarketStatus: MarketStatus = { isOpen: true, label: 'MERCADO ABIERTO', detail: 'Activo' };
  stocksMarketStatus: MarketStatus = { isOpen: true, label: 'MERCADO ABIERTO', detail: 'Sesión regular' };

  picksCache: Record<string, any[]> = {};

  private refreshInterval: any = null;
  private statusInterval: any = null;

  ngOnInit() {
    this.updateMarketStatuses();
    this.loadTopPicks();

    this.statusInterval = setInterval(() => {
      this.updateMarketStatuses();
    }, 15000);

    this.refreshInterval = setInterval(() => {
      this.loadTopPicks(true);
    }, 120000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.statusInterval) clearInterval(this.statusInterval);
  }

  ngAfterViewInit() {
    this.renderTradingViewChart();
  }

  // Dinero arriesgado por operación según el capital de cuenta
  getRiskAmount(): number {
    return (this.accountCapital * this.riskPercentage) / 100;
  }

  // Porcentaje del sueldo que representaría perder este trade
  getRiskVsSalaryPercentage(): string {
    if (!this.userMonthlySalary || this.userMonthlySalary <= 0) return '0.0';
    const risk = this.getRiskAmount();
    return ((risk / this.userMonthlySalary) * 100).toFixed(1);
  }

  // Límite seguro mensual recomendado (no arriesgar más del 10% del sueldo en pérdidas totales)
  getMaxMonthlyLossAllowed(): number {
    return (this.userMonthlySalary * 0.10);
  }

  calculatePositionSize(scenario: 'buy' | 'sell'): { shares: number; totalCost: number; actualRisk: number; actualProfit: number } {
    if (!this.result?.risk) {
      return { shares: 0, totalCost: 0, actualRisk: 0, actualProfit: 0 };
    }

    const entry = scenario === 'buy' 
      ? (this.result.risk.buy_scenario?.entry_price || this.result.current_price)
      : (this.result.risk.sell_scenario?.entry_price || this.result.current_price);

    const sl = scenario === 'buy'
      ? this.result.risk.buy_scenario?.stop_loss
      : this.result.risk.sell_scenario?.stop_loss;

    const tp = scenario === 'buy'
      ? this.result.risk.buy_scenario?.take_profit
      : this.result.risk.sell_scenario?.take_profit;

    if (!sl || !tp || entry === sl) {
      return { shares: 0, totalCost: 0, actualRisk: 0, actualProfit: 0 };
    }

    const slDistance = Math.abs(entry - sl);
    const tpDistance = Math.abs(tp - entry);
    const targetRisk = this.getRiskAmount();

    let shares = Math.floor(targetRisk / slDistance);
    if (shares < 1) shares = 1;

    const totalCost = Number((shares * entry).toFixed(2));
    const actualRisk = Number((shares * slDistance).toFixed(2));
    const actualProfit = Number((shares * tpDistance).toFixed(2));

    return { shares, totalCost, actualRisk, actualProfit };
  }

  selectStockFromRadar(stock: any) {
    this.selectedMarket = 'stocks';
    this.selectedSymbol = stock.symbol;
    this.selectedTimeframe = 'W';
    this.updateMarketStatuses();
    this.renderTradingViewChart();
    this.runAnalysis();

    const chartElement = document.getElementById('tv_chart_container');
    if (chartElement) {
      chartElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  getMarketStatus(marketType: string): MarketStatus {
    const now = new Date();
    const nyTimeString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyDate = new Date(nyTimeString);
    const day = nyDate.getDay();
    const hour = nyDate.getHours();
    const minute = nyDate.getMinutes();
    const totalMinutes = hour * 60 + minute;

    if (marketType === 'crypto') {
      return { isOpen: true, label: '24/7 ABIERTO', detail: 'Mercado continuo' };
    }

    if (marketType === 'stocks' || marketType === 'indices') {
      const isWeekday = day >= 1 && day <= 5;
      const isOpen = isWeekday && totalMinutes >= (9 * 60 + 30) && totalMinutes < (16 * 60);
      return {
        isOpen,
        label: isOpen ? 'MERCADO ABIERTO' : 'MERCADO CERRADO',
        detail: isOpen ? '09:30 - 16:00 ET' : 'Abre 09:30 ET (L-V)'
      };
    }

    if (marketType === 'forex') {
      let isOpen = false;
      if (day === 0 && totalMinutes >= 17 * 60) isOpen = true;
      else if (day >= 1 && day <= 4) isOpen = true;
      else if (day === 5 && totalMinutes < 17 * 60) isOpen = true;

      return {
        isOpen,
        label: isOpen ? 'FOREX ABIERTO' : 'FOREX CERRADO',
        detail: isOpen ? 'Sesión activa' : 'Abre Domingo 17:00 ET'
      };
    }

    if (marketType === 'commodities') {
      let isOpen = false;
      const isWeekdayBreak = (day >= 1 && day <= 4) && (totalMinutes >= 17 * 60 && totalMinutes < 18 * 60);
      
      if (day === 0 && totalMinutes >= 18 * 60) isOpen = true;
      else if (day >= 1 && day <= 4 && !isWeekdayBreak) isOpen = true;
      else if (day === 5 && totalMinutes < 17 * 60) isOpen = true;

      return {
        isOpen,
        label: isOpen ? 'MERCADO ABIERTO' : 'MERCADO CERRADO',
        detail: isOpen ? 'Metales activos' : 'Pausa / Cierre de fin de semana'
      };
    }

    return { isOpen: true, label: 'ACTIVO', detail: '' };
  }

  updateMarketStatuses() {
    this.currentMarketStatus = this.getMarketStatus(this.selectedMarket);
    this.stocksMarketStatus = this.getMarketStatus('stocks');
    this.cdr.detectChanges();
  }

  setStockCategory(category: 'budget' | 'megacaps') {
    if (this.selectedStockCategory === category) return;
    this.selectedStockCategory = category;

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

    this.tradingService.getTopPicks(this.selectedStockCategory, forceRefresh).subscribe({
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
    this.updateMarketStatuses();
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