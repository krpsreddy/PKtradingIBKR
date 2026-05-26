# NVDA Trading Dashboard (Angular)

Angular 19 dashboard for validating 5-minute candles, EMA/VWAP overlays, and trading signals against TradingView.

## Prerequisites

- Node.js 20+
- Spring Boot backend running on `http://localhost:8080`

## Setup

```bash
cd frontend
npm install
npm install lightweight-charts
ng add @angular/material   # if Material not already installed
```

## Run

```bash
# Terminal 1 — backend
cd ..
mvn spring-boot:run

# Terminal 2 — frontend
cd frontend
npm start
```

Open **http://localhost:4200/dashboard**

## Features

- TradingView Lightweight Charts (candles + EMA9/20/50 + VWAP)
- Signal markers: MOM BUY (green), PULL BUY (blue), EXIT (red)
- Indicator panel with bullish/bearish color coding
- Signal history table (latest 20)
- System status (IBKR, historical, live stream)
- Auto-refresh every **10 seconds** (no WebSockets)

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/candles/latest` | OHLCV + per-bar EMA/VWAP |
| `GET /api/indicators/latest` | Latest indicator snapshot |
| `GET /api/signals/latest` | Last 20 signals |
| `GET /api/system/status` | Connection health |

## Validation workflow

1. Open this dashboard beside TradingView (NVDA, 5m)
2. Compare candle OHLC, EMA lines, and VWAP
3. Verify signal marker timing vs Telegram alerts
