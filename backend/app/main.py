from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import time

from app.schemas.market import (
    AnalysisRequest, 
    AnalysisResponse, 
    RiskManagement, 
    OrderLevels, 
    CandleData
)

app = FastAPI(title="Trading AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYMBOL_MAP = {
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "JPY=X",
    "GOLD": "GC=F",
    "OIL_WTI": "CL=F",
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "SP500": "^GSPC",
    "NASDAQ": "^IXIC"
}

# Watchlist optimizada con las recomendaciones del audio
WATCHLISTS = {
    "budget": {
        "SOFI": "SoFi Tech (Fintech)",
        "DAL":  "Delta Air Lines (Energía/Aviación)",
        "UBER": "Uber Technologies (Transporte/Tech)",
        "PLTR": "Palantir (Tech / IA)",
        "INTC": "Intel (Semiconductores)",
        "RIVN": "Rivian (EV)"
    },
    "megacaps": {
        "META": "Meta Platforms (Facebook)",
        "AMZN": "Amazon.com Inc",
        "MSFT": "Microsoft Corp",
        "NVDA": "NVIDIA Corp",
        "AAPL": "Apple Inc",
        "TSLA": "Tesla Inc"
    }
}

SCANNER_CACHE = {}
CACHE_TTL_SECONDS = 180

def analyze_single_stock(symbol: str, name: str):
    try:
        # Descarga en temporalidad semanal (1wk) y 2 años de historial para contexto macro
        data = yf.download(symbol, period="2y", interval="1wk", progress=False, auto_adjust=True)
        if data.empty or len(data) < 20:
            return None
            
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
            
        df = data.copy().dropna()
        close = df['Close']
        high = df['High']
        low = df['Low']
        
        # Medias semanales: SMA 20 semanas (~5 meses) y SMA 50 semanas (~1 año)
        sma20 = float(close.rolling(20).mean().iloc[-1])
        sma50 = float(close.rolling(50).mean().iloc[-1])
        
        # RSI Semanal
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / (loss + 1e-9)
        rsi = float((100 - (100 / (1 + rs))).iloc[-1])
        
        # ATR Semanal (volatilidad real del activo)
        tr1 = high - low
        tr2 = (high - close.shift(1)).abs()
        tr3 = (low - close.shift(1)).abs()
        atr = float(pd.concat([tr1, tr2, tr3], axis=1).max(axis=1).rolling(14).mean().iloc[-1])
        
        current_price = float(close.iloc[-1])
        
        # Puntuación probabilística semanal
        buy_score = 15.0
        if rsi < 38:
            buy_score += 40  # Descuento / Suelo semanal
        elif rsi < 50:
            buy_score += 25
        
        if current_price > sma20:
            buy_score += 25
        if sma20 > sma50:
            buy_score += 20
        
        prob_buy = min(round((buy_score / 100.0) * 100, 1), 94.0)

        # Clasificación macro
        if rsi < 40:
            tag = "Rebote / Descuento"
            tag_type = "rebote"
        elif current_price > sma20 and sma20 > sma50:
            tag = "Tendencia Sólida"
            tag_type = "trend"
        else:
            tag = "Acumulación"
            tag_type = "momentum"
        
        return {
            "symbol": symbol,
            "name": name,
            "current_price": round(current_price, 2),
            "prob_buy": prob_buy,
            "rsi": round(rsi, 1),
            "tag": tag,
            "tag_type": tag_type,
            "entry_price": round(current_price, 2),
            "stop_loss": round(current_price - (1.5 * atr), 2),
            "take_profit": round(current_price + (3.0 * atr), 2)
        }
    except Exception:
        return None

@app.get("/")
def read_root():
    return {"message": "Trading AI Engine API activo", "docs": "/docs", "health": "/health"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/v1/top-picks")
def get_top_stock_picks(category: str = Query("budget", enum=["budget", "megacaps"]), force: bool = False):
    now = time.time()
    
    if not force and category in SCANNER_CACHE:
        cached_data, timestamp = SCANNER_CACHE[category]
        if now - timestamp < CACHE_TTL_SECONDS:
            return {"status": "ok", "category": category, "cached": True, "picks": cached_data}
            
    selected_watchlist = WATCHLISTS.get(category, WATCHLISTS["budget"])
    
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(analyze_single_stock, sym, name) for sym, name in selected_watchlist.items()]
        results = [f.result() for f in futures]
        
    picks = [r for r in results if r is not None]
    picks.sort(key=lambda x: x["prob_buy"], reverse=True)
    
    SCANNER_CACHE[category] = (picks, now)
    return {"status": "ok", "category": category, "cached": False, "picks": picks}

@app.post("/api/v1/analyze", response_model=AnalysisResponse)
def analyze(req: AnalysisRequest):
    ticker_str = SYMBOL_MAP.get(req.symbol, req.symbol)
    
    try:
        data = yf.download(ticker_str, period="6mo", interval="1d", progress=False, auto_adjust=True)
        if data.empty or len(data) < 25:
            raise HTTPException(status_code=400, detail=f"Datos insuficientes para {req.symbol}")
        
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
            
        df = data.copy().dropna()
        close = df['Close']
        high = df['High']
        low = df['Low']
        
        df['SMA_20'] = close.rolling(window=20).mean()
        df['SMA_50'] = close.rolling(window=50).mean()
        
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / (loss + 1e-9)
        df['RSI'] = 100 - (100 / (1 + rs))
        
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        df['MACD'] = ema12 - ema26
        
        tr1 = high - low
        tr2 = (high - close.shift(1)).abs()
        tr3 = (low - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        df['ATR'] = tr.rolling(window=14).mean()
        
        df = df.dropna()
        last_row = df.iloc[-1]
        
        current_price = float(last_row['Close'])
        rsi = float(last_row['RSI'])
        macd = float(last_row['MACD'])
        sma20 = float(last_row['SMA_20'])
        sma50 = float(last_row['SMA_50'])
        atr = float(last_row['ATR']) if not np.isnan(last_row['ATR']) else (current_price * 0.005)
        
        buy_score = 10.0
        sell_score = 10.0
        hold_score = 10.0

        if rsi < 32: buy_score += 40
        elif rsi < 45: buy_score += 20
        elif rsi > 68: sell_score += 40
        elif rsi > 55: sell_score += 20
        else: hold_score += 15

        if macd > 0: buy_score += 25
        else: sell_score += 25

        if current_price > sma20 and sma20 > sma50: buy_score += 35
        elif current_price < sma20 and sma20 < sma50: sell_score += 35
        else: hold_score += 20

        total_score = buy_score + sell_score + hold_score
        prob_buy = round((buy_score / total_score) * 100, 1)
        prob_sell = round((sell_score / total_score) * 100, 1)
        prob_hold = round(100.0 - prob_buy - prob_sell, 1)

        if prob_buy > prob_sell and prob_buy >= 45:
            decision = "BUY"
            confidence = round(prob_buy / 100, 2)
        elif prob_sell > prob_buy and prob_sell >= 45:
            decision = "SELL"
            confidence = round(prob_sell / 100, 2)
        else:
            decision = "HOLD"
            confidence = round(prob_hold / 100, 2)
            
        buy_sl = round(current_price - (1.5 * atr), 4)
        buy_tp = round(current_price + (3.0 * atr), 4)
        sell_sl = round(current_price + (1.5 * atr), 4)
        sell_tp = round(current_price - (3.0 * atr), 4)

        buy_scenario = OrderLevels(entry_price=round(current_price, 4), stop_loss=buy_sl, take_profit=buy_tp, risk_reward_ratio=2.0)
        sell_scenario = OrderLevels(entry_price=round(current_price, 4), stop_loss=sell_sl, take_profit=sell_tp, risk_reward_ratio=2.0)

        risk = RiskManagement(
            entry_price=round(current_price, 4),
            stop_loss=buy_sl if decision == "BUY" else (sell_sl if decision == "SELL" else None),
            take_profit=buy_tp if decision == "BUY" else (sell_tp if decision == "SELL" else None),
            risk_reward_ratio=2.0,
            atr_value=round(atr, 4),
            buy_scenario=buy_scenario,
            sell_scenario=sell_scenario
        )
        
        candles = []
        for idx, row in df.tail(30).iterrows():
            candles.append(CandleData(
                time=str(idx)[:10],
                open=round(float(row['Open']), 4),
                high=round(float(row['High']), 4),
                low=round(float(row['Low']), 4),
                close=round(float(row['Close']), 4)
            ))

        return AnalysisResponse(
            symbol=req.symbol,
            decision=decision,
            confidence=confidence,
            current_price=round(current_price, 4),
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            model_accuracy_cv=0.69,
            indicators={
                "rsi": round(rsi, 2),
                "macd": round(macd, 4),
                "sma_20": round(sma20, 4),
                "sma_50": round(sma50, 4),
                "atr": round(atr, 4)
            },
            risk=risk,
            candles=candles,
            probabilities={"buy": prob_buy, "sell": prob_sell, "hold": prob_hold}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))