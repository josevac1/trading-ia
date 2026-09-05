from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = "development"
    app_port: int = 8000
    app_host: str = "127.0.0.1"
    debug: bool = True
    default_period: str = "2y"
    default_timeframe: str = "1d"
    return_threshold: float = 0.001

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

SUPPORTED_MARKETS = {
    "forex": {
        "EURUSD": "EURUSD=X",
        "GBPUSD": "GBPUSD=X",
        "USDJPY": "USDJPY=X",
        "AUDUSD": "AUDUSD=X",
        "USDCAD": "USDCAD=X",
    },
    "commodities": {
        "GOLD": "GC=F",
    },
    "indices": {
        "SP500": "^GSPC",
        "NASDAQ": "^IXIC",
        "DOW": "^DJI",
    },
    "crypto": {
        "BTCUSD": "BTC-USD",
        "ETHUSD": "ETH-USD",
    }
}