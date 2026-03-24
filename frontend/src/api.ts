import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

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

export interface AiSignal {
  ticker: string;
  signal: 'BUY' | 'HOLD' | 'SELL';
  confidence: number;
  reasons: string[];
}

export const fetchStockPrice = async (ticker: string = 'AAPL', period: string = '1mo'): Promise<PriceResponse> => {
  const { data } = await axios.get(`${API_BASE_URL}/stock/${ticker}/price?period=${period}`);
  return data;
};

export const fetchStockIndicators = async (ticker: string = 'AAPL'): Promise<Indicators> => {
  const { data } = await axios.get(`${API_BASE_URL}/stock/${ticker}/indicators`);
  return data;
};

export const fetchAiSignal = async (ticker: string = 'AAPL'): Promise<AiSignal> => {
  const { data } = await axios.get(`${API_BASE_URL}/stock/${ticker}/signal`);
  return data;
};
