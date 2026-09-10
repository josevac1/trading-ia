from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class CandleData(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float

class OrderLevels(BaseModel):
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward_ratio: float = 2.0

class RiskManagement(BaseModel):
    entry_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    risk_reward_ratio: float = 2.0
    atr_value: float
    buy_scenario: Optional[OrderLevels] = None
    sell_scenario: Optional[OrderLevels] = None

class AnalysisRequest(BaseModel):
    market: str
    symbol: str
    timeframe: str = "1d"
    period: str = "6mo"

class AnalysisResponse(BaseModel):
    symbol: str
    decision: str
    confidence: float
    current_price: float
    timestamp: str
    model_accuracy_cv: Optional[float] = None
    indicators: Dict[str, Any]
    risk: RiskManagement
    candles: List[CandleData] = []
    probabilities: Optional[Dict[str, float]] = None