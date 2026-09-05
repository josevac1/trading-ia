import yfinance as yf
import pandas as pd
from app.config import SUPPORTED_MARKETS

def fetch_market_data(market: str, symbol: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    market_clean = market.lower()
    symbol_clean = symbol.upper()
    
    if market_clean not in SUPPORTED_MARKETS or symbol_clean not in SUPPORTED_MARKETS[market_clean]:
        raise ValueError(f"Símbolo '{symbol}' no soportado en el mercado '{market}'.")
    
    ticker_str = SUPPORTED_MARKETS[market_clean][symbol_clean]
    df = yf.download(ticker_str, period=period, interval=interval, progress=False)
    
    if df.empty:
        raise ValueError(f"No se obtuvieron datos para {ticker_str}.")
        
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
        
    return df.dropna()