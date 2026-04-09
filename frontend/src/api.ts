import axios from 'axios';

export interface ScannerResult {
  ticker: string;
  price: number;
  rsi: number;
  macd_signal: string;
  volume_pulse: string;
  volume_ratio: number | null;
  signal: string;
  score: number;
  confidence: number;
  reasons: string[];
  change_pct: number;
  sector?: string;
  industry?: string;
}

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface OHLCV {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceResponse {
  ticker: string;
  currency: string;
  current_price: number;
  data: OHLCV[];
}

export interface IndicatorData {
  time: string;
  value: number;
}

export interface MACDData {
  time: string;
  macd: number;
  signal: number;
  hist: number;
}

export interface Indicators {
  rsi: IndicatorData[];
  macd: MACDData[];
  ma50: IndicatorData[];
  ma200: IndicatorData[];
}

export interface AiSignal extends ScannerResult {}

export type WinRateData = {
    win_rate: number;
    total: number;
    evaluated: number;
    wins: number;
    avg_gain: number;
    avg_loss: number;
}

export interface SignalHistory {
  id: number;
  ticker: string;
  signal: string;
  score: number;
  price_at_signal: number;
  timestamp: string;
  outcome: string | null;
  price_at_outcome: number | null;
  pct_change: number | null;
}

export const fetchStockPrice = async (ticker: string = 'AAPL', period: string = '1mo'): Promise<PriceResponse> => {
  const { data } = await axios.get(`${API_BASE_URL}/stock/${ticker}/price?period=${period}`);
  return data;
};

export const fetchStockIndicators = async (ticker: string): Promise<Indicators> => {
  const response = await axios.get(`${API_BASE_URL}/stock/${ticker}/indicators`);
  return response.data;
};

export const fetchMarketScan = async (): Promise<ScannerResult[]> => {
  const response = await axios.get(`${API_BASE_URL}/market-scan`);
  return response.data;
};

export const fetchAiSignal = async (ticker: string = 'AAPL'): Promise<AiSignal> => {
  const { data } = await axios.get(`${API_BASE_URL}/api/signal/${ticker}`);
  return data;
};

export const fetchUniverseScan = async (universe?: string, tickers?: string[]): Promise<AiSignal[]> => {
  const response = await axios.post(`${API_BASE_URL}/api/scan`, { universe, tickers });
  return response.data;
};

export const fetchSymbolSearch = async (query: string): Promise<any[]> => {
  if (!query || query.length < 2) return [];
  const { data } = await axios.get(`${API_BASE_URL}/api/search?q=${query}`);
  return data;
};

export const fetchWinRate = async (): Promise<WinRateData> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/winrate`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch win rate", error);
        return { win_rate: 0, total: 0, evaluated: 0, wins: 0, avg_gain: 0, avg_loss: 0 };
    }
};

export const fetchPrice = async (ticker: string): Promise<{ price: number; change_pct: number; currency: string }> => {
    const { data } = await axios.get(`${API_BASE_URL}/api/price/${ticker}`);
    return data;
};

export const fetchExchangeRate = async (): Promise<{ rate: number }> => {
    const { data } = await axios.get(`${API_BASE_URL}/api/exchangerate`);
    return data;
};

export const fetchSignalHistory = async (): Promise<SignalHistory[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/history`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch signal history", error);
        return [];
    }
};

export const triggerEvaluation = async (): Promise<WinRateData> => {
    const { data } = await axios.post(`${API_BASE_URL}/api/evaluate`);
    return data;
};

export interface PredictionPoint {
    day: number;
    date: string;
    price: number;
}

export interface PredictionData {
    ticker: string;
    current_price: number;
    predictions: PredictionPoint[];
    actual: PredictionPoint[];
    trend: 'bullish' | 'bearish' | 'neutral';
    confidence: 'high' | 'medium' | 'low';
    r2_score: number;
    support: number;
    resistance: number;
    error?: string;
}

export const fetchPrediction = async (ticker: string): Promise<PredictionData> => {
    const { data } = await axios.get(`${API_BASE_URL}/api/predict/${ticker}`);
    return data;
};

export interface EquityPoint { date: string; value: number }
export interface Trade {
  entry_date: string; exit_date: string
  entry_price: number; exit_price: number
  return_pct: number; outcome: string; signal_score: number
}
export interface BacktestResult {
  ticker: string; period: string
  initial_capital: number; final_capital: number
  total_return_pct: number; total_trades: number
  win_rate: number; wins: number; losses: number
  max_drawdown: number
  sharpe_ratio: number; avg_gain: number; avg_loss: number
  best_trade: number; worst_trade: number
  equity_curve: EquityPoint[]; trades: Trade[]
  error?: string
}

export const fetchBacktest = async (ticker: string, period: string): Promise<BacktestResult> => {
    // Switching to v2 (query params) to avoid dot-misinterpretation in path params
    const { data } = await axios.get(`${API_BASE_URL}/api/v2/backtest?ticker=${ticker.toUpperCase()}&period=${period}`);
    return data;
};

export const clearSignalsHistory = async (): Promise<{ success: boolean; message: string }> => {
    const { data } = await axios.delete(`${API_BASE_URL}/api/signals/clear`);
    return data;
};
