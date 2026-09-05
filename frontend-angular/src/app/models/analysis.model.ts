export interface AnalysisRequest {
  market: string;
  symbol: string;
  timeframe: string;
  period: string;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface RiskManagement {
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  risk_reward_ratio: number;
  atr_value: number | null;
}

export interface AnalysisResponse {
  symbol: string;
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  current_price: number;
  timestamp: string;
  model_accuracy_cv?: number;
  indicators: {
    rsi?: number;
    macd?: number;
    sma_20?: number;
    sma_50?: number;
    atr?: number;
  };
  risk: RiskManagement;
  candles: CandleData[];
}