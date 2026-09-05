import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from app.services.indicators import compute_all_indicators

FEATURE_COLUMNS = [
    'rsi', 'macd', 'macd_signal', 'macd_diff',
    'dist_sma20', 'dist_sma50', 'bb_pband',
    'atr', 'returns', 'volatility_20'
]

def run_pipeline(df: pd.DataFrame):
    featured = compute_all_indicators(df)
    current_row = featured.iloc[[-1]]
    train_data = featured.dropna(subset=FEATURE_COLUMNS + ['next_return'])
    
    if len(train_data) < 50:
        raise ValueError("Datos históricos insuficientes para entrenar el modelo.")

    X = train_data[FEATURE_COLUMNS]
    y = train_data['target']

    tscv = TimeSeriesSplit(n_splits=5)
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=5,
        random_state=42,
        class_weight="balanced"
    )
    
    cv_scores = cross_val_score(model, X, y, cv=tscv, scoring='accuracy')
    mean_accuracy = float(np.mean(cv_scores))

    model.fit(X, y)

    X_latest = current_row[FEATURE_COLUMNS]
    pred = model.predict(X_latest)[0]
    probs = model.predict_proba(X_latest)[0]

    classes = list(model.classes_)
    prob_dict = {str(c): round(float(p), 4) for c, p in zip(classes, probs)}

    decision_map = {1: "BUY", -1: "SELL", 0: "HOLD"}
    decision = decision_map.get(pred, "HOLD")
    confidence = float(max(probs))
    latest_close = float(current_row['Close'].iloc[0])

    def safe_val(col_name: str):
        val = current_row[col_name].iloc[0]
        return round(float(val), 5) if not pd.isna(val) else None

    return {
        "decision": decision,
        "confidence": round(confidence, 4),
        "current_price": latest_close,
        "probabilities": prob_dict,
        "model_accuracy_cv": round(mean_accuracy, 4),
        "indicators": {
            "rsi": safe_val('rsi'),
            "macd": safe_val('macd'),
            "macd_signal": safe_val('macd_signal'),
            "sma_10": safe_val('sma_10'),
            "sma_20": safe_val('sma_20'),
            "sma_50": safe_val('sma_50'),
            "ema_20": safe_val('ema_20'),
            "atr": safe_val('atr'),
            "bb_high": safe_val('bb_high'),
            "bb_low": safe_val('bb_low'),
            "volatility_20": safe_val('volatility_20'),
            "current_close": latest_close
        },
        "timestamp": str(current_row.index[-1])
    }