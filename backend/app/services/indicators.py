import pandas as pd
import numpy as np
from ta.trend import SMAIndicator, EMAIndicator, MACD
from ta.momentum import RSIIndicator
from ta.volatility import BollingerBands, AverageTrueRange
from app.config import settings

def compute_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    close = data['Close']
    high = data['High']
    low = data['Low']

    data['sma_10'] = SMAIndicator(close=close, window=10).sma_indicator()
    data['sma_20'] = SMAIndicator(close=close, window=20).sma_indicator()
    data['sma_50'] = SMAIndicator(close=close, window=50).sma_indicator()
    data['ema_20'] = EMAIndicator(close=close, window=20).ema_indicator()

    data['rsi'] = RSIIndicator(close=close, window=14).rsi()
    macd = MACD(close=close, window_slow=26, window_fast=12, window_sign=9)
    data['macd'] = macd.macd()
    data['macd_signal'] = macd.macd_signal()
    data['macd_diff'] = macd.macd_diff()

    bb = BollingerBands(close=close, window=20, window_dev=2)
    data['bb_high'] = bb.bollinger_hband()
    data['bb_low'] = bb.bollinger_lband()
    data['bb_pband'] = bb.bollinger_pband()
    
    atr = AverageTrueRange(high=high, low=low, close=close, window=14)
    data['atr'] = atr.average_true_range()

    data['returns'] = close.pct_change()
    data['volatility_20'] = data['returns'].rolling(window=20).std()
    data['dist_sma20'] = (close - data['sma_20']) / data['sma_20']
    data['dist_sma50'] = (close - data['sma_50']) / data['sma_50']

    data['next_return'] = close.pct_change().shift(-1)
    threshold = settings.return_threshold
    data['target'] = np.where(
        data['next_return'] > threshold, 1,
        np.where(data['next_return'] < -threshold, -1, 0)
    )

    return data