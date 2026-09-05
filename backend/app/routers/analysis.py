from fastapi import APIRouter, HTTPException
from app.schemas.market import AnalysisRequest, AnalysisResponse
from app.services.data_fetcher import fetch_market_data
from app.services.ml_engine import run_pipeline

router = APIRouter(prefix="/api/v1", tags=["Analysis"])

@router.post("/analyze", response_model=AnalysisResponse)
def analyze_asset(request: AnalysisRequest):
    try:
        df = fetch_market_data(
            market=request.market,
            symbol=request.symbol,
            period=request.period,
            interval=request.timeframe
        )
        result = run_pipeline(df)
        return AnalysisResponse(symbol=request.symbol.upper(), **result)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando solicitud: {str(e)}")

    