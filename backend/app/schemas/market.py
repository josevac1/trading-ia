from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AnalysisRequest(BaseModel):
    market: str
    symbol: str
    timeframe: str = "1d"
    period: str = "1y"

class CandleData(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float

class RiskManagement(BaseModel):
    entry_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    risk_reward_ratio: float = 2.0
    atr_value: Optional[float] = None

class AnalysisResponse(BaseModel):
    symbol: str
    decision: str
    confidence: float
    current_price: float
    timestamp: str
    model_accuracy_cv: Optional[float] = None
    indicators: Dict[str, Any]
    risk: RiskManagement
    candles: List[CandleData]