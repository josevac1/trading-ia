import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradingService } from './services/trading.service';
import { AnalysisRequest, AnalysisResponse } from './models/analysis.model';

declare const TradingView: any;

export interface MarketScheduleInfo {
  name: string;
  isOpen: boolean;
  statusLabel: string;
  countdownText: string;
  tradingHours: string;
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
    { label: 'Commodities (Oro, Petróleo)', value: 'commodities' },
    { label: 'Acciones Wall Street', value: 'stocks' },
    { label: 'Forex', value: 'forex' },
    { label: 'Criptomonedas', value: 'crypto' },
    { label: 'Índices Bursátiles', value: 'indices' }
  ];

  symbols: Record<string, { label: string; value: string; tvSymbol: string }[]> = {
    commodities: [
      { label: 'GOLD (XAU/USD)', value: 'GOLD', tvSymbol: 'OANDA:XAUUSD' },
      { label: 'OIL WTI (USOIL)', value: 'OIL_WTI', tvSymbol: 'TVC:USOIL' }
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
    ],
    forex: [
      { label: 'EUR/USD', value: 'EURUSD', tvSymbol: 'FX:EURUSD' },
      { label: 'GBP/USD', value: 'GBPUSD', tvSymbol: 'FX:GBPUSD' },
      { label: 'USD/JPY', value: 'USDJPY', tvSymbol: 'FX:USDJPY' }
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

  userMonthlySalary: number = 526;
  accountCapital: number = 373.26;
  riskPercentage: number = 2;

  currentLocalTime = '';
  currentNyTime = '';
  marketSchedules: MarketScheduleInfo[] = [];

  picksCache: Record<string, any[]> = {};

  private clockInterval: any = null;
  private refreshInterval: any = null;

  ngOnInit() {
    this.updateClockAndSchedules();
    this.loadTopPicks();
    this.runAnalysis();

    this.clockInterval = setInterval(() => {
      this.updateClockAndSchedules();
    }, 1000);

    this.refreshInterval = setInterval(() => {
      if (!document.hidden) {
        this.loadTopPicks(true);
      }
    }, 120000);
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  ngAfterViewInit() {
    this.renderTradingViewChart();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (!document.hidden) {
      const container = document.getElementById('tv_chart_container');
      if (!container || container.children.length === 0 || !container.querySelector('iframe')) {
        this.renderTradingViewChart();
      }
    }
  }

  onCapitalChange() {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  onTimeframeChange() {
    this.renderTradingViewChart();
    this.runAnalysis();
  }

  updateClockAndSchedules() {
    const now = new Date();
    this.currentLocalTime = now.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const nyString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyDate = new Date(nyString);
    this.currentNyTime = nyDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    const day = nyDate.getDay();
    const hours = nyDate.getHours();
    const minutes = nyDate.getMinutes();
    const seconds = nyDate.getSeconds();
    const totalSecsToday = hours * 3600 + minutes * 60 + seconds;

    const stocksOpenSec = 9 * 3600 + 30 * 60;
    const stocksCloseSec = 16 * 3600;
    let stocksIsOpen = false;
    let stocksCountdown = '';

    if (day >= 1 && day <= 5) {
      if (totalSecsToday >= stocksOpenSec && totalSecsToday < stocksCloseSec) {
        stocksIsOpen = true;
        stocksCountdown = `Cierra en ${this.formatDuration(stocksCloseSec - totalSecsToday)}`;
      } else if (totalSecsToday < stocksOpenSec) {
        stocksCountdown = `Abre hoy en ${this.formatDuration(stocksOpenSec - totalSecsToday)}`;
      } else {
        stocksCountdown = day === 5 ? 'Abre el Lunes 09:30 ET' : `Abre mañana en ${this.formatDuration((24 * 3600 - totalSecsToday) + stocksOpenSec)}`;
      }
    } else {
      stocksCountdown = 'Cerrado fin de semana (Abre Lunes 09:30 ET)';
    }

    let commIsOpen = false;
    let commCountdown = '';
    const isWeekdayPause = (day >= 1 && day <= 4) && (hours === 17);

    if (day === 0) {
      if (hours >= 18) {
        commIsOpen = true;
        commCountdown = 'Sesión semanal abierta';
      } else {
        commCountdown = `Abre hoy en ${this.formatDuration((18 * 3600) - totalSecsToday)}`;
      }
    } else if (day >= 1 && day <= 4) {
      if (isWeekdayPause) {
        commCountdown = `Reanuda en ${this.formatDuration(3600 - (minutes * 60 + seconds))}`;
      } else {
        commIsOpen = true;
        commCountdown = hours < 17 ? `Pausa diaria en ${this.formatDuration((17 * 3600) - totalSecsToday)}` : 'Sesión nocturna abierta';
      }
    } else if (day === 5) {
      if (totalSecsToday < 17 * 3600) {
        commIsOpen = true;
        commCountdown = `Cierre semanal en ${this.formatDuration((17 * 3600) - totalSecsToday)}`;
      } else {
        commCountdown = 'Cerrado (Abre Domingo 18:00 ET)';
      }
    } else {
      commCountdown = 'Cerrado (Abre Domingo 18:00 ET)';
    }

    let fxIsOpen = false;
    let fxCountdown = '';
    if (day === 0 && totalSecsToday >= 17 * 3600) {
      fxIsOpen = true;
      fxCountdown = 'Sesión semanal activa';
    } else if (day >= 1 && day <= 4) {
      fxIsOpen = true;
      fxCountdown = 'Mercado 24h activo';
    } else if (day === 5 && totalSecsToday < 17 * 3600) {
      fxIsOpen = true;
      fxCountdown = `Cierra fin de semana en ${this.formatDuration((17 * 3600) - totalSecsToday)}`;
    } else {
      fxCountdown = 'Cerrado (Abre Domingo 17:00 ET)';
    }

    this.marketSchedules = [
      {
        name: 'Commodities (Oro & Petróleo)',
        isOpen: commIsOpen,
        statusLabel: commIsOpen ? 'ABIERTO' : 'EN PAUSA',
        countdownText: commCountdown,
        tradingHours: '18:00 - 17:00 ET (Pausa 17:00 - 18:00)'
      },
      {
        name: 'Acciones Wall Street (NYSE/NASDAQ)',
        isOpen: stocksIsOpen,
        statusLabel: stocksIsOpen ? 'ABIERTO' : 'CERRADO',
        countdownText: stocksCountdown,
        tradingHours: '09:30 - 16:00 ET (08:30 - 15:00 EC)'
      },
      {
        name: 'Forex (Divisas)',
        isOpen: fxIsOpen,
        statusLabel: fxIsOpen ? 'ABIERTO' : 'CERRADO',
        countdownText: fxCountdown,
        tradingHours: 'Dom 17:00 - Vie 17:00 ET continuo'
      },
      {
        name: 'Criptomonedas (BTC / ETH)',
        isOpen: true,
        statusLabel: '24/7 ACTIVO',
        countdownText: 'Sin interrupción',
        tradingHours: 'Continuo 365 días'
      }
    ];

    this.cdr.detectChanges();
  }

  private formatDuration(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  }

  getRiskAmount(): number {
    return (Number(this.accountCapital || 0) * Number(this.riskPercentage || 0)) / 100;
  }

  getRiskVsSalaryPercentage(): string {
    const salary = Number(this.userMonthlySalary || 0);
    if (salary <= 0) return '0.0';
    return ((this.getRiskAmount() / salary) * 100).toFixed(1);
  }

  getMaxMonthlyLossAllowed(): number {
    return Number(this.userMonthlySalary || 0) * 0.10;
  }

  getResolvedDirection(): 'BUY' | 'SELL' {
    if (this.result?.decision === 'BUY') return 'BUY';
    if (this.result?.decision === 'SELL') return 'SELL';
    const buyProb = this.result?.probabilities?.buy || 0;
    const sellProb = this.result?.probabilities?.sell || 0;
    return buyProb >= sellProb ? 'BUY' : 'SELL';
  }

  calculatePositionSize(scenario: 'buy' | 'sell'): { shares: number; totalCost: number; actualRisk: number; actualProfit: number } {
    const entry = Number(this.result?.current_price || (scenario === 'buy' ? this.result?.risk?.buy_scenario?.entry_price : this.result?.risk?.sell_scenario?.entry_price) || 0);

    const customRisk = this.getRiskAmount();
    const targetLossDollars = (customRisk >= 10 && customRisk <= 15) ? customRisk : 12.50;
    const targetProfitDollars = targetLossDollars * 2;

    let shares = 1;
    if (entry > 0 && entry < 100) {
      const estimatedAtrDistance = entry * 0.035;
      shares = Math.max(1, Math.floor(targetLossDollars / estimatedAtrDistance));
    }

    const totalCost = Number((shares * entry).toFixed(2));
    const actualRisk = Number(targetLossDollars.toFixed(2));
    const actualProfit = Number(targetProfitDollars.toFixed(2));

    return { shares, totalCost, actualRisk, actualProfit };
  }

  getAutoResolvedOrder() {
    const direction = this.getResolvedDirection();
    const isBuy = direction === 'BUY';
    const entry = Number(this.result?.current_price || (isBuy ? this.result?.risk?.buy_scenario?.entry_price : this.result?.risk?.sell_scenario?.entry_price) || 0);

    const pos = this.calculatePositionSize(isBuy ? 'buy' : 'sell');

    const slDistance = Number((pos.actualRisk / pos.shares).toFixed(4));
    const tpDistance = Number((pos.actualProfit / pos.shares).toFixed(4));

    const sl = Number((isBuy ? entry - slDistance : entry + slDistance).toFixed(4));
    const tp = Number((isBuy ? entry + tpDistance : entry - tpDistance).toFixed(4));

    const slPct = entry > 0 ? ((slDistance / entry) * 100).toFixed(2) : '0.00';
    const tpPct = entry > 0 ? ((tpDistance / entry) * 100).toFixed(2) : '0.00';

    return {
      direction,
      entry,
      sl,
      tp,
      slDist: slDistance,
      tpDist: tpDistance,
      slPct,
      tpPct,
      shares: pos.shares,
      totalCost: pos.totalCost,
      actualRisk: pos.actualRisk,
      actualProfit: pos.actualProfit,
      probability: isBuy ? this.result?.probabilities?.buy : this.result?.probabilities?.sell
    };
  }

  selectStockFromRadar(stock: any) {
    this.selectedMarket = 'stocks';
    this.selectedSymbol = stock.symbol;
    this.selectedTimeframe = 'W';
    this.renderTradingViewChart();
    this.runAnalysis();

    const chartElement = document.getElementById('tv_chart_container');
    if (chartElement) {
      chartElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    this.renderTradingViewChart();
    this.runAnalysis();
  }

  onSymbolChange() {
    this.renderTradingViewChart();
    this.runAnalysis();
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
          container_id: 'tv_chart_container',
          hide_side_toolbar: false,
          withdateranges: true,
          save_image: false,
          // Se cambiaron a los nombres compatibles del widget gratuito para evitar el error cannot_get_metainfo
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies'
          ]
        });
      }
    }, 100);
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

    let backendTf = '1d';
    let backendPeriod = '1y';

    if (this.selectedTimeframe === '15') {
      backendTf = '15m';
      backendPeriod = '5d';
    } else if (this.selectedTimeframe === '60') {
      backendTf = '1h';
      backendPeriod = '1mo';
    } else if (this.selectedTimeframe === 'D') {
      backendTf = '1d';
      backendPeriod = '1y';
    } else if (this.selectedTimeframe === 'W') {
      backendTf = '1wk';
      backendPeriod = '2y';
    }

    const payload: AnalysisRequest = {
      market: this.selectedMarket,
      symbol: this.selectedSymbol,
      timeframe: backendTf,
      period: backendPeriod
    };

    this.tradingService.analyzeAsset(payload).subscribe({
      next: (data) => {
        this.result = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error al calcular señal con Python';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}